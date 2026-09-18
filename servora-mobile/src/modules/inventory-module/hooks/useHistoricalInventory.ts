// ============================================
// SERVORA ERP — useHistoricalInventory Hook
// ✅ Firestore querying + caching + item-level aggregation layer for
//    the date-navigated historical Inventory view. The PURE replay
//    logic lives entirely in historical-batch-replay-service.ts —
//    this hook only fetches data and hands it to that service.
// ✅ Batches — reuses useAllInventoryBatches() UNCHANGED.
// ✅ Archived items still show real historical batches/movements for
//    any selectedDate up to AND INCLUDING archivedAt's own date, and
//    are hidden from the day AFTER archivedAt onward.
// ✅ FIX — isArchivedAsOfDate() was using `selectedDate >=
//    toDateKey(archivedDate)`, which incorrectly hid the item on its
//    OWN archive date too (the item was still active for part of
//    that day). Changed to `selectedDate > toDateKey(archivedDate)`
//    — the archive date itself now shows the item, hidden only from
//    the following day onward. E.g. received 15 Sep, archived 18
//    Sep: 15/16/17/18 Sep all show it, 19 Sep onward hides it.
// ✅ FIX — item metadata lookup (from inventoryItems) can
//    intermittently miss for a given inventoryId across renders (an
//    observed timing inconsistency between useInventory()'s and
//    useAllInventoryBatches()'s independent Firestore listeners —
//    not yet root-caused with certainty). Two layers of defense:
//    1) A persistent cache (categoryByInventoryIdRef) remembers the
//       last-known categoryId for each inventoryId the FIRST time
//       meta was successfully found, used as a fallback when meta is
//       missing this render — prevents items from incorrectly
//       appearing under "Uncategorized" due to a transient lookup
//       miss.
//    2) The archive-date exclusion only runs when meta IS found this
//       render — if meta is missing, the item is never hidden
//       outright (real batch data is never silently dropped).
// ✅ CONFIRMED ARCHITECTURE — Option A: full movement history loaded
//    ONCE via a single live subscription, kept in memory.
// ✅ CONFIRMED FINAL SEMANTICS —
//    - HistoricalBatchState.quantity (from replayBatchAsOfDate) =
//      OPENING quantity for selectedDate.
//    - HistoricalItemStock.historicalStock (Total QTY) = CLOSING
//      quantity — computed HERE via same-date deduction subtraction.
//    - itemsWithHistoricalStock excludes items whose batches are ALL
//      invisible (depleted before selectedDate).
// ✅ depletedItems: items where EVERY one of their batches is
//    depleted (invisible) as of selectedDate. depletedSince is the
//    LATEST (max) depletedDate among the item's batches.
// FROZEN
// ============================================

import { useState, useEffect, useMemo, useRef } from "react";
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

// ✅ Returns true if this item should be EXCLUDED from the historical
// view for selectedDate — i.e. it was archived BEFORE selectedDate
// (the archive date itself still shows the item). Legacy archived
// items with no archivedAt recorded are always excluded (no date to
// compare against).
function isArchivedAsOfDate(meta: InventoryItem, selectedDate: string): boolean {
  if (meta.isActive !== false) return false; // never archived
  if (!meta.archivedAt) return true; // archived, but no date recorded — always hidden
  const archivedDate = toJsDate(meta.archivedAt);
  if (!archivedDate) return true;
  // ✅ FIX — archive date itself still shows the item; hidden only
  // from the following day onward.
  return selectedDate > toDateKey(archivedDate);
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

  // ✅ Persistent cache of the last-known categoryId for each
  // inventoryId — populated whenever meta IS found, read when meta
  // is missing. A plain ref, not state, since it's a side-channel
  // cache and should not itself trigger a re-render.
  const categoryByInventoryIdRef = useRef<Map<string, string | null>>(new Map());

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

    const byItem = new Map<string, HistoricalItemStock>();

    for (const state of batchStates) {
      const batch = batchById.get(state.batchId);
      if (!batch) continue;

      const existing = byItem.get(batch.inventoryId);
      const meta = itemMetaByInventoryId.get(batch.inventoryId);

      // ✅ Update the cache whenever meta IS found this render.
      if (meta) {
        categoryByInventoryIdRef.current.set(batch.inventoryId, meta.categoryId ?? null);
      }

      // ✅ Only exclude for archive-date when meta is found. If meta
      // is missing this render, never hide the item outright.
      if (meta && isArchivedAsOfDate(meta, selectedDate)) continue;

      // ✅ Resolve categoryId: prefer fresh meta, fall back to the
      // cached last-known value if meta is missing this render.
      const resolvedCategoryId = meta
        ? (meta.categoryId ?? null)
        : (categoryByInventoryIdRef.current.get(batch.inventoryId) ?? null);

      const entry: HistoricalItemStock = existing ?? {
        inventoryId:      batch.inventoryId,
        itemName:         state.itemName,
        categoryId:       resolvedCategoryId,
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