import { describe, it, expect } from "@jest/globals";
import { ScanAction } from "../src/domain/models";
import type { Student, Visit } from "../src/domain/models";
import {
  InvalidBarcodeError,
  UnknownStudentError,
  InactiveStudentError,
  RapidScanError,
  LibraryFullError,
  DuplicateActiveVisitError,
} from "../src/domain/errors";
import {
  InMemoryStudentRepository,
  InMemoryVisitRepository,
} from "../src/repositories/inMemory";
import { LibraryService } from "../src/services/libraryService";

// ─── Deterministic time helpers ───────────────────────────────────────────────

/** Fixed epoch for all tests — 2025-09-01 09:00:00 UTC */
const T0 = new Date("2025-09-01T09:00:00.000Z");

/** Returns a Date that is `n` seconds after T0. */
const atSecs = (n: number): Date => new Date(T0.getTime() + n * 1_000);

/** Returns a Date that is `n` minutes after T0. */
const atMins = (n: number): Date => atSecs(n * 60);

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ALICE: Student = {
  id: "s-001",
  name: "Alice Nguyen",
  barcode: "10000001",
  isActive: true,
};

const BOB: Student = {
  id: "s-002",
  name: "Bob Okafor",
  barcode: "10000002",
  isActive: true,
};

const CHARLIE: Student = {
  id: "s-003",
  name: "Charlie Petrov",
  barcode: "10000003",
  isActive: false, // deactivated account
};

// Barcode with a leading zero — must never be coerced to a number
const DIANA: Student = {
  id: "s-004",
  name: "Diana Reyes",
  barcode: "00012345",
  isActive: true,
};

// ─── Factory helpers ──────────────────────────────────────────────────────────

let idSequence = 0;

