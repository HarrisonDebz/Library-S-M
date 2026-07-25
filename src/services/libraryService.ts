import { randomUUID } from "crypto";
import type { Visit, ScanResult, LibraryStatus } from "../domain/models";
import { ScanAction } from "../domain/models";
import {
  UnknownStudentError,
  InactiveStudentError,
  RapidScanError,
  LibraryFullError,
  DuplicateActiveVisitError,
} from "../domain/errors";
import type { IStudentRepository, IVisitRepository } from "../repositories/interfaces";
import { validateBarcode } from "../validation/validators";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface LibraryServiceOptions {
  /** Maximum number of students allowed inside simultaneously. */
  readonly capacity: number;
  /**
   * Minimum number of seconds that must elapse between two scans of the same
   * barcode. Prevents an accidental double-tap from immediately reversing a
   * check-in or check-out.
   * @default 5
   */
  readonly minScanIntervalSeconds?: number;
  /**
   * Optional ID generator override — inject a deterministic function in tests
   * to produce predictable visit IDs.
   * @default crypto.randomUUID
   */
  readonly generateId?: () => string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Core business logic for the Library Space Monitor.
 *
 * Responsibilities:
 *  - Orchestrate check-in and check-out flows triggered by barcode scans
 *  - Enforce capacity limits, duplicate-scan protection, and integrity guards
 *  - Keep public occupancy data (LibraryStatus) separate from private records
 *
 * All timestamps are accepted as parameters — the service never calls
 * Date.now() internally, which makes it fully deterministic under test.
 */
export class LibraryService {
  private readonly students: IStudentRepository;
  private readonly visits: IVisitRepository;
  private readonly capacity: number;
  private readonly minScanIntervalSeconds: number;
  private readonly generateId: () => string;

  constructor(
    students: IStudentRepository,
    visits: IVisitRepository,
    options: LibraryServiceOptions
  ) {
    if (options.capacity < 0) {
      throw new RangeError("Library capacity must be >= 0");
    }
    this.students = students;
    this.visits = visits;
    this.capacity = options.capacity;
    this.minScanIntervalSeconds = options.minScanIntervalSeconds ?? 5;
    this.generateId = options.generateId ?? (() => randomUUID());
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Processes a barcode scan.
   *
   * If the student is currently outside → CHECK_IN (subject to capacity).
   * If the student is currently inside  → CHECK_OUT (subject to minimum interval).
   *
   * @param barcode  The raw value from the barcode scanner (must be a string).
   * @param scannedAt  The moment the scan occurred (caller-supplied for determinism).
   * @returns A ScanResult containing the action taken and current occupancy snapshot.
   * @throws {InvalidBarcodeError}       Barcode is not a non-empty string.
   * @throws {UnknownStudentError}       No student registered for this barcode.
   * @throws {InactiveStudentError}      Student account is deactivated.
   * @throws {DuplicateActiveVisitError} Data integrity violation detected.
   * @throws {LibraryFullError}          Check-in attempted at full capacity.
   * @throws {RapidScanError}            Re-scan before minimum interval elapsed.
   */
  scan(barcode: unknown, scannedAt: Date): ScanResult {
    // 1. Validate barcode format
    validateBarcode(barcode);

    // 2. Resolve student
    const student = this.students.getByBarcode(barcode);
    if (!student) {
      throw new UnknownStudentError(barcode);
    }

    // 3. Reject inactive accounts
    if (!student.isActive) {
      throw new InactiveStudentError(barcode);
    }

    // 4. Fetch active visits — more than one is a data integrity violation
    const activeVisits = this.visits.getActiveVisitsForStudent(student.id);
    if (activeVisits.length > 1) {
      throw new DuplicateActiveVisitError(student.id);
    }

    const activeVisit = activeVisits[0]; // undefined when student is outside

    if (activeVisit === undefined) {
      return this.checkIn(student.id, barcode, scannedAt);
    } else {
      return this.checkOut(activeVisit, scannedAt);
    }
  }

  /**
   * Returns the current library occupancy snapshot without requiring a scan.
   * Safe to expose publicly — contains no student or visit identifiers.
   */
  getStatus(): LibraryStatus {
    return this.buildStatus();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private checkIn(studentId: string, barcode: string, scannedAt: Date): ScanResult {
    const currentOccupancy = this.visits.countActiveVisits();

    // Students already inside can always check out; new entrants are blocked when full
    if (currentOccupancy >= this.capacity) {
      throw new LibraryFullError(this.capacity);
    }

    const visit: Visit = {
      id: this.generateId(),
      studentId,
      barcode,
      checkInTime: scannedAt,
      checkOutTime: null,
      durationSeconds: null,
      isActive: true,
    };

    this.visits.add(visit);

    return {
      action: ScanAction.CHECK_IN,
      visitId: visit.id,
      occupancy: this.buildStatus(),
      scannedAt,
    };
  }

  private checkOut(activeVisit: Visit, scannedAt: Date): ScanResult {
    const elapsedSeconds =
      (scannedAt.getTime() - activeVisit.checkInTime.getTime()) / 1000;

    if (elapsedSeconds < this.minScanIntervalSeconds) {
      throw new RapidScanError(activeVisit.barcode, elapsedSeconds);
    }

    // Create a closed copy — original object in the repo is replaced by update()
    const closedVisit: Visit = {
      ...activeVisit,
      checkOutTime: scannedAt,
      durationSeconds: elapsedSeconds,
      isActive: false,
    };

    this.visits.update(closedVisit);

    return {
      action: ScanAction.CHECK_OUT,
      visitId: closedVisit.id,
      occupancy: this.buildStatus(),
      scannedAt,
    };
  }

  private buildStatus(): LibraryStatus {
    const currentOccupancy = this.visits.countActiveVisits();
    // Clamp to zero — availableSpaces must never be negative
    const availableSpaces = Math.max(0, this.capacity - currentOccupancy);
    const occupancyPercentage =
      this.capacity > 0
        ? Math.min(100, (currentOccupancy / this.capacity) * 100)
        : 0;

    return {
      capacity: this.capacity,
      currentOccupancy,
      availableSpaces,
      occupancyPercentage,
    };
  }
}
