// ============================================
// SERVORA ERP — Employee Defaults
// ✅ Worldwide ready — no country hardcoding
// ✅ Settings Module bata tax/leave override hunxa
// ✅ Probation 90 days — universal default
// FROZEN
// ============================================

import { EmployeeAllowance, LeaveBalance } from "../types/employee-types";

// ── Allowances ────────────────────────────────
export const DEFAULT_ALLOWANCES: EmployeeAllowance[] = [
  { id: "meal",      name: "Meal Allowance",     amount: 0, type: "MONTHLY",  taxable: false },
  { id: "transport", name: "Transport Allowance", amount: 0, type: "MONTHLY",  taxable: false },
  { id: "housing",   name: "Housing Allowance",   amount: 0, type: "MONTHLY",  taxable: true  },
  { id: "bonus",     name: "Bonus",               amount: 0, type: "ONE_TIME", taxable: true  },
];

// ── Leave Balance ─────────────────────────────
// Neutral 0 — Settings Module bata country rules inject hunxa
export const DEFAULT_LEAVE_BALANCE: LeaveBalance = {
  annualLeave:      0,
  sickLeave:        0,
  maternityLeave:   0,
  paternityLeave:   0,
  bereavementLeave: 0,
};

// ── Employment ────────────────────────────────
export const DEFAULT_PROBATION_DAYS  = 90;
export const DEFAULT_DAILY_HOURS     = 8;
export const DEFAULT_WEEKLY_HOURS    = 40;
export const DEFAULT_MONTHLY_HOURS   = 160;