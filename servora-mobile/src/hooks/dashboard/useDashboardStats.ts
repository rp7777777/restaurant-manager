// ============================================
// SERVORA ERP — useDashboardStats
// ✅ Firestore real-time listener
// ✅ Loading state — no race condition
// ✅ Cleanup on unmount
// ✅ restaurantId null safe
// ✅ DEFAULT_STATS imported from service — single source of truth,
//    no more locally-duplicated default that could drift out of
//    sync with the interface (previously missing yearSales/
//    yearExpenses and the new trend baseline fields)
// ✅ Error — reset stats to default
// FROZEN
// ============================================

import { useEffect, useState } from "react";
import {
  subscribeDashboardStats,
  DashboardStats,
  DEFAULT_STATS,
} from "../../services/dashboard-service";

export interface UseDashboardStatsResult {
  stats:   DashboardStats;
  loading: boolean;
  error:   string | null;
}

export function useDashboardStats(
  restaurantId: string | null | undefined
): UseDashboardStatsResult {
  const [stats,   setStats]   = useState<DashboardStats>({ ...DEFAULT_STATS });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setStats({ ...DEFAULT_STATS });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeDashboardStats(
      restaurantId,
      (s) => {
        setStats(s);
        setLoading(false);
      },
      (err) => {
        setStats({ ...DEFAULT_STATS });
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  return { stats, loading, error };
}