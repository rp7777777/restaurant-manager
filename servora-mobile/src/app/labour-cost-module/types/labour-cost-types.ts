// ============================================
// SERVORA ERP — Labour Cost Types v1.1
// ✅ Payroll integration ready
// ✅ Attendance integration ready
// ✅ Sales integration ready
// ✅ Multi-period support — daily/weekly/monthly
// ✅ Employee + Position level analytics
// ✅ Consistent rates — all 0-100 percentages
// ✅ Division by zero protection — nullable fields
// ✅ Future v2 — branchId/departmentId ready
// FROZEN
// ============================================

// ── Period Type ───────────────────────────────
export type LabourCostPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

// ── Date Range ────────────────────────────────
export interface DateRange {
  startDate: string;  // ISO: "2026-06-01"
  endDate:   string;  // ISO: "2026-06-30"
}

// ── Employee Labour Cost ──────────────────────
export interface EmployeeLabourCost {
  employeeId:     string;
  employeeNumber: string;
  employeeName:   string;
  position:       string;

  // ── Hours ──────────────────────────────────
  scheduledHours: number;
  workedHours:    number;
  overtimeHours:  number;
  hoursVariance:  number;     // worked - scheduled

  // ── Cost ───────────────────────────────────
  basicCost:      number;
  overtimeCost:   number;
  totalCost:      number;

  // ── Attendance ─────────────────────────────
  presentDays:    number;
  absentDays:     number;
  lateDays:       number;
  lateMinutes:    number;

  // ── Rates ──────────────────────────────────
  hourlyRate:     number;
  overtimeRate:   number;     // multiplier e.g. 1.5

  // ── % of total labour cost ─────────────────
  labourCostPct:  number;     // 0-100
}

// ── Position Labour Cost ──────────────────────
export interface PositionLabourCost {
  position:       string;
  employeeCount:  number;
  totalHours:     number;
  totalCost:      number;
  labourCostPct:  number;     // 0-100 — % of total labour cost
}

// ── Daily Labour Cost ─────────────────────────
export interface DailyLabourCost {
  date:           string;     // ISO
  totalHours:     number;
  overtimeHours:  number;
  totalCost:      number;
  employeeCount:  number;
}

// ── Labour Cost Summary ───────────────────────
export interface LabourCostSummary {
  period:         DateRange;

  // ── KPIs ───────────────────────────────────
  totalLabourCost:     number;
  totalSales:          number;
  // ✅ null when no sales data — division by zero safe
  labourCostPercent:   number | null;  // 0-100
  salesPerLabourHour:  number | null;  // null when 0 hours

  // ── Hours ──────────────────────────────────
  totalScheduledHours: number;
  totalWorkedHours:    number;
  totalOvertimeHours:  number;
  hoursVariance:       number;         // worked - scheduled

  // ── Cost Breakdown ─────────────────────────
  basicLabourCost:     number;
  overtimeCost:        number;
  overtimeCostPct:     number;         // 0-100

  // ── Attendance ─────────────────────────────
  totalEmployees:      number;
  presentEmployees:    number;
  absentEmployees:     number;
  attendanceRate:      number;         // 0-100 ✅ consistent
  totalLateMinutes:    number;

  // ── Breakdowns ─────────────────────────────
  byEmployee:          EmployeeLabourCost[];
  byPosition:          PositionLabourCost[];
  byDay:               DailyLabourCost[];

  // ── Future v2 ──────────────────────────────
  branchId?:           string;
  departmentId?:       string;
}

// ── Labour Cost Filter ────────────────────────
export interface LabourCostFilter {
  period:     LabourCostPeriod;
  dateRange:  DateRange;
  position?:  string;
  search:     string;
}

// ── Labour Cost Thresholds ────────────────────
// Used by KPI cards for color coding
export interface LabourCostThresholds {
  labourCostWarning:  number;   // % — yellow e.g. 30
  labourCostDanger:   number;   // % — red   e.g. 35
  overtimeWarning:    number;   // hours per period
  attendanceMinimum:  number;   // % — e.g. 85
}