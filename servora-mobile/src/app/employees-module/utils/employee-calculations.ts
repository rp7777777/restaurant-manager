// ============================================
// SERVORA ERP — Employee Calculations
// ✅ Pure functions only
// ✅ No Firestore, No Settings, No UI, No Context
// ✅ getMonthsWorked — day-level precision fixed
// ✅ getAge — future date protection
// ✅ WEEKS_PER_MONTH — no magic numbers
// ✅ isTerminated + isOnLeave helpers added
// FROZEN
// ============================================

import {
  EmployeeDB,
  LeaveBalance,
} from "../types/employee-types";

// ── Constants ─────────────────────────────────
const WEEKS_PER_MONTH = 4.33;

// ── Identity ──────────────────────────────────

export function getFullName(
  emp: Pick<EmployeeDB, "firstName" | "lastName">
): string {
  return `${emp.firstName} ${emp.lastName}`.trim();
}

export function getInitials(
  emp: Pick<EmployeeDB, "firstName" | "lastName">
): string {
  const first = emp.firstName?.charAt(0)?.toUpperCase() ?? "";
  const last  = emp.lastName?.charAt(0)?.toUpperCase()  ?? "";
  return `${first}${last}`;
}

// ── Employment ────────────────────────────────

// ✅ Fix #1 — day-level precision
// June 30 hire → July 1 = 0 months (not 1)
export function getMonthsWorked(hireDate: string): number {
  if (!hireDate) return 0;
  const hire = new Date(hireDate);
  const now  = new Date();

  let months =
    (now.getFullYear() - hire.getFullYear()) * 12 +
    (now.getMonth() - hire.getMonth());

  if (now.getDate() < hire.getDate()) {
    months--;
  }

  return Math.max(0, months);
}

// Completed years from hireDate
export function getYearsWorked(hireDate: string): number {
  if (!hireDate) return 0;
  return Math.floor(getMonthsWorked(hireDate) / 12);
}

// ✅ Fix #2 — future date protection
export function getAge(birthDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

// Probation active = hireDate + probationDays > today
export function isProbationActive(
  emp: Pick<EmployeeDB, "hireDate" | "probationDays">
): boolean {
  if (!emp.hireDate) return false;
  const hire = new Date(emp.hireDate);
  const probationEnd = new Date(hire);
  probationEnd.setDate(probationEnd.getDate() + emp.probationDays);
  return new Date() < probationEnd;
}

// ── Status Helpers ────────────────────────────

export function isActiveEmployee(
  emp: Pick<EmployeeDB, "status">
): boolean {
  return emp.status === "ACTIVE" || emp.status === "PROBATION";
}

// ✅ New helpers
export function isTerminatedEmployee(
  emp: Pick<EmployeeDB, "status">
): boolean {
  return emp.status === "TERMINATED";
}

export function isOnLeaveEmployee(
  emp: Pick<EmployeeDB, "status">
): boolean {
  return emp.status === "ON_LEAVE";
}

// ── Payroll Helpers ───────────────────────────
// Pure math only — no settings, no tax logic

// Hourly rate — stored value priority
// monthlyHours → caller provides from settings/employee record
export function getHourlyRate(
  emp: Pick<EmployeeDB, "hourlyRate" | "monthlySalary">,
  monthlyHours: number,
): number {
  if (emp.hourlyRate > 0) return emp.hourlyRate;
  if (monthlyHours <= 0) return 0;
  return emp.monthlySalary / monthlyHours;
}

// Daily salary — caller provides workingDaysPerMonth from settings
export function getDailySalary(
  emp: Pick<EmployeeDB, "monthlySalary">,
  workingDaysPerMonth: number,
): number {
  if (workingDaysPerMonth <= 0) return 0;
  return emp.monthlySalary / workingDaysPerMonth;
}

// ✅ Fix #3 — WEEKS_PER_MONTH constant, no magic number
export function getWeeklySalary(
  emp: Pick<EmployeeDB, "monthlySalary">,
): number {
  return emp.monthlySalary / WEEKS_PER_MONTH;
}

// ✅ Fix #4 — amount always number per type, no ?? needed
export function getTotalAllowances(
  emp: Pick<EmployeeDB, "allowances">
): number {
  return emp.allowances.reduce(
    (sum, allowance) => sum + allowance.amount,
    0
  );
}

// Gross = monthlySalary + allowances
export function getGrossSalary(
  emp: Pick<EmployeeDB, "monthlySalary" | "allowances">
): number {
  return emp.monthlySalary + getTotalAllowances(emp);
}

// ── Leave ─────────────────────────────────────

export function getTotalLeaveBalance(balance: LeaveBalance): number {
  return (
    balance.annualLeave      +
    balance.sickLeave        +
    balance.maternityLeave   +
    balance.paternityLeave   +
    balance.bereavementLeave
  );
}