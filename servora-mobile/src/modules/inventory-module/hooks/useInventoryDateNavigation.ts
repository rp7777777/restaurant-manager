// ============================================
// SERVORA ERP — useInventoryDateNavigation Hook
// ✅ EXTRACTED VERBATIM from InventoryScreen.tsx — pure structural
//    refactor, NO behavior change. shiftDate()/formatDateLabel() are
//    byte-for-byte identical to the original inline functions;
//    selectedDate/isHistorical are the same state/derivation, just
//    relocated.
// ✅ shiftDate() — UTC-based calendar-day arithmetic (matches
//    MovementHistoryModal.tsx's own identical helper).
// ✅ formatDateLabel() — "Today" for the current date, otherwise a
//    formatted weekday/day/month/year string.
// ✅ isHistorical — true whenever selectedDate !== today.
// ✅ FIX — explicit Dispatch/SetStateAction import instead of the
//    React namespace reference, consistent with the same fix
//    already applied in Store Module's useStoreRequests.ts.
// FROZEN
// ============================================

import { useState, type Dispatch, type SetStateAction } from "react";

function shiftDate(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export interface UseInventoryDateNavigationResult {
  selectedDate:     string;
  setSelectedDate:  Dispatch<SetStateAction<string>>;
  isHistorical:     boolean;
  dateLabel:        string;
  goToPreviousDay:  () => void;
  goToNextDay:      () => void;
  isNextDisabled:   boolean;
}

export function useInventoryDateNavigation(today: string): UseInventoryDateNavigationResult {
  const [selectedDate, setSelectedDate] = useState(today);
  const isHistorical = selectedDate !== today;

  const goToPreviousDay = () => setSelectedDate((d) => shiftDate(d, -1));
  const goToNextDay = () => setSelectedDate((d) => shiftDate(d, 1));
  const isNextDisabled = selectedDate >= today;
  const dateLabel = formatDateLabel(selectedDate, today);

  return {
    selectedDate,
    setSelectedDate,
    isHistorical,
    dateLabel,
    goToPreviousDay,
    goToNextDay,
    isNextDisabled,
  };
}