// ============================================
// SERVORA ERP — Date Utils
// ✅ Shared date helpers — no duplication
// FROZEN
// ============================================

// ── Today ISO — timezone safe ─────────────────
export function todayISO(): string {
  const d  = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000)
    .toISOString().split("T")[0];
}

// ── Current month string ──────────────────────
export function currentMonthStr(): string {
  return todayISO().slice(0, 7);
}

// ── Current year string ───────────────────────
export function currentYearStr(): string {
  return todayISO().slice(0, 4);
}