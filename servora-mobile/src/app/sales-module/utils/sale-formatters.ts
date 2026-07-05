// ============================================
// SERVORA ERP — Sale Formatters
// Pure functions — no side effects, no Firestore
// ============================================

import { SaleEntry } from "../types/sales-types";

// ── Backward-compat entry name reader ──
// Old sales docs may have "note" instead of "entryName".
// Reads either field, prefers entryName if both exist.
export function getEntryDisplayName(
  sale: SaleEntry & { note?: string }
): string {
  return sale.entryName?.trim() || sale.note?.trim() || "";
}

// ── Human-readable date for header display ──
export function formatDisplayDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}