// ============================================
// SERVORA ERP — Shift Colors
// Single source of truth for shift color coding
// FROZEN
// ============================================

import { Shift } from "../types/sales-types";

export const SHIFT_COLORS: Record<Shift, string> = {
  Morning: "#f59e0b",
  Afternoon: "#f97316",
  Night: "#6366f1",
};

// ── Tint backgrounds for shift cards (Fix #3 — color background tint) ──
export const SHIFT_TINT_BG: Record<Shift, string> = {
  Morning: "#f59e0b18",
  Afternoon: "#f9731618",
  Night: "#6366f118",
};