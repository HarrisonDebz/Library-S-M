import type { Student } from "../domain/models";
import type { Visit } from "../domain/models";

// ─── Student repository ───────────────────────────────────────────────────────

/**
 * Persistence contract for student records.
 * Swap this implementation to move from in-memory to a real database.
 */
export interface IStudentRepository {
  /** Returns the student whose barcode matches, or undefined if not found. */
  getByBarcode(barcode: string): Student | undefined;

  /** Persists a new student record. */
  add(student: Student): void;

  /** Returns all registered students. */
  listAll(): ReadonlyArray<Student>;
}

// ─── Visit repository ─────────────────────────────────────────────────────────

/**
 * Persistence contract for visit records.
 * Swap this implementation to move from in-memory to a real database.
 */
export interface IVisitRepository {
  /**
   * Returns all active visits for a given student.
   * Under normal operation this will contain 0 or 1 item.
   * More than 1 indicates a data integrity violation.
   */
  getActiveVisitsForStudent(studentId: string): ReadonlyArray<Visit>;

  /** Returns the total number of currently active visits across all students. */
  countActiveVisits(): number;

  /** Persists a new visit record. */
  add(visit: Visit): void;

  /** Replaces an existing visit record (used when closing a visit on check-out). */
  update(visit: Visit): void;

  /** Returns the complete visit history for a student (active and completed). */
  getHistory(studentId: string): ReadonlyArray<Visit>;

  /** Returns all currently active visits across all students. */
  listAllActive(): ReadonlyArray<Visit>;
}
