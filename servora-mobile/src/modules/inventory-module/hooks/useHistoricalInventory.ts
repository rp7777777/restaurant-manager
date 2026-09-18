// ============================================
// SERVORA ERP — useHistoricalInventory Hook
// ⚠️ TEMPORARY DEBUG BUILD — console.log tracing added to find why
//    "apple" (archived today, received 07 Sept) is missing from the
//    07 Sept historical view. REMOVE once root cause is found.
// ✅ Firestore querying + caching + item-level aggregation layer for
//    the date-navigated historical Inventory view. The PURE replay
//    logic lives entirely in historical-batch-replay-service.ts —
//    this hook only fetches data and hands it to that service.
// ✅ RESTORED ORIGINAL INTENT + FIXED — archived items still show
//    real historical data for dates BEFORE archivedAt, hidden on/
//    after.
// FROZEN (except debug logging, which is temporary)
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
  replayBatchesAsOfDate, getIssuesForDate, isRealStockDeduction,
  toJsDate, toDateKey,
  HistoricalBatchState, HistoricalIssueEntry,
} from "../services/historical-batch-replay-service";

function movementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

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

export interface DepletedItemInfo {
  inventoryId:   string;
  itemName:      string;
  depletedSince: string; // YYYY-MM-DD
}

export interface UseHistoricalInventoryResult {
  batchStates:              HistoricalBatchWithIssues[];
  itemsWithHistoricalStock: HistoricalItemStock[];
  depletedItems:            DepletedItemInfo[];
  loading:                  boolean;
  error:                    string | null;
}

