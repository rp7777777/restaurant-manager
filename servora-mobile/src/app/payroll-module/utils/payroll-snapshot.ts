// ============================================
// SERVORA ERP — Payroll Snapshot Utils
// ✅ isValidSnapshot — NaN/Infinity check
// ✅ No Firestore query — caller provides map
// ✅ Schedule snapshot wins — DB fallback
// ============================================

import { PayrollSnapshot } from "../types/payroll-types";
import { SCHEDULE_CONFIG } from "../../schedule-module/constants/schedule-config";

export function buildPayrollSnapshot(data: any): PayrollSnapshot {
  const basicSalary = data.basicSalary ?? 0;
  return {
    basicSalary,
    hourlyRate:   data.hourlyRate ?? (
      SCHEDULE_CONFIG.MONTHLY_HOURS > 0
        ? basicSalary / SCHEDULE_CONFIG.MONTHLY_HOURS
        : 0
    ),
    overtimeRate: data.overtimeRate ?? SCHEDULE_CONFIG.DEFAULT_OT_RATE,
    holidayRate:  data.holidayRate  ?? SCHEDULE_CONFIG.DEFAULT_HOLIDAY_RATE,
    nightRate:    data.nightRate    ?? SCHEDULE_CONFIG.DEFAULT_NIGHT_RATE,
    taxRate:      data.taxRate      ?? SCHEDULE_CONFIG.DEFAULT_TAX_RATE,
    ssRate:       data.ssRate       ?? SCHEDULE_CONFIG.DEFAULT_SS_RATE,
  };
}

// ✅ NaN + Infinity check — not just typeof
export function isValidSnapshot(snapshot: any): snapshot is PayrollSnapshot {
  return (
    snapshot != null &&
    Number.isFinite(snapshot.basicSalary)  &&
    Number.isFinite(snapshot.hourlyRate)   &&
    Number.isFinite(snapshot.overtimeRate) &&
    Number.isFinite(snapshot.holidayRate)  &&
    Number.isFinite(snapshot.nightRate)    &&
    Number.isFinite(snapshot.taxRate)      &&
    Number.isFinite(snapshot.ssRate)
  );
}

// ✅ Resolve from employeeMap — no Firestore query!
// Caller (payroll-generator) loads employeeMap once
export function resolveSnapshot(
  employeeNo: string,
  scheduleSnapshot?: PayrollSnapshot,
  employeeMap?: Record<string, any>
): PayrollSnapshot | null {
  // ✅ Schedule snapshot — most accurate
  if (scheduleSnapshot && isValidSnapshot(scheduleSnapshot)) {
    return scheduleSnapshot;
  }
  // ✅ Employee DB fallback — from pre-loaded map
  const empData = employeeMap?.[employeeNo];
  if (empData) {
    const fallback = buildPayrollSnapshot(empData);
    if (isValidSnapshot(fallback)) return fallback;
  }
  return null;
}