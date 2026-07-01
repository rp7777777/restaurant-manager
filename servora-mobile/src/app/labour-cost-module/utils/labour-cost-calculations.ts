// ============================================
// SERVORA ERP — Labour Cost Calculations
// ✅ Pure functions — no Firestore, no UI
// ✅ Division by zero protection
// ✅ Negative values protection
// ✅ Null safety
// ✅ safeOTRate — Math.max(0) business rule safe
// ✅ calcPositionBreakdown — sorted by cost DESC
// ✅ byEmployee — sorted by cost DESC
// ✅ byDay — sorted by date ASC
// ✅ attendanceRate — presentDays/scheduledDays
// ✅ Trend functions — future analytics ready
// FROZEN
// ============================================

import {
  LabourCostSummary,
  EmployeeLabourCost,
  PositionLabourCost,
  DailyLabourCost,
  DateRange,
} from "../types/labour-cost-types";
import { LABOUR_COST_DECIMAL_PLACES } from "../constants/labour-cost-config";

// ── Rounding helper ───────────────────────────
const r = (n: number): number =>
  Math.round(n * 10 ** LABOUR_COST_DECIMAL_PLACES) /
  10 ** LABOUR_COST_DECIMAL_PLACES;

// ── Safe divide ───────────────────────────────
export function safeDivide(
  numerator:   number,
  denominator: number,
): number | null {
  if (denominator === 0 || !Number.isFinite(denominator)) return null;
  return r(numerator / denominator);
}

// ── Safe percent ──────────────────────────────
export function safePercent(
  part:  number,
  total: number,
): number | null {
  if (total === 0 || !Number.isFinite(total)) return null;
  return r((part / total) * 100);
}

// ── Calculate employee labour cost ────────────
export function calcEmployeeLabourCost(input: {
  employeeId:     string;
  employeeNumber: string;
  employeeName:   string;
  position:       string;
  workedHours:    number;
  scheduledHours: number;
  overtimeHours:  number;
  hourlyRate:     number;
  overtimeRate:   number;
  presentDays:    number;
  absentDays:     number;
  lateDays:       number;
  lateMinutes:    number;
}): Omit<EmployeeLabourCost, "labourCostPct"> {
  const {
    employeeId, employeeNumber, employeeName, position,
    workedHours, scheduledHours, overtimeHours,
    hourlyRate, overtimeRate,
    presentDays, absentDays, lateDays, lateMinutes,
  } = input;

  const safeWorked    = Math.max(0, workedHours);
  const safeScheduled = Math.max(0, scheduledHours);
  const safeOvertime  = Math.max(0, overtimeHours);
  const safeRate      = Math.max(0, hourlyRate);
  // ✅ Fix #1 — Math.max(0) not 1
  // Business rule: 0 OT rate = no OT pay — service decides
  const safeOTRate    = Math.max(0, overtimeRate);

  const regularHours = Math.max(0, safeWorked - safeOvertime);
  const basicCost    = r(regularHours * safeRate);
  const overtimeCost = r(safeOvertime * safeRate * safeOTRate);
  const totalCost    = r(basicCost + overtimeCost);

  return {
    employeeId,
    employeeNumber,
    employeeName,
    position,
    scheduledHours: safeScheduled,
    workedHours:    safeWorked,
    overtimeHours:  safeOvertime,
    // ✅ hoursVariance can be negative — useful in ERP
    hoursVariance:  r(safeWorked - safeScheduled),
    basicCost,
    overtimeCost,
    totalCost,
    presentDays:    Math.max(0, presentDays),
    absentDays:     Math.max(0, absentDays),
    lateDays:       Math.max(0, lateDays),
    lateMinutes:    Math.max(0, lateMinutes),
    hourlyRate:     safeRate,
    overtimeRate:   safeOTRate,
  };
}

// ── Add labourCostPct ─────────────────────────
export function addLabourCostPct(
  employees:       Omit<EmployeeLabourCost, "labourCostPct">[],
  totalLabourCost: number,
): EmployeeLabourCost[] {
  return employees.map((emp) => ({
    ...emp,
    labourCostPct: safePercent(emp.totalCost, totalLabourCost) ?? 0,
  }));
}

// ── Calculate position breakdown ─────────────
export function calcPositionBreakdown(
  employees:       EmployeeLabourCost[],
  totalLabourCost: number,
): PositionLabourCost[] {
  const posMap: Record<string, {
    employeeCount: number;
    totalHours:    number;
    totalCost:     number;
  }> = {};

  employees.forEach((emp) => {
    const pos = emp.position || "Unknown";
    if (!posMap[pos]) {
      posMap[pos] = { employeeCount: 0, totalHours: 0, totalCost: 0 };
    }
    posMap[pos].employeeCount += 1;
    posMap[pos].totalHours    += emp.workedHours;
    posMap[pos].totalCost     += emp.totalCost;
  });

  return Object.entries(posMap)
    .map(([position, data]) => ({
      position,
      employeeCount: data.employeeCount,
      totalHours:    r(data.totalHours),
      totalCost:     r(data.totalCost),
      labourCostPct: safePercent(data.totalCost, totalLabourCost) ?? 0,
    }))
    // ✅ Fix #4 — sorted by cost DESC
    .sort((a, b) => b.totalCost - a.totalCost);
}

