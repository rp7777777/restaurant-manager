// ============================================
// SERVORA ERP — Payroll Calculator
// ✅ SS base fixed — taxable items only
// ✅ Negative net salary protection
// ✅ estimateNetSalary taxable allowances fix
// ✅ Attendance validation
// ============================================

import {
  PayrollSnapshot,
  PayrollCalculation,
  AllowanceItem,
} from "../types/payroll-types";

const r = (n: number) => Math.round(n * 100) / 100;

interface AttendanceInput {
  workingDays: number;
  totalDays: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
}

// ✅ Safe attendance — negative values block garxa
function safeAttendance(attendance: AttendanceInput): AttendanceInput {
  return {
    workingDays:   Math.max(0, attendance.workingDays),
    totalDays:     Math.max(1, attendance.totalDays),
    overtimeHours: Math.max(0, attendance.overtimeHours),
    nightHours:    Math.max(0, attendance.nightHours),
    holidayHours:  Math.max(0, attendance.holidayHours),
  };
}

/**
 * Core payroll calculation
 * ✅ Snapshot-based — historical accuracy guaranteed
 * ✅ SS on earned income only (not non-taxable allowances)
 * ✅ Tax on taxable items only
 * ✅ Net salary cannot be negative
 */
export function calculatePayroll(
  snapshot: PayrollSnapshot,
  attendance: AttendanceInput,
  allowances: AllowanceItem[],
  otherDeductions = 0
): PayrollCalculation {
  const {
    basicSalary, hourlyRate,
    overtimeRate, holidayRate, nightRate,
    taxRate, ssRate,
  } = snapshot;

  const safe = safeAttendance(attendance);
  const { workingDays, totalDays, overtimeHours, nightHours, holidayHours } = safe;

  const safeDays  = totalDays > 0 ? totalDays : 30;
  const dailyRate = basicSalary / safeDays;

  // ── Earnings ────────────────────────────
  const earnedBasic = r(dailyRate * workingDays);
  const overtimePay = r(overtimeHours * hourlyRate * overtimeRate);
  const holidayPay  = r(holidayHours * hourlyRate * holidayRate);
  const nightPay    = r(nightHours * hourlyRate * (nightRate - 1));

  // ── Allowances ──────────────────────────
  const taxableAllowances    = r(allowances.filter((a) => a.taxable).reduce((s, a) => s + a.amount, 0));
  const nonTaxableAllowances = r(allowances.filter((a) => !a.taxable).reduce((s, a) => s + a.amount, 0));

  // ── Gross ───────────────────────────────
  const grossSalary = r(
    earnedBasic + overtimePay + holidayPay +
    nightPay + taxableAllowances + nonTaxableAllowances
  );

  // ── Tax — taxable items only ─────────────
  const taxableBase = earnedBasic + overtimePay + holidayPay + nightPay + taxableAllowances;
  const taxAmount   = r((taxableBase * taxRate) / 100);

  // ✅ SS — earned income only (not non-taxable allowances)
  const ssBase               = earnedBasic + overtimePay + holidayPay + nightPay;
  const socialSecurityAmount = r((ssBase * ssRate) / 100);

  // ✅ Net — cannot be negative
 const safeOtherDeductions = Math.max(0, otherDeductions);
 const netSalary = r(Math.max(
  0,
  grossSalary - taxAmount - socialSecurityAmount - safeOtherDeductions
 ));

  return {
    earnedBasic,
    overtimePay,
    holidayPay,
    nightPay,
    taxableAllowances,
    nonTaxableAllowances,
    grossSalary,
    taxAmount,
    socialSecurityAmount,
    netSalary,
  };
}

/**
 * Quick net salary estimate
 * ✅ Taxable allowances included in tax base
 * Used in Employee form salary preview
 */
export function estimateNetSalary(
  basicSalary: number,
  taxRate: number,
  ssRate: number,
  allowances: AllowanceItem[] = []
): number {
  const taxableAllowances    = allowances.filter((a) => a.taxable).reduce((s, a) => s + a.amount, 0);
  const nonTaxableAllowances = allowances.filter((a) => !a.taxable).reduce((s, a) => s + a.amount, 0);
  const gross                = basicSalary + taxableAllowances + nonTaxableAllowances;
  // ✅ Tax on basic + taxable allowances
  const taxableBase          = basicSalary + taxableAllowances;
  const tax                  = r((taxableBase * taxRate) / 100);
  const ss                   = r((basicSalary * ssRate) / 100);
  return r(Math.max(0, gross - tax - ss));
}