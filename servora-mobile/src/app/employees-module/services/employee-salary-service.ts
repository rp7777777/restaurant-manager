// ============================================
// SERVORA ERP — Employee Salary Service
// ✅ Settings-injected — no hardcoded rules
// ✅ Snapshot deep copy — immutable freeze
// ✅ Unused imports removed
// ✅ SS calculation — caller provides base
// ✅ No UI, No Firestore, No Context
// FROZEN
// ============================================

import {
  EmployeeDB,
  EmployeeAllowance,
  EmployeeSalarySnapshot,
} from "../types/employee-types";
import {
  getFullName,
  getHourlyRate,
} from "../utils/employee-calculations";
import { PAYROLL_DEFAULTS } from "../constants/payroll-defaults";

// ── Settings injection ────────────────────────
// Caller provides from AppContext / Settings Module
// ✅ No country-specific hardcoding here
export interface PayrollSettings {
  defaultTaxRate:      number;   // from settings
  defaultSSRate:       number;   // from settings
  monthlyHours:        number;   // from settings
  workingDaysPerMonth: number;   // from settings
  // ✅ SS base rule — caller decides (worldwide flexibility)
  // "BASIC_ONLY"  → SS on basicSalary only (Portugal, Spain)
  // "GROSS"       → SS on grossSalary (some countries)
  ssCalculationBase: "BASIC_ONLY" | "GROSS";
}

// ── Effective rates ───────────────────────────
// Employee override → Settings default
export function getEffectiveTaxRate(
  emp: Pick<EmployeeDB, "taxRate">,
  settings: Pick<PayrollSettings, "defaultTaxRate">,
): number {
  return emp.taxRate ?? settings.defaultTaxRate;
}

export function getEffectiveSSRate(
  emp: Pick<EmployeeDB, "ssRate">,
  settings: Pick<PayrollSettings, "defaultSSRate">,
): number {
  return emp.ssRate ?? settings.defaultSSRate;
}

// ── Allowance breakdown ───────────────────────
export function getTaxableAllowances(
  allowances: EmployeeAllowance[]
): number {
  return allowances
    .filter((a) => a.taxable)
    .reduce((sum, a) => sum + a.amount, 0);
}

export function getNonTaxableAllowances(
  allowances: EmployeeAllowance[]
): number {
  return allowances
    .filter((a) => !a.taxable)
    .reduce((sum, a) => sum + a.amount, 0);
}

// ── Tax calculation ───────────────────────────
// Tax applies on: basicSalary + taxable allowances
export function calculateTaxAmount(
  emp: Pick<EmployeeDB, "monthlySalary" | "allowances" | "taxRate">,
  settings: Pick<PayrollSettings, "defaultTaxRate">,
): number {
  const taxRate     = getEffectiveTaxRate(emp, settings);
  const taxableBase = emp.monthlySalary + getTaxableAllowances(emp.allowances);
  return parseFloat(
    ((taxableBase * taxRate) / 100).toFixed(PAYROLL_DEFAULTS.SALARY_DECIMAL_PLACES)
  );
}

// ── SS calculation ────────────────────────────
// ✅ Fix #1 — ssCalculationBase from settings
// "BASIC_ONLY" → SS on basicSalary (Portugal, Spain)
// "GROSS"      → SS on grossSalary (other countries)
export function calculateSSAmount(
  emp: Pick<EmployeeDB, "monthlySalary" | "allowances" | "ssRate">,
  settings: Pick<PayrollSettings, "defaultSSRate" | "ssCalculationBase">,
): number {
  const ssRate = getEffectiveSSRate(emp, settings);
  const ssBase = settings.ssCalculationBase === "GROSS"
    ? emp.monthlySalary +
      getTaxableAllowances(emp.allowances) +
      getNonTaxableAllowances(emp.allowances)
    : emp.monthlySalary; // BASIC_ONLY default
  return parseFloat(
    ((ssBase * ssRate) / 100).toFixed(PAYROLL_DEFAULTS.SALARY_DECIMAL_PLACES)
  );
}

// ── Net salary ────────────────────────────────
export interface NetSalaryResult {
  monthlySalary:        number;
  taxableAllowances:    number;
  nonTaxableAllowances: number;
  grossSalary:          number;
  taxAmount:            number;
  ssAmount:             number;
  totalDeductions:      number;
  netSalary:            number;
}

export function calculateNetSalary(
  emp: Pick<EmployeeDB, "monthlySalary" | "allowances" | "taxRate" | "ssRate">,
  settings: PayrollSettings,
): NetSalaryResult {
  const taxableAllowances    = getTaxableAllowances(emp.allowances);
  const nonTaxableAllowances = getNonTaxableAllowances(emp.allowances);
  const grossSalary          = emp.monthlySalary + taxableAllowances + nonTaxableAllowances;
  const taxAmount            = calculateTaxAmount(emp, settings);
  const ssAmount             = calculateSSAmount(emp, settings);
  const totalDeductions      = parseFloat(
    (taxAmount + ssAmount).toFixed(PAYROLL_DEFAULTS.SALARY_DECIMAL_PLACES)
  );
  const netSalary            = parseFloat(
    (grossSalary - totalDeductions).toFixed(PAYROLL_DEFAULTS.SALARY_DECIMAL_PLACES)
  );

  return {
    monthlySalary: emp.monthlySalary,
    taxableAllowances,
    nonTaxableAllowances,
    grossSalary,
    taxAmount,
    ssAmount,
    totalDeductions,
    netSalary,
  };
}

// ── Salary Snapshot ───────────────────────────
// ✅ Deep copy — immutable freeze
// Future salary changes won't affect historical payslips
export function createSalarySnapshot(
  emp: EmployeeDB,
): EmployeeSalarySnapshot {
  return {
    employeeNumber: emp.employeeNumber,
    fullName:       getFullName(emp),
    role:           emp.role,
    accessLevel:    emp.accessLevel,
    position:       emp.position,
    contractType:   emp.contractType,
    paymentMode:    emp.paymentMode,
    monthlySalary:  emp.monthlySalary,
    hourlyRate:     emp.hourlyRate,
    dailyHours:     emp.dailyHours,
    weeklyHours:    emp.weeklyHours,
    taxRate:        emp.taxRate,
    ssRate:         emp.ssRate,
    maritalStatus:  emp.maritalStatus,
    dependents:     emp.dependents,

    // ✅ Fix #3 — deep copy allowances array
    allowances: emp.allowances.map((a) => ({ ...a })),

    // ✅ Fix #4 — deep copy additionalPayEligible
    additionalPayEligible: emp.additionalPayEligible
      ? { ...emp.additionalPayEligible }
      : undefined,

    restaurantId:   emp.restaurantId,
    restaurantName: emp.restaurantName,
  };
}

// ── Effective hourly rate ─────────────────────
export function getEffectiveHourlyRate(
  emp: Pick<EmployeeDB, "hourlyRate" | "monthlySalary">,
  settings: Pick<PayrollSettings, "monthlyHours">,
): number {
  return getHourlyRate(emp, settings.monthlyHours);
}