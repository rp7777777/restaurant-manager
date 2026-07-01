// ============================================
// SERVORA ERP — Labour Cost Format Utils
// ✅ Currency formatting — locale support
// ✅ formatSalesPerHour — locale support added
// ✅ formatLabourHours — 1h 60m edge case fixed
// ✅ Percent formatting — null → "N/A"
// ✅ formatLateMinutes — comment fixed
// ✅ getHoursVarianceColor — threshold based
// ✅ Future format functions ready
// FROZEN
// ============================================

import { LabourCostThresholds } from "../types/labour-cost-types";
import { DEFAULT_LABOUR_COST_THRESHOLDS } from "../constants/labour-cost-config";

// ── Format currency ───────────────────────────
export function formatLabourCost(
  amount:         number,
  currencySymbol: string = "€",
  locale:         string = "en",
): string {
  return `${currencySymbol}${amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Format percent ────────────────────────────
export function formatPercent(
  value: number | null,
): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
}

// ── Format hours ──────────────────────────────
// ✅ Fix #2 — floating point edge case
// 1.9999 → "2h" not "1h 60m"
export function formatLabourHours(hours: number): string {
  if (hours === 0) return "0h";
  const isNegative = hours < 0;
  const abs = Math.abs(hours);
  const h   = Math.floor(abs);
  let   m   = Math.round((abs - h) * 60);

  // ✅ floating point guard — 60m → next hour
  let finalH = h;
  if (m === 60) {
    finalH = h + 1;
    m      = 0;
  }

  const str = m === 0 ? `${finalH}h` : `${finalH}h ${m}m`;
  return isNegative ? `-${str}` : str;
}

// ── Format sales per hour ─────────────────────
// ✅ Fix #1 — locale support added
export function formatSalesPerHour(
  value:          number | null,
  currencySymbol: string = "€",
  locale:         string = "en",
): string {
  if (value === null) return "N/A";
  return `${currencySymbol}${value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/h`;
}

// ── Labour cost % color ───────────────────────
export function getLabourCostColor(
  percent:    number | null,
  thresholds: LabourCostThresholds = DEFAULT_LABOUR_COST_THRESHOLDS,
): string {
  if (percent === null) return "#94a3b8";
  if (percent >= thresholds.labourCostDanger)  return "#ef4444";
  if (percent >= thresholds.labourCostWarning) return "#f59e0b";
  return "#10b981";
}

// ── Attendance rate color ─────────────────────
export function getAttendanceColor(
  rate:       number,
  thresholds: LabourCostThresholds = DEFAULT_LABOUR_COST_THRESHOLDS,
): string {
  if (rate >= thresholds.attendanceMinimum)      return "#10b981";
  if (rate >= thresholds.attendanceMinimum - 10) return "#f59e0b";
  return "#ef4444";
}

// ── Hours variance color ──────────────────────
// 0–1h  → green  | 1–4h → yellow | 4h+ → red
// negative — worked less than scheduled
export function getHoursVarianceColor(variance: number): string {
  if (variance > 4)  return "#ef4444";
  if (variance > 1)  return "#f59e0b";
  if (variance >= 0) return "#10b981";
  if (variance > -4) return "#10b981";
  return "#ef4444";
}

// ── Format late minutes ───────────────────────
// 75 → "1h 15m" | 30 → "30m" | 0 → "0m"
export function formatLateMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Format date ───────────────────────────────
export function formatLabourDate(
  iso:    string,
  locale: string = "en-GB",
): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    year:    "numeric",
  });
}

// ── Format date range ─────────────────────────
export function formatDateRange(
  startDate: string,
  endDate:   string,
  locale:    string = "en-GB",
): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end   = new Date(`${endDate}T00:00:00`);
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

// ── Format variance ───────────────────────────
// +2.5h → "+2h 30m" | -1h → "-1h"
export function formatVariance(hours: number): string {
  const formatted = formatLabourHours(hours);
  return hours > 0 ? `+${formatted}` : formatted;
}

// ── Format employee initials ──────────────────
// "Rabi Paudel" → "RP"
export function formatEmployeeInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}