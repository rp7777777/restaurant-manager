// ============================================
// SERVORA ERP — useStockMovements Hook
// ✅ Raw movement data ONLY — subscribe, loading, error. Wraps
//    stock-movement-module's own EXISTING subscribeRecentMovements()
//    (already restaurant-wide, live) — no new backend function was
//    needed; this hook only adapts it to this module's
//    useState/useEffect pattern, matching useAllInventoryBatches.ts.
// ✅ Uses a higher limitCount (300) than subscribeRecentMovements()'s
//    own default (20) — that default was tuned for a small "recent
//    activity" widget elsewhere; Movement History is a dedicated
//    full-history view where a user may want to look back further
//    than the last 20 movements across the whole restaurant.
// ✅ No filtering/grouping logic here — that's
//    MovementHistoryModal's job (by movementType, by date). This
//    hook only fetches.
// FROZEN
// ============================================

import { useState, useEffect } from "react";
import { subscribeRecentMovements } from "../../stock-movement-module/services/stock-movement-service";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";

export interface UseStockMovementsResult {
  movements: StockMovement[];
  loading:   boolean;
  error:     string | null;
}

export function useStockMovements(
  restaurantId: string | null | undefined
): UseStockMovementsResult {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setMovements([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeRecentMovements(
      restaurantId,
      (data) => {
        setMovements(data);
        setLoading(false);
      },
      300,
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  return { movements, loading, error };
}