function isArchivedAsOfDate(meta: InventoryItem, selectedDate: string): boolean {
  if (meta.isActive !== false) return false; // never archived
  if (!meta.archivedAt) return true; // archived, but no date recorded — always hidden
  const archivedDate = toJsDate(meta.archivedAt);
  if (!archivedDate) return true;
  const archivedDateKey = toDateKey(archivedDate);
  const result = selectedDate >= archivedDateKey;

  if (meta.itemName === "apple") {
    console.log("[DEBUG apple isArchivedAsOfDate]", {
      selectedDate,
      isActive: meta.isActive,
      archivedAtRaw: meta.archivedAt,
      archivedDateParsed: archivedDate?.toString(),
      archivedDateKey,
      excluded: result,
    });
  }

  return result;
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

  // ⚠️ TEMP DEBUG — log the raw inventoryItems array as soon as it changes
  useEffect(() => {
    console.log("[DEBUG inventoryItems array]", {
      length: inventoryItems.length,
      names: inventoryItems.map((i) => ({ name: i.itemName, id: i.id, isActive: i.isActive })),
    });
  }, [inventoryItems]);

  const { batchStates, closingQuantityByBatchId } = useMemo(() => {
    const movementsByBatchId = new Map<string, StockMovement[]>();
    for (const movement of movements) {
      for (const allocation of movement.batchAllocations ?? []) {
        const list = movementsByBatchId.get(allocation.batchId) ?? [];
        list.push(movement);
        movementsByBatchId.set(allocation.batchId, list);
      }
    }

    const replayed = replayBatchesAsOfDate(batches, movements, selectedDate);

    // ⚠️ TEMP DEBUG
    const appleBatchesRaw = batches.filter((b) => b.itemName === "apple");
    const appleReplayed = replayed.filter((s) => s.itemName === "apple");
    console.log("[DEBUG apple batches raw]", appleBatchesRaw.map((b) => ({ id: b.id, inventoryId: b.inventoryId, receivedDate: b.receivedDate, quantity: b.quantity })));
    console.log("[DEBUG apple replayed for", selectedDate, "]", appleReplayed.map((s) => ({ batchId: s.batchId, quantity: s.quantity, visible: s.visible, receivedDate: s.receivedDate })));

    const states: HistoricalBatchWithIssues[] = replayed.map((state) => ({
      ...state,
      issues: getIssuesForDate(
        state.batchId,
        movementsByBatchId.get(state.batchId) ?? [],
        selectedDate
      ),
    }));

    const closingMap = new Map<string, number>();
    for (const state of states) {
      const batchMovements = movementsByBatchId.get(state.batchId) ?? [];
      let sameDayDeductedQty = 0;

      for (const movement of batchMovements) {
        if (!isRealStockDeduction(movement)) continue;

        const jsDate = toJsDate(movement.createdAt);
        if (!jsDate) continue;
        if (toDateKey(jsDate) !== selectedDate) continue;

        const allocation = (movement.batchAllocations ?? []).find((a) => a.batchId === state.batchId);
        if (allocation && Number.isFinite(allocation.quantity) && allocation.quantity > 0) {
          sameDayDeductedQty += allocation.quantity;
        }
      }

      closingMap.set(state.batchId, Math.max(0, state.quantity - sameDayDeductedQty));
    }

    return { batchStates: states, closingQuantityByBatchId: closingMap };
  }, [batches, movements, selectedDate]);

  const itemsWithHistoricalStock = useMemo(() => {
    const batchById = new Map<string, InventoryBatch>();
    for (const b of batches) batchById.set(b.id, b);

    const itemMetaByInventoryId = new Map<string, InventoryItem>();
    for (const item of inventoryItems) itemMetaByInventoryId.set(item.id, item);

    const appleMeta = inventoryItems.find((i) => i.itemName === "apple");
    console.log("[DEBUG apple meta lookup]", appleMeta ? { id: appleMeta.id, isActive: appleMeta.isActive, archivedAt: appleMeta.archivedAt, categoryId: appleMeta.categoryId } : "NOT FOUND IN inventoryItems ARRAY");

    const byItem = new Map<string, HistoricalItemStock>();

    for (const state of batchStates) {
      const batch = batchById.get(state.batchId);
      if (!batch) continue;

      const existing = byItem.get(batch.inventoryId);
      const meta = itemMetaByInventoryId.get(batch.inventoryId);

      if (state.itemName === "apple") {
        console.log("[DEBUG apple in batchStates loop]", { batchId: state.batchId, inventoryId: batch.inventoryId, metaFound: !!meta, visible: state.visible, willInclude: !!meta && !isArchivedAsOfDate(meta, selectedDate) });
      }

      if (!meta) continue; // item metadata truly not found — skip

      if (isArchivedAsOfDate(meta, selectedDate)) continue;

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
        const closingQuantity = closingQuantityByBatchId.get(state.batchId) ?? state.quantity;
        entry.historicalStock += closingQuantity;
        entry.batches.push(state);
      }

      byItem.set(batch.inventoryId, entry);
    }

    return Array.from(byItem.values()).filter((item) => item.batches.length > 0);
  }, [batchStates, batches, inventoryItems, selectedDate, closingQuantityByBatchId]);

  const depletedItems = useMemo(() => {
    const batchById = new Map<string, InventoryBatch>();
    for (const b of batches) batchById.set(b.id, b);

    const byItem = new Map<string, { itemName: string; batchDepletionInfo: Array<{ visible: boolean; depletedDate: string | null }> }>();

    for (const state of batchStates) {
      const batch = batchById.get(state.batchId);
      if (!batch) continue;

      const existing = byItem.get(batch.inventoryId);
      const entry = existing ?? { itemName: state.itemName, batchDepletionInfo: [] };
      entry.batchDepletionInfo.push({ visible: state.visible, depletedDate: state.depletedDate });
      byItem.set(batch.inventoryId, entry);
    }

    const result: DepletedItemInfo[] = [];

    for (const [inventoryId, entry] of byItem.entries()) {
      if (entry.batchDepletionInfo.length === 0) continue;

      const allDepleted = entry.batchDepletionInfo.every((b) => !b.visible);
      if (!allDepleted) continue;

      const depletedDates = entry.batchDepletionInfo
        .map((b) => b.depletedDate)
        .filter((d): d is string => d !== null);
      if (depletedDates.length === 0) continue;

      const depletedSince = depletedDates.reduce((max, d) => (d > max ? d : max), depletedDates[0]);

      result.push({ inventoryId, itemName: entry.itemName, depletedSince });
    }

    return result;
  }, [batchStates, batches]);

  return {
    batchStates,
    itemsWithHistoricalStock,
    depletedItems,
    loading: batchesLoading || movementsLoading,
    error: batchesError ?? movementsError,
  };
}