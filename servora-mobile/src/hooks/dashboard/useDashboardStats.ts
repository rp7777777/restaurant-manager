// ============================================
// SERVORA ERP — useDashboardStats
// ✅ Firestore real-time listener
// ✅ Loading state — no race condition
// ✅ Cleanup on unmount
// ✅ restaurantId null safe
// ✅ DEFAULT_STATS immutable — spread
// ✅ Error — reset stats to default
// FROZEN
// ============================================

import { useEffect, useState } from "react";
import {
  subscribeDashboardStats,
  DashboardStats,
} from "../../services/dashboard-service";

const DEFAULT_STATS: DashboardStats = {
  totalSales:        0,
  totalExpenses:     0,
  netProfit:         0,
  totalTransactions: 0,
  todaySales:        0,
  todayExpenses:     0,
  labourCostPct:     0,
  inventoryValue:    0,
  employeesPresent:  0,
  employeesTotal:    0,
  profitMargin:      0,
  monthSales:        0,
  monthExpenses:     0,
  lastUpdated:       null,
};

export interface UseDashboardStatsResult {
  stats:   DashboardStats;
  loading: boolean;
  error:   string | null;
}

export function useDashboardStats(
  restaurantId: string | null | undefined
): UseDashboardStatsResult {
  // ✅ Fix #1 — spread — immutable default
  const [stats,   setStats]   = useState<DashboardStats>({ ...DEFAULT_STATS });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      // ✅ Fix #1 — spread on reset
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
        // ✅ Fix #2 — reset stats on error — no stale data
        setStats({ ...DEFAULT_STATS });
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  return { stats, loading, error };
}