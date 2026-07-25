# Library Space Monitor

Tracks library occupancy through student barcode scans. Students scan in on entry and out on exit; the system determines the direction automatically based on whether an active visit exists.

---

## Architecture

```
src/
├── domain/
│   ├── models.ts       — Student, Visit, LibraryStatus, ScanResult, ScanAction
│   └── errors.ts       — Typed domain exceptions
├── repositories/
│   ├── interfaces.ts   — IStudentRepository, IVisitRepository (swap freely)
│   └── inMemory.ts     — In-memory implementations for dev/test
├── services/
│   └── libraryService.ts  — Core scan orchestration (the heart of the system)
└── validation/
    └── validators.ts   — Barcode validation (assertion function)

tests/
└── libraryService.test.ts  — 30+ deterministic test cases
```

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| **Domain** | Pure data shapes and typed exceptions — no side-effects |
| **Repositories** | Persistence abstraction; swap in-memory for DB without touching service |
| **Services** | Business rules: check-in/out flow, capacity, scan-interval, integrity guards |
| **Validation** | Stateless barcode format checking |

---

## Business rules

| Rule | Behaviour |
|---|---|
| Scan direction | Check-in if no active visit; check-out if one exists |
| Capacity | Reject new check-ins when full; always allow check-outs |
| Rapid scan | Reject re-scans within the minimum interval (default: 5 s) |
| Inactive accounts | Rejected at the gate regardless of direction |
| Barcodes | Always stored as strings — leading zeros are preserved |
| Available spaces | Clamped to `max(0, capacity − occupancy)` — never negative |
| Privacy | `ScanResult` exposes only `LibraryStatus`; no student PII is leaked |
| Integrity guard | `DuplicateActiveVisitError` if a student somehow acquires two active visits |

---

## Getting started

```bash
npm install
npm test          # run all tests once
npm run test:watch  # re-run on file changes
npm run typecheck   # tsc type-check only (no emit)
```

---

## Domain types

```ts
// Public occupancy snapshot — safe to expose via an API
interface LibraryStatus {
  capacity: number;
  currentOccupancy: number;
  availableSpaces: number;      // always >= 0
  occupancyPercentage: number;  // 0–100
}

// Returned by every successful scan
interface ScanResult {
  action: ScanAction;    // CHECK_IN | CHECK_OUT
  visitId: string;
  occupancy: LibraryStatus;
  scannedAt: Date;
}
```

---

## Extending the persistence layer

Implement `IStudentRepository` and `IVisitRepository` from `src/repositories/interfaces.ts` and pass the implementations to `LibraryService`. The service has no knowledge of how data is stored.

```ts
import { LibraryService } from "./src/services/libraryService";
import { PostgresStudentRepository } from "./src/repositories/postgres"; // your impl

const service = new LibraryService(
  new PostgresStudentRepository(pool),
  new PostgresVisitRepository(pool),
  { capacity: 200, minScanIntervalSeconds: 5 }
);
```
