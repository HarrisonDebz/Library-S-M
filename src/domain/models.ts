// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ScanAction {
  CHECK_IN = "CHECK_IN",
  CHECK_OUT = "CHECK_OUT",
}

// ─── Core domain entities ─────────────────────────────────────────────────────

/**
 * Represents a registered library patron.
 * Barcode is always stored as a string to preserve leading zeros.
 */
export interface Student {
  readonly id: string;
  readonly name: string;
  /** Stored as a string — never cast to a number. */
  readonly barcode: string;
  readonly isActive: boolean;
}

/**
 * Represents a single library visit (one entry/exit pair).
 * A visit is "active" while the student is inside.
 */
export interface Visit {
  readonly id: string;
  readonly studentId: string;
  /** Snapshot of the barcode used at check-in, for audit purposes. */
  readonly barcode: string;
  readonly checkInTime: Date;
  /** Populated when the student checks out. */
  checkOutTime: Date | null;
  /** Duration in seconds; populated when the student checks out. */
  durationSeconds: number | null;
  /** True while the student is inside; false after check-out. */
  isActive: boolean;
}

// ─── Public-facing occupancy data (no PII) ───────────────────────────────────

/**
 * Snapshot of current library occupancy.
 * Contains no student or visit identifiers — safe to expose publicly.
 */
export interface LibraryStatus {
  readonly capacity: number;
  readonly currentOccupancy: number;
  /** Always >= 0. */
  readonly availableSpaces: number;
  /** Value between 0 and 100 (inclusive). */
  readonly occupancyPercentage: number;
}

// ─── Scan result ──────────────────────────────────────────────────────────────

/**
 * The response returned from every successful barcode scan.
 * Deliberately excludes private student/visit data.
 */
export interface ScanResult {
  readonly action: ScanAction;
  readonly visitId: string;
  readonly occupancy: LibraryStatus;
  readonly scannedAt: Date;
}
