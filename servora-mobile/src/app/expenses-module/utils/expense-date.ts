// ============================================
// SERVORA ERP — Expense History Date Utils
// Pure functions — no side effects, no Firestore
// ============================================

import { Timestamp } from "firebase/firestore";

// ── Safe date parsing — e.date is a "YYYY-MM-DD" string,
//    but defensively handle Timestamp and missing values too ──
export function parseExpenseDate(date: unknown): Date {
  if (!date) return new Date(0);
  if (date instanceof Timestamp) return date.toDate();
  return new Date(String(date));
}

// ── Human-readable short date, e.g. "Mon, 8 Jul" ──
export function formatShortExpenseDate(date: unknown): string {
  return parseExpenseDate(date).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export const EXPENSE_MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
] as const;

export const EXPENSE_MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;

// ── Full report-style date, e.g. "08 July 2026" (used in print/PDF headers) ──
export function formatExpenseReportDate(date: string): string {
  const dt = new Date(date);
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });
}