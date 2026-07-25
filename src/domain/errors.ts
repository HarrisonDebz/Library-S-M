/**
 * Raised when the supplied barcode is not a string,
 * or is empty / whitespace-only.
 */
export class InvalidBarcodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBarcodeError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when no student record is found for the scanned barcode.
 */
export class UnknownStudentError extends Error {
  constructor(barcode: string) {
    super(`No student found for barcode: "${barcode}"`);
    this.name = "UnknownStudentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when the student exists but their account has been deactivated.
 */
export class InactiveStudentError extends Error {
  constructor(barcode: string) {
    super(`Student with barcode "${barcode}" is inactive`);
    this.name = "InactiveStudentError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when a student re-scans before the minimum scan interval has elapsed.
 * Prevents an accidental double-tap from immediately reversing a check-in or check-out.
 */
export class RapidScanError extends Error {
  constructor(barcode: string, elapsedSeconds: number) {
    super(
      `Rapid scan rejected for barcode "${barcode}": only ${elapsedSeconds.toFixed(1)}s elapsed (minimum interval required)`
    );
    this.name = "RapidScanError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when a check-in is attempted and the library is at full capacity.
 */
export class LibraryFullError extends Error {
  constructor(capacity: number) {
    super(`Library is at full capacity (${capacity}). No new check-ins allowed.`);
    this.name = "LibraryFullError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised as a data-integrity safety guard when a student is found
 * to have more than one active visit simultaneously — which should
 * never happen under normal operation.
 */
export class DuplicateActiveVisitError extends Error {
  constructor(studentId: string) {
    super(
      `Data integrity violation: student "${studentId}" has multiple concurrent active visits`
    );
    this.name = "DuplicateActiveVisitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
