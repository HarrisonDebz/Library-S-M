# Library Space Monitor (LSM)

Tracks library occupancy through student barcode scans. Students scan in on entry and out on exit; the system determines the direction automatically based on whether an active visit exists.

A companion web UI provides a **public status page** for students and a full **admin SPA** for staff — served locally via Vite with hot-module replacement.

---

## Project structure

```
src/                          — Backend domain logic (TypeScript)
├── domain/
│   ├── models.ts             — Student, Visit, LibraryStatus, ScanResult, ScanAction
│   └── errors.ts             — Typed domain exceptions
├── repositories/
│   ├── interfaces.ts         — IStudentRepository, IVisitRepository
│   └── inMemory.ts           — In-memory implementations for dev/test
├── services/
│   └── libraryService.ts     — Core scan orchestration
└── validation/
    └── validators.ts         — Barcode validation

ui/                           — Frontend (HTML / Vanilla CSS / JS)
├── index.html                — Public status page (real-time occupancy)
├── admin.html                — Admin SPA (Dashboard · History · Settings)
├── styles/
│   ├── main.css              — Public page styles
│   └── admin.css             — Admin panel styles
└── scripts/
    ├── status.js             — Public page logic
    └── admin.js              — Admin SPA logic (section router, all page logic)

tests/
└── libraryService.test.ts    — 30+ deterministic test cases

vite.config.mjs               — Vite dev server config (root: ui/)
```

---

## UI — Pages

### Public Status Page (`/`)
A read-only occupancy dashboard for students and visitors.

- Live occupancy percentage with colour-coded status ring
- Available spaces counter and zone-level breakdown
- Auto-refreshes every 30 seconds

### Admin SPA (`/admin.html`)
A single-page application for library staff. Navigation is handled client-side with no page reloads.

| Section | Features |
|---|---|
| **Dashboard** | Real-time stat cards (occupancy, capacity %, avg visit duration, peak hour), hourly bar chart, recent alerts, system notice banner |
| **History** | Visit log table with entry/exit badges, zone filter pills, live search, period selector (7/30/90 days), CSV export, pagination |
| **Settings** | Global capacity + threshold triggers (Moderate / Busy / Full), operational hours, admin access control table, Save/Cancel with toast feedback |
| **Sign Out** | Confirm dialog → redirects to public status page |

---

## Getting started

### Install dependencies

```bash
npm install
```

### Run the dev server (UI)

```bash
npm run dev
```

Opens **http://localhost:5173/admin.html** automatically. Both pages are available:

| URL | Page |
|---|---|
| `http://localhost:5173/` | Public status page |
| `http://localhost:5173/admin.html` | Admin SPA |

Vite provides **Hot Module Replacement** — edits to any file in `ui/` reflect instantly in the browser without a manual refresh.

### Run backend tests

```bash
npm test                # run all tests once
npm run test:watch      # re-run on file changes
npm run typecheck       # TypeScript type-check only (no emit)
```

### Build for production

```bash
npm run build    # outputs to dist/
npm run preview  # locally preview the production build
```

---

## Architecture — Backend

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


---

