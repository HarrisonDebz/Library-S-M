import type { Student, Visit } from "../domain/models";
import type { IStudentRepository, IVisitRepository } from "./interfaces";

// ─── In-memory student repository ────────────────────────────────────────────

/**
 * Volatile, in-memory implementation of IStudentRepository.
 * Suitable for development and unit testing.
 * All data is lost when the process exits.
 */
export class InMemoryStudentRepository implements IStudentRepository {
  private readonly store = new Map<string, Student>();

  getByBarcode(barcode: string): Student | undefined {
    return this.store.get(barcode);
  }

  add(student: Student): void {
    this.store.set(student.barcode, student);
  }

  listAll(): ReadonlyArray<Student> {
    return Array.from(this.store.values());
  }
}

// ─── In-memory visit repository ───────────────────────────────────────────────

/**
 * Volatile, in-memory implementation of IVisitRepository.
 * Keyed by visit ID. Suitable for development and unit testing.
 */
export class InMemoryVisitRepository implements IVisitRepository {
  private readonly store = new Map<string, Visit>();

  getActiveVisitsForStudent(studentId: string): ReadonlyArray<Visit> {
    const active: Visit[] = [];
    for (const visit of this.store.values()) {
      if (visit.studentId === studentId && visit.isActive) {
        active.push(visit);
      }
    }
    return active;
  }

  countActiveVisits(): number {
    let count = 0;
    for (const visit of this.store.values()) {
      if (visit.isActive) count++;
    }
    return count;
  }

  add(visit: Visit): void {
    this.store.set(visit.id, visit);
  }

  update(visit: Visit): void {
    if (!this.store.has(visit.id)) {
      throw new Error(`Visit "${visit.id}" not found — cannot update a non-existent record`);
    }
    this.store.set(visit.id, visit);
  }

  getHistory(studentId: string): ReadonlyArray<Visit> {
    return Array.from(this.store.values()).filter(
      (v) => v.studentId === studentId
    );
  }

  listAllActive(): ReadonlyArray<Visit> {
    return Array.from(this.store.values()).filter((v) => v.isActive);
  }
}
