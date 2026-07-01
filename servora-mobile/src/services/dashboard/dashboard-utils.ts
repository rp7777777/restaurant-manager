// ============================================
// SERVORA ERP — Dashboard Utils
// ✅ Pure functions — no side effects
// ✅ Timezone-safe date parsing
// ✅ parseSaleDate — invalid input guard
// ✅ formatLocalDate — shared helper
// ✅ Generic sumAmounts
// ✅ expenseDate — Timestamp only (matches type)
// ✅ Cached locale formatter
// FROZEN
// ============================================

import { ExpenseEntry, SaleEntry } from "../../types/dashboard";

// ── Safe number ───────────────────────────────
export function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ── Timezone-safe date parse ──────────────────
export function parseSaleDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return new Date(0);
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

// ── Local date string — no UTC shift ──────────
export function formatLocalDate(date: Date): string {
  const y   = date.getFullYear();
  const m   = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ✅ Fix — ExpenseEntry.createdAt is Timestamp | null only
export function expenseDate(e: ExpenseEntry): Date {
  if (!e.createdAt) return new Date(0);
  return e.createdAt.toDate();
}

// ── Expense date string — timezone safe ───────
export function expenseDateStr(e: ExpenseEntry): string {
  return formatLocalDate(expenseDate(e));
}

// ── Generic sumAmounts ────────────────────────
export function sumAmounts<T extends { amount: number }>(
  items: T[]
): number {
  return items.reduce((s, x) => s + safeNum(x.amount), 0);
}

// ── Cached locale formatter ───────────────────
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short",
});

export function formatDate(d: string): string {
  return dateFormatter.format(parseSaleDate(d));
}

// ── Filter sales by month/year ────────────────
export function salesInMonth(
  sales: SaleEntry[],
  month: number,
  year:  number,
): SaleEntry[] {
  return sales.filter((s) => {
    if (!s.date) return false;
    const d = parseSaleDate(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

// ── Filter expenses by month/year ─────────────
export function expensesInMonth(
  expenses: ExpenseEntry[],
  month:    number,
  year:     number,
): ExpenseEntry[] {
  return expenses.filter((e) => {
    const d = expenseDate(e);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

// ── Filter sales by date string ───────────────
export function salesOnDate(
  sales:   SaleEntry[],
  dateStr: string,
): SaleEntry[] {
  return sales.filter((s) => s.date === dateStr);
}

// ── Filter expenses by date string ────────────
export function expensesOnDate(
  expenses: ExpenseEntry[],
  dateStr:  string,
): ExpenseEntry[] {
  return expenses.filter((e) => expenseDateStr(e) === dateStr);
}