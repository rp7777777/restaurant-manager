// ============================================
// SERVORA ERP — Employee Validation
// ✅ Pure validation functions only
// ✅ validateISODate — UTC fix, timezone safe
// ✅ validateEmployee — create
// ✅ validateEmployeeUpdate — partial update
// ✅ duplicate check — empty string guard
// FROZEN
// ============================================

import {
  EmployeeDB,
  PaymentMode,
} from "../types/employee-types";
import {
  isValidEmployeeRole,
  isValidAccessLevel,
} from "../constants/employee-roles";
import {
  isValidContractType,
  isValidPaymentMode,
} from "../constants/contract-types";
import { isValidEmployeeStatus } from "../constants/employee-status";

// ── Validation Result ─────────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

function ok(): ValidationResult {
  return { valid: true, errors: {} };
}

function fail(errors: Record<string, string>): ValidationResult {
  return { valid: false, errors };
}

// ── Field Validators ──────────────────────────

export function validateEmployeeNumber(value: string): string | null {
  if (!value?.trim()) return "Employee number is required";
  if (value.trim().length > 20) return "Employee number max 20 characters";
  return null;
}

export function validateFirstName(value: string): string | null {
  if (!value?.trim()) return "First name is required";
  if (value.trim().length < 2) return "First name min 2 characters";
  if (value.trim().length > 50) return "First name max 50 characters";
  return null;
}

export function validateLastName(value: string): string | null {
  if (!value?.trim()) return "Last name is required";
  if (value.trim().length < 2) return "Last name min 2 characters";
  if (value.trim().length > 50) return "Last name max 50 characters";
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value?.trim()) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) return "Invalid email address";
  return null;
}

export function validatePhone(value: string): string | null {
  if (!value?.trim()) return null;
  const phoneRegex = /^[+\d\s\-()]{6,20}$/;
  if (!phoneRegex.test(value.trim())) return "Invalid phone number";
  return null;
}

// ✅ UTC fix — timezone mismatch hatayo
export function validateISODate(value: string, fieldName: string): string | null {
  if (!value?.trim()) return null;
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(value.trim())) return `${fieldName} must be YYYY-MM-DD format`;

  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    isNaN(date.getTime())           ||
    date.getUTCFullYear() !== y     ||
    date.getUTCMonth() + 1 !== m   ||
    date.getUTCDate() !== d
  ) {
    return `${fieldName} is invalid date`;
  }
  return null;
}

export function validateMonthlySalary(value: number): string | null {
  if (value < 0) return "Monthly salary cannot be negative";
  return null;
}

export function validateHourlyRate(value: number): string | null {
  if (value < 0) return "Hourly rate cannot be negative";
  return null;
}

export function validateSalaryRequired(
  monthlySalary: number,
  hourlyRate: number,
  paymentMode: PaymentMode,
): string | null {
  if (paymentMode === "MONTHLY" && monthlySalary <= 0) {
    return "Monthly salary required for monthly payment mode";
  }
  if (paymentMode === "HOURLY" && hourlyRate <= 0) {
    return "Hourly rate required for hourly payment mode";
  }
  return null;
}

export function validateTaxRate(value: number | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (value < 0 || value > 100) return "Tax rate must be between 0 and 100";
  return null;
}

export function validateSSRate(value: number | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (value < 0 || value > 100) return "Social security rate must be between 0 and 100";
  return null;
}

export function validateIBAN(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  if (value.trim().length < 15) return "IBAN too short";
  if (value.trim().length > 34) return "IBAN too long";
  return null;
}

export function validateRole(value: string): string | null {
  if (!isValidEmployeeRole(value)) return "Invalid employee role";
  return null;
}

export function validateAccessLevel(value: string): string | null {
  if (!isValidAccessLevel(value)) return "Invalid access level";
  return null;
}

export function validateContractType(value: string): string | null {
  if (!isValidContractType(value)) return "Invalid contract type";
  return null;
}

export function validatePaymentMode(value: string): string | null {
  if (!isValidPaymentMode(value)) return "Invalid payment mode";
  return null;
}

export function validateStatus(value: string): string | null {
  if (!isValidEmployeeStatus(value)) return "Invalid employee status";
  return null;
}

