// ============================================
// SERVORA ERP — useHistoricalInventory Hook
// ✅ Firestore querying + caching + item-level aggregation layer for
//    the date-navigated historical Inventory view. The PURE replay
//    logic lives entirely in historical-batch-replay-service.ts —
//    this hook only fetches data and hands it to that service.
// ✅ Batches — reuses useAllInventoryBatches() UNCHANGED.
// ✅ categoryId metadata cross-reference via inventoryItems join.
// ✅ Archived items never excluded from historical results.
// ✅ CONFIRMED ARCHITECTURE — Option A: full movement history loaded
//    ONCE via a single live subscription, kept in memory.
// ⚠️ KNOWN SCALING LIMIT (intentionally deferred).
// ✅ For selectedDate === today, replayed result is EXPECTED (not
//    guaranteed) to match InventoryItem.currentStock.
// ✅ NEW — HistoricalBatchWithIssues extends HistoricalBatchState
//    with an `issues` field (HistoricalIssueEntry[]), computed via
//    getIssuesForDate() (historical-batch-replay-service.ts,
//    UNCHANGED/FROZEN — this hook composes its output, never
//    modifies that pure function). This is a hook-layer composition
//    choice: the pure replay service stays focused on "closing stock
//    as of a date," this hook layers "what moved out on this exact
//    date" on top of it using the SAME movements array already
//    loaded for replay — no additional Firestore query. issues is
//    computed per-batch, per-selectedDate, via useMemo alongside
//    batchStates.
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
import {
  replayBatchesAsOfDate, getIssuesForDate,
  HistoricalBatchState, HistoricalIssueEntry,
} from "../services/historical-batch-replay-service";

function movementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

// ✅ NEW — HistoricalBatchState + per-date issues, composed here.
export interface HistoricalBatchWithIssues extends HistoricalBatchState {
  issues: HistoricalIssueEntry[];
}

export interface HistoricalItemStock {
  inventoryId:      string;
  itemName:         string;
  categoryId:       string | null;
  unit:             string;
  historicalStock:  number;
  batches:          HistoricalBatchWithIssues[];
  hasInconsistency: boolean;
}

export interface UseHistoricalInventoryResult {
  batchStates:              HistoricalBatchWithIssues[];
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

  // ✅ FIX — pre-group movements by batchId ONCE (not per-batch
  // scanning). Previously getIssuesForDate() was called once per
  // batch, each call re-scanning the ENTIRE movements array — at
  // scale (many batches × many movements) this is quadratic. Now
  // movements are grouped by allocated batchId a single time, and
  // getIssuesForDate() only ever receives the (much smaller) slice
  // relevant to that specific batch.
  const batchStates = useMemo<HistoricalBatchWithIssues[]>(() => {
    const movementsByBatchId = new Map<string, StockMovement[]>();
    for (const movement of movements) {
      for (const allocation of movement.batchAllocations ?? []) {
        const list = movementsByBatchId.get(allocation.batchId) ?? [];
        list.push(movement);
        movementsByBatchId.set(allocation.batchId, list);
      }
    }

    const replayed = replayBatchesAsOfDate(batches, movements, selectedDate);
    return replayed.map((state) => ({
      ...state,
      issues: getIssuesForDate(
        state.batchId,
        movementsByBatchId.get(state.batchId) ?? [],
        selectedDate
      ),
    }));
  }, [batches, movements, selectedDate]);

  const itemsWithHistoricalStock = useMemo(() => {
    // ✅ FIX — renamed from batchByInventoryId (misleading — key is
    // actually batch.id, not inventoryId) to batchById.
    const batchById = new Map<string, InventoryBatch>();
    for (const b of batches) batchById.set(b.id, b);

    const itemMetaByInventoryId = new Map<string, InventoryItem>();
    for (const item of inventoryItems) itemMetaByInventoryId.set(item.id, item);

    const byItem = new Map<string, HistoricalItemStock>();

    for (const state of batchStates) {
      const batch = batchById.get(state.batchId);
      if (!batch) continue;

      const existing = byItem.get(batch.inventoryId);
      const meta = itemMetaByInventoryId.get(batch.inventoryId);

      const entry: HistoricalItemStock = existing ?? {
        inventoryId:      batch.inventoryId,
        itemName:         state.itemName,
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