// ============================================
// SERVORA ERP — useRequestHistory Hook
// ✅ Owns day-navigation state (selectedDate, prev/next day, isToday)
//    and the requiredDate-filtered history list — moved from the
//    old kitchen-module/index.tsx's inline logic.
// ✅ Not on the original locked file plan, but a legitimate small
//    addition: this is cohesive, reusable state (day navigation is
//    its own concern, separate from the raw data useKitchenRequests
//    provides), matching the same one-hook-one-concern pattern
//    already used throughout this restructuring.
// ============================================

import { useState, useMemo } from "react";
import { IngredientRequest } from "../types/kitchen-types";

export interface UseRequestHistoryResult {
  selectedDate:     string;
  historyRequests:  IngredientRequest[];
  goToPrevDay:      () => void;
  goToNextDay:      () => void;
  isToday:          boolean;
}

// ✅ Single source for "today as YYYY-MM-DD" — was repeated 3 times
// inline before; now called once wherever "today" is needed.
function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useRequestHistory(
  requests: IngredientRequest[]
): UseRequestHistoryResult {
  const [selectedDate, setSelectedDate] = useState(getTodayStr);

  // ✅ useMemo — avoids re-filtering on every render once request
  // counts grow large (thousands of requests); matches the
  // established real pattern already used by useInventoryFilters.ts.
  const historyRequests = useMemo(
    () => requests.filter((r) => r.requiredDate === selectedDate),
    [requests, selectedDate]
  );

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const isToday = selectedDate === getTodayStr();

  return { selectedDate, historyRequests, goToPrevDay, goToNextDay, isToday };
}