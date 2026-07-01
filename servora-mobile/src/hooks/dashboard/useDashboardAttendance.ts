// ============================================
// SERVORA ERP — useDashboardAttendance
// ✅ Fetch today attendance summary
// ✅ Manual refresh support
// ✅ cancelled flag — unmount safe
// ✅ DRY — single loadAttendance function
// ✅ restaurantId null safe + error reset
// FROZEN
// ============================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchTodayAttendance,
} from "../../services/dashboard-service";
import { AttendanceSummary } from "../../types/dashboard";

const DEFAULT_ATTENDANCE: AttendanceSummary = {
  total:   0,
  present: 0,
  absent:  0,
  late:    0,
};

export interface UseDashboardAttendanceResult {
  attendance: AttendanceSummary;
  loading:    boolean;
  error:      string | null;
  refresh:    () => Promise<void>;
}

export function useDashboardAttendance(
  restaurantId: string | null | undefined
): UseDashboardAttendanceResult {
  const [attendance, setAttendance] = useState<AttendanceSummary>({ ...DEFAULT_ATTENDANCE });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const cancelledRef = useRef(false);

  const loadAttendance = useCallback(async () => {
    if (!restaurantId) {
      setAttendance({ ...DEFAULT_ATTENDANCE });
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchTodayAttendance(restaurantId);
      if (!cancelledRef.current) setAttendance(result);
    } catch (err) {
      if (!cancelledRef.current) {
        setAttendance({ ...DEFAULT_ATTENDANCE });
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    cancelledRef.current = false;
    loadAttendance();
    return () => { cancelledRef.current = true; };
  }, [loadAttendance]);

  return { attendance, loading, error, refresh: loadAttendance };
}