// ============================================
// SERVORA ERP — useTodayISO Hook
// Reactive "today" business date that automatically rolls over
// at midnight, even if the app stays open with no user interaction.
// Shared across Sales, Expenses, and any future date-scoped module.
// ============================================

import { useState, useEffect } from "react";
import { todayISO } from "../utils/date-utils";

export function useTodayISO(): string {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // Compute ms until next local midnight, then schedule a check.
    const scheduleNextCheck = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();

      timer = setTimeout(() => {
        setToday(todayISO());
        scheduleNextCheck(); // re-arm for the following midnight
      }, msUntilMidnight + 1000); // +1s buffer past midnight
    };

    scheduleNextCheck();

    return () => clearTimeout(timer);
  }, []);

  return today;
}