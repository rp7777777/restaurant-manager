// ============================================
// SERVORA ERP — Store Module Formatters/Constants
// ✅ EVOLUTIONARY EXTRACTION — pure helper functions and shared
//    constants moved verbatim from index.tsx, as the first step of
//    splitting the Store screen into file-by-file components. NO
//    logic changed — same date arithmetic, same status colors, same
//    column widths as before.
// ✅ shiftDate() — pure UTC calendar-day arithmetic (matches
//    MovementHistoryModal.tsx's own identical helper), immune to
//    local-timezone offset drift.
// ✅ formatDateLabel() — "Today" for the current date, otherwise a
//    formatted weekday/day/month/year string, matching
//    MovementHistoryModal.tsx's convention.
// ✅ STATUS_COLORS — the 4 RequestStatus → color mapping used by
//    both the compact table's status dot and the (future)
//    StoreStats component's stat-card colors.
// ✅ Column widths (ROW_HEIGHT/COLS/TABLE_WIDTH) — Excel-row-height
//    sizing for KitchenRequestTable, unchanged from index.tsx's
//    original values.
// FROZEN
// ============================================

import { RequestStatus } from "../../kitchen-module/types/kitchen-types";

export const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#3b82f6",
  ISSUED: "#10b981",
  REJECTED: "#ef4444",
};

export function shiftDate(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

// ── Excel-row-height sizing for KitchenRequestTable ──
export const ROW_HEIGHT = 26;
export const COLS = { sn: 26, item: 100, status: 76, req: 60, issued: 60, by: 84, date: 78, note: 150 };
export const TABLE_WIDTH =
  COLS.sn + COLS.item + COLS.status + COLS.req + COLS.issued + COLS.by + COLS.date + COLS.note;