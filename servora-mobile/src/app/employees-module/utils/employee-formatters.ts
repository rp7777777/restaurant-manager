// ============================================
// SERVORA ERP — Employee Formatters
// ✅ Pure formatting functions only
// ✅ No label resolvers (UI handles)
// ✅ No country rules (Settings handles)
// ✅ toISODate — invalid date guard
// FROZEN
// ============================================

import { EmployeeDB } from "../types/employee-types";

// ── Date Formatters ───────────────────────────

export function toISODate(date: Date): string {
  if (!date || isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

// ISO "2026-06-20" → "20/06/2026"
export function formatDateDMY(isoDate: string): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

// ISO "2026-06-20" → "Jun 20, 2026"
export function formatDateLong(isoDate: string): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}

// ── Name Formatters ───────────────────────────

export function formatFullName(
  emp: Pick<EmployeeDB, "firstName" | "lastName">
): string {
  return `${emp.firstName} ${emp.lastName}`.trim();
}

export function formatInitials(
  emp: Pick<EmployeeDB, "firstName" | "lastName">
): string {
  const first = emp.firstName?.charAt(0)?.toUpperCase() ?? "";
  const last  = emp.lastName?.charAt(0)?.toUpperCase()  ?? "";
  return `${first}${last}`;
}

// ── Tenure Formatter ──────────────────────────
// 14 months → "1 yr 2 mo"
export function formatTenure(months: number): string {
  if (months <= 0) return "< 1 mo";
  const years = Math.floor(months / 12);
  const rem   = months % 12;
  if (years === 0) return `${rem} mo`;
  if (rem   === 0) return `${years} yr`;
  return `${years} yr ${rem} mo`;
}

// ── Currency Formatter ────────────────────────
export function formatCurrency(
  amount: number,
  currencyCode: string,
  locale: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style:                 "currency",
      currency:              currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)}`;
  }
}