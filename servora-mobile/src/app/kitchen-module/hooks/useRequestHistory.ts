// ============================================
// SERVORA ERP — useRequestHistory Hook
// ✅ Owns day-navigation state (selectedDate, prev/next day, isToday)
//    and the requiredDate-filtered history list.
// ✅ FIX — was using its own local getTodayStr() (new Date().
//    toISOString().slice(0,10)) which (a) converts to UTC, causing
//    an off-by-one-day mismatch depending on the user's local
//    timezone/time of day, and (b) was called only ONCE at
//    useState's initializer — if the screen stayed mounted across a
//    local-midnight boundary, "Today" silently stayed pinned to the
//    stale date until the user manually navigated away and back.
//    Now uses the project-wide todayISO() helper (already timezone-
//    safe, used throughout Inventory/Store/MonthlyReportScreen) for
//    the initial value AND for the isToday comparison — day
//    arithmetic (prev/next) still operates on the selectedDate
//    string directly via the UTC-safe Date.UTC() pattern, avoiding
//    the same local-timezone parsing pitfall `new Date(dateString)`
//    has.
// ============================================

import { useState, useMemo } from "react";
import { IngredientRequest } from "../types/kitchen-types";
import { todayISO } from "../../../utils/date-utils";

export interface UseRequestHistoryResult {
  selectedDate:     string;
  historyRequests:  IngredientRequest[];
  goToPrevDay:      () => void;
  goToNextDay:      () => void;
  isToday:          boolean;
}

// ✅ UTC-safe day shift — avoids `new Date(dateString)` local-
// timezone parsing pitfalls (same pattern used throughout
// MonthlyReportScreen.tsx/HistoricalInventoryTableView.tsx).
function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function useRequestHistory(
  requests: IngredientRequest[]
): UseRequestHistoryResult {
  const [selectedDate, setSelectedDate] = useState(todayISO);

  const historyRequests = useMemo(
    () => requests.filter((r) => r.requiredDate === selectedDate),
    [requests, selectedDate]
  );

  const goToPrevDay = () => setSelectedDate((d) => shiftDateStr(d, -1));
  const goToNextDay = () => setSelectedDate((d) => shiftDateStr(d, 1));
  const isToday = selectedDate === todayISO();

  return { selectedDate, historyRequests, goToPrevDay, goToNextDay, isToday };
}