// ── Trend functions ───────────────────────────
// ✅ Future analytics ready

// Daily trend — sorted by date ASC
export function calcDailyTrend(
  byDay: DailyLabourCost[]
): DailyLabourCost[] {
  return [...byDay].sort((a, b) => a.date.localeCompare(b.date));
}

// Top overtime employees
export function calcTopOvertimeEmployees(
  employees: EmployeeLabourCost[],
  limit: number = 5,
): EmployeeLabourCost[] {
  return [...employees]
    .sort((a, b) => b.overtimeHours - a.overtimeHours)
    .slice(0, limit);
}

// Top cost employees
export function calcTopCostEmployees(
  employees: EmployeeLabourCost[],
  limit: number = 5,
): EmployeeLabourCost[] {
  return [...employees]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, limit);
}

// Labour cost vs sales ratio per day
export function calcLabourCostVsSales(
  byDay:      DailyLabourCost[],
  salesByDay: Record<string, number>,
): Array<{ date: string; labourCost: number; sales: number; pct: number | null }> {
  return calcDailyTrend(byDay).map((day) => ({
    date:        day.date,
    labourCost:  day.totalCost,
    sales:       salesByDay[day.date] ?? 0,
    pct:         safePercent(day.totalCost, salesByDay[day.date] ?? 0),
  }));
}

// ── Build Labour Cost Summary ─────────────────
export function buildLabourCostSummary(input: {
  period:        DateRange;
  employees:     EmployeeLabourCost[];
  byDay:         DailyLabourCost[];
  totalSales:    number;
  branchId?:     string;
  departmentId?: string;
}): LabourCostSummary {
  const { period, employees, byDay, totalSales, branchId, departmentId } = input;

  let totalLabourCost     = 0;
  let basicLabourCost     = 0;
  let overtimeCost        = 0;
  let totalWorkedHours    = 0;
  let totalScheduledHours = 0;
  let totalOvertimeHours  = 0;
  let totalLateMinutes    = 0;
  let totalPresentDays    = 0;
  let totalScheduledDays  = 0;

  employees.forEach((emp) => {
    totalLabourCost     += emp.totalCost;
    basicLabourCost     += emp.basicCost;
    overtimeCost        += emp.overtimeCost;
    totalWorkedHours    += emp.workedHours;
    totalScheduledHours += emp.scheduledHours;
    totalOvertimeHours  += emp.overtimeHours;
    totalLateMinutes    += emp.lateMinutes;
    totalPresentDays    += emp.presentDays;
    // ✅ Fix #3 — presentDays/scheduledDays based
    totalScheduledDays  += emp.presentDays + emp.absentDays;
  });

  totalLabourCost     = r(totalLabourCost);
  basicLabourCost     = r(basicLabourCost);
  overtimeCost        = r(overtimeCost);
  totalWorkedHours    = r(totalWorkedHours);
  totalScheduledHours = r(totalScheduledHours);
  totalOvertimeHours  = r(totalOvertimeHours);

  const totalEmployees = employees.length;

  const labourCostPercent  = safePercent(totalLabourCost, totalSales);
  const salesPerLabourHour = safeDivide(totalSales, totalWorkedHours);
  const overtimeCostPct    = safePercent(overtimeCost, totalLabourCost) ?? 0;
  const hoursVariance      = r(totalWorkedHours - totalScheduledHours);

  // ✅ Fix #3 — attendance from days not employees
  const attendanceRate = totalScheduledDays > 0
    ? r((totalPresentDays / totalScheduledDays) * 100)
    : 0;

  // ✅ Fix #5 — byEmployee sorted by cost DESC
  const sortedEmployees = [...employees]
    .sort((a, b) => b.totalCost - a.totalCost);

  const byPosition = calcPositionBreakdown(employees, totalLabourCost);

  // ✅ Fix byDay — sorted date ASC
  const sortedByDay = calcDailyTrend(byDay);

  // ── Present/absent count ──────────────────
  const presentEmployees = employees.filter((e) => e.presentDays > 0).length;
  const absentEmployees  = employees.filter((e) => e.absentDays  > 0).length;

  return {
    period,
    totalLabourCost,
    totalSales:          r(Math.max(0, totalSales)),
    labourCostPercent,
    salesPerLabourHour,
    totalScheduledHours,
    totalWorkedHours,
    totalOvertimeHours,
    hoursVariance,
    basicLabourCost,
    overtimeCost,
    overtimeCostPct,
    totalEmployees,
    presentEmployees,
    absentEmployees,
    attendanceRate,
    totalLateMinutes,
    byEmployee:  sortedEmployees,
    byPosition,
    byDay:       sortedByDay,
    branchId,
    departmentId,
  };
}