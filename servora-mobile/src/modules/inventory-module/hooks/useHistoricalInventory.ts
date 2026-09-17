// ============================================
// SERVORA ERP — useHistoricalInventory Hook
// ✅ Firestore querying + caching + item-level aggregation layer for
//    the date-navigated historical Inventory view. The PURE replay
//    logic lives entirely in historical-batch-replay-service.ts —
//    this hook only fetches data and hands it to that service.
// ✅ Batches — reuses useAllInventoryBatches() UNCHANGED.
// ✅ categoryId metadata cross-reference via inventoryItems join.
// ✅ RESTORED ORIGINAL INTENT + FIXED — "Archived items never
//    excluded from historical results" (the original design), but
//    now DATE-AWARE via archivedAt: an item archived on date X still
//    shows its real, unedited historical batches/movements for any
//    selectedDate BEFORE X, and is correctly hidden for selectedDate
//    on/after X. (A previous revision of this file's caller started
//    passing only pre-filtered "active" items, which broke this —
//    archived items vanished from EVERY date, including dates before
//    they were archived, which is wrong: history shouldn't change
//    retroactively just because an item was later archived.) Items
//    archived before archivedAt existed as a field (legacy data,
//    archivedAt missing) fall back to always-hidden, since there's
//    no date to compare against — same as being excluded outright.
// ✅ CONFIRMED ARCHITECTURE — Option A: full movement history loaded
//    ONCE via a single live subscription, kept in memory.
// ✅ CONFIRMED FINAL SEMANTICS —
//    - HistoricalBatchState.quantity (from replayBatchAsOfDate) =
//      OPENING quantity for selectedDate.
//    - HistoricalItemStock.historicalStock (Total QTY) = CLOSING
//      quantity — computed HERE via same-date deduction subtraction.
//    - itemsWithHistoricalStock excludes items whose batches are ALL
//      invisible (depleted before selectedDate) — this is CORRECT
//      for the normal table view (nothing to show), but means an
//      "Out of Stock" item disappears from this array entirely. See
//      depletedItems below for how the Out-of-Stock filter surfaces
//      these items separately.
// ✅ depletedItems: items where EVERY one of their batches is
//    depleted (invisible) as of selectedDate — i.e. the item itself
//    is genuinely Out of Stock on this date, not merely "has some
//    depleted batches." An item with even ONE batch still holding
//    stock is NOT included here. depletedSince is the LATEST (max)
//    depletedDate among the item's batches — the date its last
//    remaining batch ran out, which is when the item itself became
//    fully out of stock. A batch depleted ON selectedDate itself is
//    still visible=true that day (per replayBatchAsOfDate()'s
//    opening-quantity semantics) — it only becomes invisible, and
//    thus counted here, from the day AFTER its depletion.
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
// view for selectedDate — i.e. it was archived on/before selectedDate.
// Legacy archived items with no archivedAt recorded are always
// excluded (no date to compare against, so no way to know which
// historical dates should still show them).
function isArchivedAsOfDate(meta: InventoryItem, selectedDate: string): boolean {
  if (meta.isActive !== false) return false; // never archived
  if (!meta.archivedAt) return true; // archived, but no date recorded — always hidden
  const archivedDate = toJsDate(meta.archivedAt);
  if (!archivedDate) return true;
  return selectedDate >= toDateKey(archivedDate);
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
      if (!meta) continue; // item metadata truly not found — skip

      // ✅ Date-aware archive check — excludes this item's batches
      // only for dates on/after it was archived, keeps real history
      // intact for dates before.
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

  // ✅ items where ALL batches are depleted (invisible) as of
  // selectedDate. See FROZEN header for full rationale.
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