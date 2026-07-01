// ============================================
// SERVORA ERP — Labour Cost Filters
// ✅ Pure functions — no Firestore, no UI
// ✅ Employee filter — search + position
// ✅ getUniquePositions — empty/spaces filtered
// ✅ buildDateRange CUSTOM — startDate > endDate guard
// ✅ formatPeriodLabel CUSTOM — single day handled
// ✅ locale support — worldwide ready
// ✅ Date range filter — ISO safe
// ✅ Period helpers — daily/weekly/monthly
// ✅ Timezone safe date handling
// FROZEN
// ============================================

import {
  EmployeeLabourCost,
  LabourCostFilter,
  LabourCostPeriod,
  DateRange,
} from "../types/labour-cost-types";

// ── Timezone safe today ───────────────────────
function todayISO(): string {
  const d  = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000)
    .toISOString().split("T")[0];
}

// ── Add days to ISO ───────────────────────────
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000)
    .toISOString().split("T")[0];
}

// ── Get start of month ────────────────────────
function startOfMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Get end of month ──────────────────────────
function endOfMonth(iso: string): string {
  const d    = new Date(`${iso}T00:00:00`);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const tz   = last.getTimezoneOffset();
  return new Date(last.getTime() - tz * 60000)
    .toISOString().split("T")[0];
}

// ── Get start of week (Monday) ────────────────
function startOfWeek(iso: string): string {
  const d   = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(iso, diff);
}

// ── Get end of week (Sunday) ──────────────────
function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

// ── Build DateRange from period ───────────────
export function buildDateRange(
  period:       LabourCostPeriod,
  customRange?: DateRange,
): DateRange {
  const today = todayISO();

  switch (period) {
    case "DAILY":
      return { startDate: today, endDate: today };

    case "WEEKLY":
      return {
        startDate: startOfWeek(today),
        endDate:   endOfWeek(today),
      };

    case "MONTHLY":
      return {
        startDate: startOfMonth(today),
        endDate:   endOfMonth(today),
      };

    case "CUSTOM":
      // ✅ Fix #2 — startDate > endDate guard
      if (
        customRange &&
        customRange.startDate <= customRange.endDate
      ) {
        return customRange;
      }
      // ✅ Fallback to monthly if invalid
      return {
        startDate: startOfMonth(today),
        endDate:   endOfMonth(today),
      };
  }
}

// ── Is date in range ──────────────────────────
export function isDateInRange(
  date:      string,
  dateRange: DateRange,
): boolean {
  return date >= dateRange.startDate && date <= dateRange.endDate;
}

// ── Filter employees ──────────────────────────
export function filterEmployeeLabourCosts(
  employees: EmployeeLabourCost[],
  filter:    Pick<LabourCostFilter, "search" | "position">,
): EmployeeLabourCost[] {
  const q = filter.search.toLowerCase().trim();

  return employees.filter((emp) => {
    if (filter.position && filter.position !== "ALL") {
      if (emp.position !== filter.position) return false;
    }
    if (q) {
      return (
        emp.employeeName.toLowerCase().includes(q)   ||
        emp.employeeNumber.toLowerCase().includes(q) ||
        emp.position.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

// ── Get unique positions ──────────────────────
// ✅ Fix #1 — empty/spaces filtered
export function getUniquePositions(
  employees: EmployeeLabourCost[],
): string[] {
  const positions = new Set(
    employees
      .map((e) => e.position.trim())
      .filter(Boolean)               // ✅ removes "" and spaces
  );
  return Array.from(positions).sort();
}

// ── Previous period range ─────────────────────
export function getPreviousPeriodRange(
  current: DateRange,
): DateRange {
  const startD   = new Date(`${current.startDate}T00:00:00`);
  const endD     = new Date(`${current.endDate}T00:00:00`);
  const daysDiff = Math.round(
    (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return {
    startDate: addDays(current.startDate, -daysDiff),
    endDate:   addDays(current.startDate, -1),
  };
}

// ── Format period label ───────────────────────
// ✅ Fix #3 — single day handled
// ✅ Fix #4 — locale support
export function formatPeriodLabel(
  period:    LabourCostPeriod,
  dateRange: DateRange,
  locale:    string = "en-GB",
): string {
  if (period === "MONTHLY") {
    const d = new Date(`${dateRange.startDate}T00:00:00`);
    return d.toLocaleDateString(locale, {
      month: "long",
      year:  "numeric",
    });
  }

  if (period === "DAILY") {
    const d = new Date(`${dateRange.startDate}T00:00:00`);
    return d.toLocaleDateString(locale, {
      weekday: "short",
      day:     "numeric",
      month:   "short",
      year:    "numeric",
    });
  }

  // ✅ Fix #3 — CUSTOM/WEEKLY single day
  if (dateRange.startDate === dateRange.endDate) {
    const d = new Date(`${dateRange.startDate}T00:00:00`);
    return d.toLocaleDateString(locale, {
      day:   "numeric",
      month: "short",
      year:  "numeric",
    });
  }

  // WEEKLY or CUSTOM — date range
  const start = new Date(`${dateRange.startDate}T00:00:00`);
  const end   = new Date(`${dateRange.endDate}T00:00:00`);
  const s = start.toLocaleDateString(locale, {
    day:   "numeric",
    month: "short",
  });
  const e = end.toLocaleDateString(locale, {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
  return `${s} – ${e}`;
}