function makeService(
  capacity: number,
  minScanIntervalSeconds = 5,
  extraStudents: Student[] = []
) {
  idSequence = 0;

  const studentRepo = new InMemoryStudentRepository();
  const visitRepo = new InMemoryVisitRepository();

  // Register standard test students
  for (const s of [ALICE, BOB, CHARLIE, DIANA, ...extraStudents]) {
    studentRepo.add(s);
  }

  const service = new LibraryService(studentRepo, visitRepo, {
    capacity,
    minScanIntervalSeconds,
    generateId: () => `visit-${++idSequence}`,
  });

  return { service, studentRepo, visitRepo };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LibraryService", () => {
  // ── 1. Valid check-in ──────────────────────────────────────────────────────
  describe("valid check-in", () => {
    it("returns CHECK_IN action and increments occupancy", () => {
      const { service } = makeService(10);

      const result = service.scan(ALICE.barcode, T0);

      expect(result.action).toBe(ScanAction.CHECK_IN);
      expect(result.visitId).toBe("visit-1");
      expect(result.scannedAt).toEqual(T0);
      expect(result.occupancy.currentOccupancy).toBe(1);
      expect(result.occupancy.availableSpaces).toBe(9);
      expect(result.occupancy.capacity).toBe(10);
    });

    it("creates an active visit record in the repository", () => {
      const { service, visitRepo } = makeService(10);
      service.scan(ALICE.barcode, T0);

      const activeVisits = visitRepo.getActiveVisitsForStudent(ALICE.id);
      expect(activeVisits).toHaveLength(1);
      expect(activeVisits[0].checkInTime).toEqual(T0);
      expect(activeVisits[0].checkOutTime).toBeNull();
      expect(activeVisits[0].durationSeconds).toBeNull();
      expect(activeVisits[0].isActive).toBe(true);
    });
  });

  // ── 2. Valid check-out ────────────────────────────────────────────────────
  describe("valid check-out", () => {
    it("returns CHECK_OUT action and decrements occupancy", () => {
      const { service } = makeService(10);
      service.scan(ALICE.barcode, T0);

      const result = service.scan(ALICE.barcode, atMins(1));

      expect(result.action).toBe(ScanAction.CHECK_OUT);
      expect(result.occupancy.currentOccupancy).toBe(0);
      expect(result.occupancy.availableSpaces).toBe(10);
    });

    it("closes the visit record with correct timestamps", () => {
      const { service, visitRepo } = makeService(10);
      service.scan(ALICE.barcode, T0);
      service.scan(ALICE.barcode, atMins(1));

      const history = visitRepo.getHistory(ALICE.id);
      expect(history).toHaveLength(1);

      const visit = history[0];
      expect(visit.isActive).toBe(false);
      expect(visit.checkOutTime).toEqual(atMins(1));
    });
  });

  // ── 3. Unknown student ────────────────────────────────────────────────────
  describe("unknown student", () => {
    it("throws UnknownStudentError for an unregistered barcode", () => {
      const { service } = makeService(10);

      expect(() => service.scan("99999999", T0)).toThrow(UnknownStudentError);
    });

    it("error message references the scanned barcode", () => {
      const { service } = makeService(10);

      expect(() => service.scan("99999999", T0)).toThrowError(/99999999/);
    });
  });

  // ── 4. Inactive student ───────────────────────────────────────────────────
  describe("inactive student", () => {
    it("throws InactiveStudentError for a deactivated account", () => {
      const { service } = makeService(10);

      expect(() => service.scan(CHARLIE.barcode, T0)).toThrow(InactiveStudentError);
    });
  });

  // ── 5. Duplicate scan protection ──────────────────────────────────────────
  describe("duplicate scan protection", () => {
    it("throws RapidScanError when re-scanning before the minimum interval", () => {
      const { service } = makeService(10, 5);
      service.scan(ALICE.barcode, T0);

      // Only 3 seconds later — below the 5 s threshold
      expect(() => service.scan(ALICE.barcode, atSecs(3))).toThrow(RapidScanError);
    });

    it("error references elapsed time", () => {
      const { service } = makeService(10, 5);
      service.scan(ALICE.barcode, T0);

      expect(() => service.scan(ALICE.barcode, atSecs(2))).toThrowError(/2\.0s/);
    });

    it("allows a re-scan at exactly the interval boundary (strict < means equal is accepted)", () => {
      const { service } = makeService(10, 5);
      service.scan(ALICE.barcode, T0);

      // Guard is `elapsed < minInterval` (strict less-than), so 5 < 5 is false —
      // the scan proceeds as a valid check-out.
      const result = service.scan(ALICE.barcode, atSecs(5));
      expect(result.action).toBe(ScanAction.CHECK_OUT);
    });
  });

  // ── 6. Scan after interval allowed ───────────────────────────────────────
  describe("scan after interval is allowed", () => {
    it("accepts a check-out scan once the minimum interval has passed", () => {
      const { service } = makeService(10, 5);
      service.scan(ALICE.barcode, T0);

      // 6 s — just past the 5 s threshold
      const result = service.scan(ALICE.barcode, atSecs(6));
      expect(result.action).toBe(ScanAction.CHECK_OUT);
    });
  });

  // ── 7. Full capacity ──────────────────────────────────────────────────────
  describe("full capacity", () => {
    it("throws LibraryFullError when a new student tries to check in", () => {
      const { service } = makeService(1);
      service.scan(ALICE.barcode, T0); // fills the library

      expect(() => service.scan(BOB.barcode, atSecs(1))).toThrow(LibraryFullError);
    });

    it("error message references the capacity limit", () => {
      const { service } = makeService(1);
      service.scan(ALICE.barcode, T0);

      expect(() => service.scan(BOB.barcode, atSecs(1))).toThrowError(/1/);
    });
  });

  // ── 8. Check-out while library is full ───────────────────────────────────
  describe("check-out while library is full", () => {
    it("allows a student inside to check out even when at full capacity", () => {
      const { service } = makeService(1);
      service.scan(ALICE.barcode, T0); // Alice is now the only person in a capacity-1 library

      // Alice can still check out — full capacity must never trap people inside
      const result = service.scan(ALICE.barcode, atMins(1));
      expect(result.action).toBe(ScanAction.CHECK_OUT);
    });

    it("frees up a space after check-out so the next student can enter", () => {
      const { service } = makeService(1);
      service.scan(ALICE.barcode, T0);
      service.scan(ALICE.barcode, atMins(1)); // Alice leaves

      // Bob can now enter
      const result = service.scan(BOB.barcode, atMins(2));
      expect(result.action).toBe(ScanAction.CHECK_IN);
    });
  });

  // ── 9. Repeated visits ────────────────────────────────────────────────────
  describe("repeated visits", () => {
    it("allows a student to check in and out multiple times", () => {
      const { service, visitRepo } = makeService(10);

      // First visit
      service.scan(ALICE.barcode, atMins(0));
      service.scan(ALICE.barcode, atMins(30));

      // Second visit (same day)
      service.scan(ALICE.barcode, atMins(60));
      service.scan(ALICE.barcode, atMins(90));

      const history = visitRepo.getHistory(ALICE.id);
      expect(history).toHaveLength(2);
      expect(history.every((v) => !v.isActive)).toBe(true);
    });

    it("occupancy returns to zero between visits", () => {
      const { service } = makeService(10);

      service.scan(ALICE.barcode, atMins(0));
      service.scan(ALICE.barcode, atMins(30));
      expect(service.getStatus().currentOccupancy).toBe(0);

      service.scan(ALICE.barcode, atMins(60));
      expect(service.getStatus().currentOccupancy).toBe(1);
    });
  });

  // ── 10. Occupancy calculations ────────────────────────────────────────────
  describe("occupancy calculations", () => {
    it("reflects correct values with multiple students inside", () => {
      const { service } = makeService(10);
      service.scan(ALICE.barcode, T0);
      service.scan(BOB.barcode, atSecs(1));

      const status = service.getStatus();
      expect(status.capacity).toBe(10);
      expect(status.currentOccupancy).toBe(2);
      expect(status.availableSpaces).toBe(8);
      expect(status.occupancyPercentage).toBeCloseTo(20, 5);
    });

    it("reports 100% occupancy when the library is full", () => {
      const { service } = makeService(2);
      service.scan(ALICE.barcode, T0);
      service.scan(BOB.barcode, atSecs(1));

      const status = service.getStatus();
      expect(status.availableSpaces).toBe(0);
      expect(status.occupancyPercentage).toBe(100);
    });

    it("reports 0% occupancy when the library is empty", () => {
      const { service } = makeService(10);

      const status = service.getStatus();
      expect(status.currentOccupancy).toBe(0);
      expect(status.availableSpaces).toBe(10);
      expect(status.occupancyPercentage).toBe(0);
    });
  });

  // ── 11. Visit duration ────────────────────────────────────────────────────
  describe("visit duration", () => {
    it("records duration in seconds from check-in to check-out", () => {
      const { service, visitRepo } = makeService(10);
      service.scan(ALICE.barcode, T0);
      service.scan(ALICE.barcode, atMins(30)); // 30 minutes = 1800 seconds

      const history = visitRepo.getHistory(ALICE.id);
      expect(history[0].durationSeconds).toBe(1_800);
    });

    it("duration is null while the visit is still active", () => {
      const { service, visitRepo } = makeService(10);
      service.scan(ALICE.barcode, T0);

      const activeVisits = visitRepo.getActiveVisitsForStudent(ALICE.id);
      expect(activeVisits[0].durationSeconds).toBeNull();
    });
  });

  // ── 12. Prevention of duplicate active visits ─────────────────────────────
  describe("prevention of duplicate active visits", () => {
    it("throws DuplicateActiveVisitError when data integrity is violated", () => {
      const { service, visitRepo } = makeService(10);

      // Simulate a data corruption scenario by injecting two active visits
      // for the same student directly into the repository
      const visit1: Visit = {
        id: "corrupt-visit-A",
        studentId: ALICE.id,
        barcode: ALICE.barcode,
        checkInTime: T0,
        checkOutTime: null,
        durationSeconds: null,
        isActive: true,
      };
      const visit2: Visit = {
        id: "corrupt-visit-B",
        studentId: ALICE.id,
        barcode: ALICE.barcode,
        checkInTime: atSecs(1),
        checkOutTime: null,
        durationSeconds: null,
        isActive: true,
      };
      visitRepo.add(visit1);
      visitRepo.add(visit2);

      expect(() => service.scan(ALICE.barcode, atSecs(10))).toThrow(
        DuplicateActiveVisitError
      );
    });

    it("a second scan by a checked-in student triggers check-out, not a second check-in", () => {
      const { service, visitRepo } = makeService(10);
      service.scan(ALICE.barcode, T0);
      service.scan(ALICE.barcode, atMins(1)); // should be CHECK_OUT

      const allVisits = visitRepo.getHistory(ALICE.id);
      const activeVisits = allVisits.filter((v) => v.isActive);

      // Exactly one completed visit, zero active
      expect(allVisits).toHaveLength(1);
      expect(activeVisits).toHaveLength(0);
    });
  });

  // ── 13. Over-capacity safety ──────────────────────────────────────────────
  describe("over-capacity safety", () => {
    it("availableSpaces is clamped to 0 and never goes negative", () => {
      // Inject two active visits into a capacity-1 library directly
      const { service, visitRepo } = makeService(1);
      const visit1: Visit = {
        id: "oc-visit-1",
        studentId: ALICE.id,
        barcode: ALICE.barcode,
        checkInTime: T0,
        checkOutTime: null,
        durationSeconds: null,
        isActive: true,
      };
      const visit2: Visit = {
        id: "oc-visit-2",
        studentId: BOB.id,
        barcode: BOB.barcode,
        checkInTime: T0,
        checkOutTime: null,
        durationSeconds: null,
        isActive: true,
      };
      visitRepo.add(visit1);
      visitRepo.add(visit2);

      const status = service.getStatus();
      expect(status.availableSpaces).toBe(0); // NOT -1
      expect(status.currentOccupancy).toBe(2);
    });
  });

  // ── 14–16. Invalid barcodes ────────────────────────────────────────────────
  describe("invalid barcode — empty string", () => {
    it("throws InvalidBarcodeError", () => {
      const { service } = makeService(10);
      expect(() => service.scan("", T0)).toThrow(InvalidBarcodeError);
    });
  });

  describe("invalid barcode — whitespace-only", () => {
    it("throws InvalidBarcodeError for a blank string", () => {
      const { service } = makeService(10);
      expect(() => service.scan("   ", T0)).toThrow(InvalidBarcodeError);
    });

    it("throws InvalidBarcodeError for a tab character", () => {
      const { service } = makeService(10);
      expect(() => service.scan("\t", T0)).toThrow(InvalidBarcodeError);
    });
  });

  describe("invalid barcode — non-string value", () => {
    it("throws InvalidBarcodeError for a number", () => {
      const { service } = makeService(10);
      expect(() => service.scan(10000001, T0)).toThrow(InvalidBarcodeError);
    });

    it("throws InvalidBarcodeError for null", () => {
      const { service } = makeService(10);
      expect(() => service.scan(null, T0)).toThrow(InvalidBarcodeError);
    });

    it("throws InvalidBarcodeError for undefined", () => {
      const { service } = makeService(10);
      expect(() => service.scan(undefined, T0)).toThrow(InvalidBarcodeError);
    });
  });

  // ── 17. Barcode preserved as string ──────────────────────────────────────
  describe("barcode preserved as string", () => {
    it("stores leading zeros intact without numeric coercion", () => {
      const { service, visitRepo } = makeService(10);
      service.scan(DIANA.barcode, T0); // barcode = "00012345"

      const activeVisits = visitRepo.getActiveVisitsForStudent(DIANA.id);
      expect(activeVisits[0].barcode).toBe("00012345");
      expect(activeVisits[0].barcode).not.toBe("12345");
    });
  });
});
