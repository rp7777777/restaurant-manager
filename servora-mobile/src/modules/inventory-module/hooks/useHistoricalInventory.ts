// ============================================
// SERVORA ERP — useHistoricalInventory Hook
// ✅ Firestore querying + caching + item-level aggregation layer for
//    the date-navigated historical Inventory view. The PURE replay
//    logic lives entirely in historical-batch-replay-service.ts —
//    this hook only fetches data and hands it to that service.
// ✅ Batches — reuses useAllInventoryBatches() UNCHANGED (live
//    subscription, restaurant-wide).
// ✅ CONFIRMED ARCHITECTURE — Option A: full movement history is
//    loaded ONCE via a single live subscription (onSnapshot, no
//    limit()/range query), then kept in memory. Date navigation
//    NEVER triggers a new Firestore query — it only re-runs the pure
//    replay function against the already-loaded movements. This is
//    a deliberate simplicity choice for the project's current scale
//    (hundreds to low-thousands of movements per restaurant) —
//    NOT the final architecture at unbounded scale.
// ⚠️ KNOWN SCALING LIMIT (intentionally not solved here — see
//    review discussion): this hook downloads and holds ALL
//    historical movements for the restaurant, unbounded, for as
//    long as it's mounted. At much higher movement volumes (tens of
//    thousands+), this becomes a real memory/bandwidth concern. The
//    architecture is deliberately layered so a future migration to
//    incremental, coverage-range-based caching (fetch only the
//    missing date range when navigating further back, track
//    cachedFrom/cachedTo) can replace ONLY the movement-fetching
//    useEffect below, without touching
//    historical-batch-replay-service.ts (the pure replay function)
//    or this hook's public return shape at all. Do not treat the
//    "load everything" approach here as a permanent architectural
//    decision — it's an explicitly deferred tradeoff, revisit once
//    real movement-volume data justifies the added complexity.
// ✅ CORRECTED CLAIM — for selectedDate === today, this hook's
//    replayed result is EXPECTED to match InventoryItem.currentStock
//    under normal conditions (both are derived from the same
//    movement/batch history), but this is NOT a strictly GUARANTEED
//    invariant enforced anywhere — currentStock is a denormalized,
//    separately-written field (see inventory-repository.ts/
//    inventory-service.ts), and a data-consistency drift between it
//    and the batch/movement history (however rare) would surface as
//    a real difference here. This hook does not special-case "today"
//    to force-match currentStock — it always replays honestly from
//    batches+movements, which is precisely what makes it useful for
//    catching such drift if it ever occurs, rather than papering
//    over it.
// ✅ Replay runs via useMemo, recomputing ONLY when batches,
//    movements, or selectedDate actually change.
// ✅ Item-level aggregation: for each InventoryItem, historicalStock
//    = sum of quantity across all VISIBLE HistoricalBatchState
//    entries whose batch belongs to that item. An item with zero
//    visible batches as of selectedDate is excluded from
//    itemsWithHistoricalStock entirely.
// FROZEN
// ============================================

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";
import { InventoryBatch } from "../types/inventory-batch";
import { useAllInventoryBatches } from "./useAllInventoryBatches";
import { replayBatchesAsOfDate, HistoricalBatchState } from "../services/historical-batch-replay-service";

function movementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

export interface HistoricalItemStock {
  inventoryId:      string;
  itemName:         string;
  unit:             string;
  historicalStock:  number;
  batches:          HistoricalBatchState[];
  hasInconsistency: boolean;
}

export interface UseHistoricalInventoryResult {
  batchStates:              HistoricalBatchState[];
  itemsWithHistoricalStock: HistoricalItemStock[];
  loading:                  boolean;
  error:                    string | null;
}

export function useHistoricalInventory(
  restaurantId: string | null | undefined,
  selectedDate: string
): UseHistoricalInventoryResult {
  const { batches, loading: batchesLoading, error: batchesError } = useAllInventoryBatches(restaurantId);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setMovements([]);
      setMovementsError(null);
      setMovementsLoading(false);
      return;
    }

    setMovementsLoading(true);
    setMovementsError(null);

    // ⚠️ Unbounded — see FROZEN header's "KNOWN SCALING LIMIT" note.
    const unsubscribe = onSnapshot(
      query(movementsCollection(restaurantId)),
      (snap) => {
        setMovements(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, "id">) })));
        setMovementsLoading(false);
      },
      (err) => {
        setMovementsError(err.message);
        setMovementsLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  const batchStates = useMemo(
    () => replayBatchesAsOfDate(batches, movements, selectedDate),
    [batches, movements, selectedDate]
  );

  const itemsWithHistoricalStock = useMemo(() => {
    const batchByInventoryId = new Map<string, InventoryBatch>();
    for (const b of batches) batchByInventoryId.set(b.id, b);

    const byItem = new Map<string, HistoricalItemStock>();

    for (const state of batchStates) {
      const batch = batchByInventoryId.get(state.batchId);
      if (!batch) continue;

      const existing = byItem.get(batch.inventoryId);
      const entry: HistoricalItemStock = existing ?? {
        inventoryId:      batch.inventoryId,
        itemName:         state.itemName,
        unit:             state.unit,
        historicalStock:  0,
        batches:          [],
        hasInconsistency: false,
      };

      if (state.inconsistent) entry.hasInconsistency = true;

      if (state.visible) {
        entry.historicalStock += state.quantity;
        entry.batches.push(state);
      }

      byItem.set(batch.inventoryId, entry);
    }

    return Array.from(byItem.values()).filter((item) => item.batches.length > 0);
  }, [batchStates, batches]);

  return {
    batchStates,
    itemsWithHistoricalStock,
    loading: batchesLoading || movementsLoading,
    error: batchesError ?? movementsError,
  };
}