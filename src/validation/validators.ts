import { InvalidBarcodeError } from "../domain/errors";

/**
 * Validates that a raw scan value is a usable barcode string.
 *
 * Rules:
 *  - Must be of type `string` (rejects numbers, null, undefined, etc.)
 *  - Must not be empty or contain only whitespace
 *
 * Barcode values are intentionally kept as strings throughout the system
 * to preserve leading zeros (e.g. "00012345" must not become 12345).
 *
 * @throws {InvalidBarcodeError} if the value fails any check.
 */
export function validateBarcode(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new InvalidBarcodeError(
      `Barcode must be a string, received: ${typeof value} (${String(value)})`
    );
  }

  if (value.trim().length === 0) {
    throw new InvalidBarcodeError(
      "Barcode must not be empty or whitespace-only"
    );
  }
}
