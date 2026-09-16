// ============================================
// SERVORA ERP — Kitchen Module Format Utils
// ✅ FIX — formatSelectedDate() now parses the "YYYY-MM-DD" string
//    with Date.UTC() (was new Date(dateStr), which parses as UTC
//    midnight internally but then formats using the LOCAL timezone —
//    for timezones west of UTC, this could display the PREVIOUS
//    day's date label even though the underlying data/filtering
//    (r.requiredDate === selectedDate, a plain string comparison)
//    was always correct). Matches the UTC-safe pattern already used
//    throughout Store (formatRequiredDate/formatRequesterMetaDate in
//    KitchenRequestTable.tsx, shiftDate in StoreHistoryFullScreenModal.tsx).
// ============================================

export function todayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function formatSelectedDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    });
  } catch { return dateStr; }
}