// ============================================
// SERVORA ERP — useHistoricalInventory Hook
// ✅ Firestore querying + caching + item-level aggregation layer for
//    the date-navigated historical Inventory view. The PURE replay
//    logic lives entirely in historical-batch-replay-service.ts —
//    this hook only fetches data and hands it to that service.
// ✅ Batches — reuses useAllInventoryBatches() UNCHANGED (live
//    subscription, restaurant-wide).
// ✅ FIX — categoryId metadata cross-reference. HistoricalItemStock
//    now carries categoryId, sourced from the CALLER-SUPPLIED
//    inventoryItems list (already loaded by InventoryScreen via its
//    own useInventory() call) via an inventoryId join — NOT a new,
//    duplicate Firestore subscription. Historical QUANTITY remains
//    derived exclusively from batches+movements (the pure replay);
//    categoryId is purely UI-filtering metadata layered on top,
//    joined by inventoryId. This keeps the historical quantity's
//    source of truth exactly where it belongs while letting the UI
//    filter historical results by category.
// ✅ FIX — archived items are NEVER excluded from historical results.
//    isActive === false is a LIVE-inventory concept (used by
//    useItemSearch.ts to keep Kitchen from requesting a discontinued
//    item going forward) — it has no bearing on whether that item
//    genuinely HAD stock on some past date. If an item is archived
//    today but had visible batches on August 20th, the August 20th
//    historical view still shows it. This hook does not read or
//    filter on isActive at all — it simply doesn't have an opinion
//    on it, by design.
// ✅ Items with no matching metadata (e.g. the inventoryId no longer
//    exists in the caller's inventoryItems list at all — a rare
//    edge case, such as a fully deleted item that still has old
//    batch/movement history) fall back to categoryId: null rather
//    than being silently dropped from the historical results —
//    historical stock visibility should never depend on whether the
//    live item document still exists.
// ✅ CONFIRMED ARCHITECTURE — Option A: full movement history is
//    loaded ONCE via a single live subscription, then kept in
//    memory. Date navigation never triggers a new Firestore query.
// ⚠️ KNOWN SCALING LIMIT (intentionally deferred): this hook
//    downloads and holds ALL historical movements for the
//    restaurant, unbounded. A future migration to incremental,
//    coverage-range-based caching can replace only the movement-
//    fetching useEffect below without touching the pure replay
//    service or this hook's public return shape.
// ✅ For selectedDate === today, this hook's replayed result is
//    EXPECTED (not strictly guaranteed) to match
//    InventoryItem.currentStock — both derive from the same
//    movement/batch history, but currentStock is a separately-
//    written denormalized field, so this hook always replays
//    honestly rather than special-casing "today" to force a match.
// ✅ Replay runs via useMemo, recomputing only when batches,
//    movements, or selectedDate actually change.
// FROZEN
// ============================================

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";
import { InventoryBatch } from "../types/inventory-batch";
import { InventoryItem } from "../types/inventory";
import { useAllInventoryBatches } from "./useAllInventoryBatches";
import { replayBatchesAsOfDate, HistoricalBatchState } from "../services/historical-batch-replay-service";

function movementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

export interface HistoricalItemStock {
  inventoryId:      string;
  itemName:         string;
  categoryId:       string | null;
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
  selectedDate: string,
  inventoryItems: InventoryItem[]
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

    // ✅ FIX — categoryId metadata join, by inventoryId, from the
    // caller-supplied inventoryItems list (no new subscription).
    const itemMetaByInventoryId = new Map<string, InventoryItem>();
    for (const item of inventoryItems) itemMetaByInventoryId.set(item.id, item);

    const byItem = new Map<string, HistoricalItemStock>();

    for (const state of batchStates) {
      const batch = batchByInventoryId.get(state.batchId);
      if (!batch) continue;

      const existing = byItem.get(batch.inventoryId);
      const meta = itemMetaByInventoryId.get(batch.inventoryId);

      const entry: HistoricalItemStock = existing ?? {
        inventoryId:      batch.inventoryId,
        itemName:         state.itemName,
        // ✅ Never excludes archived items — categoryId is looked up
        // regardless of meta.isActive; if meta is missing entirely
        // (e.g. item fully deleted), falls back to null rather than
        // dropping this item's historical stock.
        categoryId:       meta?.categoryId ?? null,
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
  }, [batchStates, batches, inventoryItems]);

  return {
    batchStates,
    itemsWithHistoricalStock,
    loading: batchesLoading || movementsLoading,
    error: batchesError ?? movementsError,
  };
}