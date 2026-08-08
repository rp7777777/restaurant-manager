// ============================================
// SERVORA ERP — useBatchesForItem Hook
// ✅ Raw batch data ONLY — subscribe, loading, error. Mirrors the
//    exact pattern of useInventory.ts (raw item data hook) for
//    consistency: no filtering/sorting/grouping logic here, that's
//    a presentation-layer concern (the Batch Table component groups
//    and displays; this hook only fetches).
// ✅ Live subscription (subscribeBatchesForItem from
//    inventory-batch-repository.ts) — receiveBatch()/
//    deductStockBatch() changes automatically reflect here without
//    a manual refetch.
// ✅ Returns ALL batches (including depleted/non-ACTIVE ones) — the
//    component decides what to show/hide (e.g. hiding quantity-0
//    batches per the confirmed design, showing them in a "history"
//    toggle, etc.) using isActiveBatch()/isEligibleForFEFO() from
//    types/inventory-batch.ts as needed.
// ✅ Clears stale error state when inventoryId becomes null/empty
//    (e.g. drawer closing) — mirrors useInventory.ts's restaurantId
//    handling.
// FROZEN
// ============================================

import { useState, useEffect } from "react";
import { subscribeBatchesForItem } from "../repository/inventory-batch-repository";
import { InventoryBatch } from "../types/inventory-batch";

export interface UseBatchesForItemResult {
  batches: InventoryBatch[];
  loading: boolean;
  error:   string | null;
}

export function useBatchesForItem(
  restaurantId: string | null | undefined,
  inventoryId:  string | null | undefined
): UseBatchesForItemResult {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !inventoryId) {
      setBatches([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeBatchesForItem(
      restaurantId,
      inventoryId,
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
  }, [restaurantId, inventoryId]);

  return { batches, loading, error };
}