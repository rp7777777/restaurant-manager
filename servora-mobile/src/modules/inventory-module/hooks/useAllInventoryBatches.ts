// ============================================
// SERVORA ERP — useAllInventoryBatches Hook
// ✅ Raw restaurant-wide batch data ONLY — subscribe, loading,
//    error. Mirrors useBatchesForItem.ts's pattern exactly, but
//    scoped to the whole restaurant rather than one item — used
//    ONLY by InventoryBatchReport (Category → Item → Batch rows →
//    Total QTY). No grouping/joining logic here — that's
//    InventoryBatchReport's job, this hook only fetches.
// ✅ Wraps subscribeAllBatches() from inventory-batch-repository.ts
//    (the additive, restaurant-wide function — does NOT touch or
//    replace subscribeBatchesForItem(), which useBatchesForItem.ts
//    continues to use unchanged for the single-item drawer view).
// ✅ Clears stale error state when restaurantId becomes null.
// FROZEN
// ============================================

import { useState, useEffect } from "react";
import { subscribeAllBatches } from "../repository/inventory-batch-repository";
import { InventoryBatch } from "../types/inventory-batch";

export interface UseAllInventoryBatchesResult {
  batches: InventoryBatch[];
  loading: boolean;
  error:   string | null;
}

export function useAllInventoryBatches(
  restaurantId: string | null | undefined
): UseAllInventoryBatchesResult {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setBatches([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeAllBatches(
      restaurantId,
      (data) => {
        setBatches(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  return { batches, loading, error };
}