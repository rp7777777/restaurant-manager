// ============================================
// SERVORA ERP — Employee Number Service
// ✅ Auto-generate employee numbers
// ✅ Prefix regex — exact match only
// ✅ Race condition warning — UI helper only
// ✅ Final duplicate protection → checkDuplicateEmployeeNumber()
// ✅ No UI, No Context, No AppContext
// FROZEN
// ============================================

import { EmployeeDB } from "../types/employee-types";

// ── Generate Employee Number ──────────────────
// Format: {prefix}{paddedNumber}
// Default: EMP001, EMP002, EMP003...
// Custom:  REST001, HR001, etc.
//
// ⚠️ Race Condition Warning:
// This is a UI helper only — suggests next number client-side.
// Two managers creating employees simultaneously may get same number.
// Final duplicate protection MUST be done via:
//   checkDuplicateEmployeeNumber() in employee-service.ts
//   + Firestore transaction if strict uniqueness required.

export interface GenerateEmployeeNumberOptions {
  prefix?: string;      // default: "EMP"
  padLength?: number;   // default: 3 → EMP001
  existingEmployees: Pick<EmployeeDB, "employeeNumber">[];
}

export function generateEmployeeNumber(
  options: GenerateEmployeeNumberOptions
): string {
  const {
    prefix    = "EMP",
    padLength = 3,
    existingEmployees,
  } = options;

  // ✅ Fix #2 — regex exact match
  // EMP → matches EMP001 not EMPLOYEE001
  const regex = new RegExp(`^${prefix}\\d+$`);

  const existingNumbers = existingEmployees
    .map((e) => e.employeeNumber)
    .filter((n) => regex.test(n))
    .map((n) => {
      const numPart = n.slice(prefix.length);
      const parsed  = parseInt(numPart, 10);
      return isNaN(parsed) ? 0 : parsed;
    });

  const maxNumber  = existingNumbers.length > 0
    ? Math.max(...existingNumbers)
    : 0;

  const nextNumber = maxNumber + 1;

  return `${prefix}${String(nextNumber).padStart(padLength, "0")}`;
}

// ── Check availability ────────────────────────
export function isEmployeeNumberAvailable(
  employeeNumber: string,
  existingEmployees: Pick<EmployeeDB, "id" | "employeeNumber">[],
  excludeId?: string,
): boolean {
  return !existingEmployees.some(
    (e) =>
      e.employeeNumber.trim().toLowerCase() ===
      employeeNumber.trim().toLowerCase() &&
      e.id !== excludeId
  );
}

// ── Suggest next available ────────────────────
// EMP003 taken → EMP004
// ⚠️ UI helper only — same race condition caveat applies
export function suggestNextAvailable(
  preferred: string,
  existingEmployees: Pick<EmployeeDB, "id" | "employeeNumber">[],
  excludeId?: string,
): string {
  if (isEmployeeNumberAvailable(preferred, existingEmployees, excludeId)) {
    return preferred;
  }

  const match = preferred.match(/^([A-Za-z]*)(\d+)$/);
  if (!match) return preferred;

  const prefix    = match[1];
  const padLength = match[2].length;
  let   num       = parseInt(match[2], 10);

  let attempts = 0;
  while (attempts < 1000) {
    num++;
    attempts++;
    const candidate = `${prefix}${String(num).padStart(padLength, "0")}`;
    if (isEmployeeNumberAvailable(candidate, existingEmployees, excludeId)) {
      return candidate;
    }
  }

  return preferred;
}