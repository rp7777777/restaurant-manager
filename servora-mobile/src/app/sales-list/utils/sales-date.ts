// ============================================
// SERVORA ERP — Sales History Date Utils
// Pure functions — no side effects, no Firestore
// ============================================

import { Timestamp } from "firebase/firestore";

// ── Safe date parsing — s.date is a "YYYY-MM-DD" string,
//    but defensively handle Timestamp and missing values too ──
export function parseSaleDate(date: unknown): Date {
  if (!date) return new Date(0);
  if (date instanceof Timestamp) return date.toDate();
  return new Date(String(date));
}

// ── Human-readable short date, e.g. "Mon, 8 Jul" ──
export function formatShortDate(date: unknown): string {
  return parseSaleDate(date).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
] as const;

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;