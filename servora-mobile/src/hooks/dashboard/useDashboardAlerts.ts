// ============================================
// SERVORA ERP — useDashboardAlerts
// ✅ Fetch today alerts
// ✅ Manual refresh support
// ✅ restaurantId null safe
// ✅ Loading + error state
// ✅ cancelled flag — unmount safe
// ✅ DRY — single loadAlerts function
// FROZEN
// ============================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchTodayAlerts,
  DashboardAlert,
} from "../../services/dashboard-service";

export interface UseDashboardAlertsResult {
  alerts:  DashboardAlert[];
  loading: boolean;
  error:   string | null;
  refresh: () => Promise<void>;
}

export function useDashboardAlerts(
  restaurantId: string | null | undefined
): UseDashboardAlertsResult {
  const [alerts,  setAlerts]  = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ✅ cancelled ref — shared across calls
  const cancelledRef = useRef(false);

  // ✅ DRY — single function, used by both useEffect + refresh
  const loadAlerts = useCallback(async () => {
    if (!restaurantId) {
      setAlerts([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchTodayAlerts(restaurantId);
      if (!cancelledRef.current) setAlerts(result);
    } catch (err) {
      if (!cancelledRef.current) {
        setAlerts([]);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [restaurantId]);

  // ✅ useEffect calls loadAlerts — no duplication
  useEffect(() => {
    cancelledRef.current = false;
    loadAlerts();
    return () => { cancelledRef.current = true; };
  }, [loadAlerts]);

  return { alerts, loading, error, refresh: loadAlerts };
}