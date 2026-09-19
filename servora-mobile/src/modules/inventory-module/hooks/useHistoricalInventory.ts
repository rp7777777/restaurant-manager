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
// ✅ isArchivedAsOfDate() uses `selectedDate > toDateKey(archivedDate)`
//    — the archive date itself still shows the item, hidden only
//    from the following day onward.
// ✅ FIX (this revision) — the metadata cache now stores the FULL
//    snapshot needed for the archive-date decision (isActive AND
//    archivedAt), not just categoryId. Previously, when the live
//    meta lookup missed for a render, the code could show a
//    just-archived item's data under "Uncategorized" INSTEAD OF
//    correctly hiding it — because `if (meta && isArchivedAsOfDate(...))`
//    only ever ran the archive check when fresh meta was found; a
//    missing lookup skipped the check entirely rather than falling
//    back to a cached decision. Now: whenever fresh meta IS found,
//    its full { categoryId, isActive, archivedAt } snapshot is
//    cached. When meta is missing this render, the cached snapshot
//    (if any) is used to run the EXACT SAME archive-date check, so
//    an item correctly stays hidden past its archive date even
//    during a render where the live lookup momentarily misses. Only
//    truly never-seen items (no cache entry ever populated) fall
//    through to being shown under Uncategorized as a last resort —
//    this preserves the original goal (never silently drop real
//    batch data) without letting a stale/missing lookup resurrect an
//    item that should be hidden.
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

// ✅ The minimal snapshot of item metadata needed for the archive-
// date decision + display. Cached per-inventoryId so a momentary
// live-lookup miss can still make the correct archive/show decision.
interface MetaSnapshot {
  categoryId: string | null;
  isActive:   boolean;
  archivedAt: unknown;
}

function toMetaSnapshot(meta: InventoryItem): MetaSnapshot {
  return {
    categoryId: meta.categoryId ?? null,
    isActive:   meta.isActive !== false,
    archivedAt: meta.archivedAt ?? null,
  };
}

// ✅ Returns true if this item should be EXCLUDED from the historical
// view for selectedDate — i.e. it was archived BEFORE selectedDate
// (the archive date itself still shows the item). Legacy archived
// items with no archivedAt recorded are always excluded (no date to
// compare against).
function isArchivedAsOfDate(snapshot: MetaSnapshot, selectedDate: string): boolean {
  if (snapshot.isActive) return false; // never archived
  if (!snapshot.archivedAt) return true; // archived, but no date recorded — always hidden
  const archivedDate = toJsDate(snapshot.archivedAt);
  if (!archivedDate) return true;
  // Archive date itself still shows the item; hidden only from the
  // following day onward.
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

  // ✅ Persistent cache of the last-known FULL metadata snapshot for
  // each inventoryId — populated whenever meta IS found, read (for
  // both the archive check AND the display categoryId) when meta is
  // missing this render. A plain ref, not state, since it's a
  // side-channel cache and should not itself trigger a re-render.
  const metaSnapshotByInventoryIdRef = useRef<Map<string, MetaSnapshot>>(new Map());

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

      // ✅ Resolve the snapshot to use for THIS render: fresh meta
      // if found (and update the cache with it), otherwise fall
      // back to whatever was last cached for this inventoryId.
      let snapshot: MetaSnapshot | undefined;
      if (meta) {
        snapshot = toMetaSnapshot(meta);
        metaSnapshotByInventoryIdRef.current.set(batch.inventoryId, snapshot);
      } else {
        snapshot = metaSnapshotByInventoryIdRef.current.get(batch.inventoryId);
      }

      // ✅ Run the SAME archive check regardless of whether this
      // render's meta was fresh or cached — a just-archived item
      // stays correctly hidden past its archive date even during a
      // render where the live lookup momentarily misses. Only items
      // with NO snapshot at all (never once seen) fall through
      // unfiltered, as a last-resort "never drop real data" guard.
      if (snapshot && isArchivedAsOfDate(snapshot, selectedDate)) continue;

      const resolvedCategoryId = snapshot?.categoryId ?? null;

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