// ── Full Validation — Create ──────────────────
export function validateEmployee(
  data: Partial<EmployeeDB>
): ValidationResult {
  const errors: Record<string, string> = {};

  // Identity
  const empNoErr     = validateEmployeeNumber(data.employeeNumber ?? "");
  const firstNameErr = validateFirstName(data.firstName           ?? "");
  const lastNameErr  = validateLastName(data.lastName             ?? "");
  const emailErr     = validateEmail(data.email                   ?? "");
  const phoneErr     = validatePhone(data.phone                   ?? "");
  const birthDateErr = validateISODate(data.birthDate             ?? "", "Birth date");

  if (empNoErr)     errors.employeeNumber = empNoErr;
  if (firstNameErr) errors.firstName      = firstNameErr;
  if (lastNameErr)  errors.lastName       = lastNameErr;
  if (emailErr)     errors.email          = emailErr;
  if (phoneErr)     errors.phone          = phoneErr;
  if (birthDateErr) errors.birthDate      = birthDateErr;

  // Employment
  const roleErr     = validateRole(data.role               ?? "");
  const accessErr   = validateAccessLevel(data.accessLevel ?? "");
  const contractErr = validateContractType(data.contractType ?? "");
  const paymentErr  = validatePaymentMode(data.paymentMode   ?? "");
  const statusErr   = validateStatus(data.status             ?? "");
  const hireDateErr = validateISODate(data.hireDate          ?? "", "Hire date");
  const termDateErr = validateISODate(data.terminationDate   ?? "", "Termination date");

  if (roleErr)     errors.role            = roleErr;
  if (accessErr)   errors.accessLevel     = accessErr;
  if (contractErr) errors.contractType    = contractErr;
  if (paymentErr)  errors.paymentMode     = paymentErr;
  if (statusErr)   errors.status          = statusErr;
  if (hireDateErr) errors.hireDate        = hireDateErr;
  if (termDateErr) errors.terminationDate = termDateErr;

  // terminationDate >= hireDate
  if (data.hireDate && data.terminationDate) {
    const hire = new Date(data.hireDate);
    const term = new Date(data.terminationDate);
    if (term.getTime() < hire.getTime()) {
      errors.terminationDate = "Termination date cannot be before hire date";
    }
  }

  // Salary
  const salaryErr = validateMonthlySalary(data.monthlySalary ?? 0);
  const hourlyErr = validateHourlyRate(data.hourlyRate       ?? 0);
  const salReqErr = validateSalaryRequired(
    data.monthlySalary ?? 0,
    data.hourlyRate    ?? 0,
    data.paymentMode   ?? "MONTHLY",
  );
  const taxErr  = validateTaxRate(data.taxRate);
  const ssErr   = validateSSRate(data.ssRate);
  const ibanErr = validateIBAN(data.iban);

  if (salaryErr) errors.monthlySalary = salaryErr;
  if (hourlyErr) errors.hourlyRate    = hourlyErr;
  if (salReqErr) errors.salary        = salReqErr;
  if (taxErr)    errors.taxRate       = taxErr;
  if (ssErr)     errors.ssRate        = ssErr;
  if (ibanErr)   errors.iban          = ibanErr;

  return Object.keys(errors).length === 0 ? ok() : fail(errors);
}

// ── Partial Validation — Update ───────────────
export function validateEmployeeUpdate(
  data: Partial<EmployeeDB>
): ValidationResult {
  const errors: Record<string, string> = {};

  if ("employeeNumber" in data) {
    const err = validateEmployeeNumber(data.employeeNumber ?? "");
    if (err) errors.employeeNumber = err;
  }
  if ("firstName" in data) {
    const err = validateFirstName(data.firstName ?? "");
    if (err) errors.firstName = err;
  }
  if ("lastName" in data) {
    const err = validateLastName(data.lastName ?? "");
    if (err) errors.lastName = err;
  }
  if ("email" in data) {
    const err = validateEmail(data.email ?? "");
    if (err) errors.email = err;
  }
  if ("phone" in data) {
    const err = validatePhone(data.phone ?? "");
    if (err) errors.phone = err;
  }
  if ("birthDate" in data) {
    const err = validateISODate(data.birthDate ?? "", "Birth date");
    if (err) errors.birthDate = err;
  }
  if ("role" in data) {
    const err = validateRole(data.role ?? "");
    if (err) errors.role = err;
  }
  if ("accessLevel" in data) {
    const err = validateAccessLevel(data.accessLevel ?? "");
    if (err) errors.accessLevel = err;
  }
  if ("contractType" in data) {
    const err = validateContractType(data.contractType ?? "");
    if (err) errors.contractType = err;
  }
  if ("paymentMode" in data) {
    const err = validatePaymentMode(data.paymentMode ?? "");
    if (err) errors.paymentMode = err;
  }
  if ("status" in data) {
    const err = validateStatus(data.status ?? "");
    if (err) errors.status = err;
  }
  if ("hireDate" in data) {
    const err = validateISODate(data.hireDate ?? "", "Hire date");
    if (err) errors.hireDate = err;
  }
  if ("terminationDate" in data) {
    const err = validateISODate(data.terminationDate ?? "", "Termination date");
    if (err) errors.terminationDate = err;
  }
  if ("monthlySalary" in data) {
    const err = validateMonthlySalary(data.monthlySalary ?? 0);
    if (err) errors.monthlySalary = err;
  }
  if ("hourlyRate" in data) {
    const err = validateHourlyRate(data.hourlyRate ?? 0);
    if (err) errors.hourlyRate = err;
  }
  if ("taxRate" in data) {
    const err = validateTaxRate(data.taxRate);
    if (err) errors.taxRate = err;
  }
  if ("ssRate" in data) {
    const err = validateSSRate(data.ssRate);
    if (err) errors.ssRate = err;
  }
  if ("iban" in data) {
    const err = validateIBAN(data.iban);
    if (err) errors.iban = err;
  }

  // terminationDate >= hireDate
  if (data.hireDate && data.terminationDate) {
    if (
      new Date(data.terminationDate).getTime() <
      new Date(data.hireDate).getTime()
    ) {
      errors.terminationDate = "Termination date cannot be before hire date";
    }
  }

  return Object.keys(errors).length === 0 ? ok() : fail(errors);
}

// ── Duplicate Check ───────────────────────────
export function checkDuplicateEmployeeNumber(
  employeeNumber: string,
  existingEmployees: Pick<EmployeeDB, "id" | "employeeNumber">[],
  excludeId?: string,
): string | null {
  if (!employeeNumber.trim()) return null;
  const dup = existingEmployees.find(
    (e) =>
      e.employeeNumber.trim().toLowerCase() ===
      employeeNumber.trim().toLowerCase() &&
      e.id !== excludeId
  );
  if (dup) return `Employee number "${employeeNumber}" already exists`;
  return null;
}