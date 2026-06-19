// ============================================
// SERVORA ERP — useSchedules Hook
// ✅ getTotalOT/getTotalAbsent from utils
// ✅ weekStart.trim() validation
// ✅ Real-time updates
// ============================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { EmployeeSchedule } from "../types/schedule-types";
import { subscribeToSchedules } from "../firestore/schedule-repository";
import { getTotalOT, getTotalAbsent } from "../utils/schedule-utils";

export function useSchedules(
  restaurantId: string | undefined,
  weekStart: string
) {
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    // ✅ weekStart.trim() — accidental whitespace blocked
    if (!restaurantId || !weekStart.trim()) {
      setSchedules([]);
      setLoading(false);
      setError(null);
      return;
    }

    setSchedules([]);
    setLoading(true);
    setError(null);

    const unsub = subscribeToSchedules(
      restaurantId,
      weekStart.trim(),
      (data) => {
        setSchedules(data);
        setLoading(false);
      },
      (err?: unknown) => {
        console.error("useSchedules error:", err);
        const message = err instanceof Error
          ? err.message
          : "Failed to load schedules";
        setError(message);
        setLoading(false);
      }
    );

    return unsub;
  }, [restaurantId, weekStart]);

  const scheduleMap = useMemo(
    () => schedules.reduce<Record<string, EmployeeSchedule>>(
      (map, s) => { map[s.employeeNo] = s; return map; },
      {}
    ),
    [schedules]
  );

  const addedEmployeeNos = useMemo(
    () => new Set(schedules.map((s) => s.employeeNo)),
    [schedules]
  );

  const getScheduleByEmployeeNo = useCallback(
    (employeeNo: string): EmployeeSchedule | undefined =>
      scheduleMap[employeeNo],
    [scheduleMap]
  );

  // ✅ Reuse utils — no duplicate logic
  const totalOT     = useMemo(() => getTotalOT(schedules),     [schedules]);
  const totalAbsent = useMemo(() => getTotalAbsent(schedules), [schedules]);

  return {
    schedules,
    loading,
    error,
    scheduleMap,
    addedEmployeeNos,
    getScheduleByEmployeeNo,
    totalOT,
    totalAbsent,
  };
}