// ============================================
// SERVORA ERP — useHistoricalInventory Hook
// ✅ Firestore querying + caching + item-level aggregation layer for
//    the date-navigated historical Inventory view. The PURE replay
//    logic lives entirely in historical-batch-replay-service.ts —
//    this hook only fetches data and hands it to that service.
// ✅ Batches — reuses useAllInventoryBatches() UNCHANGED.
// ✅ CONFIRMED ARCHITECTURE — Option A: full movement history loaded
//    ONCE via a single live subscription, kept in memory.
// ✅ CONFIRMED FINAL SEMANTICS —
//    - HistoricalBatchState.quantity (from replayBatchAsOfDate) =
//      OPENING quantity for selectedDate.
//    - HistoricalItemStock.historicalStock (Total QTY) = CLOSING
//      quantity — computed HERE via same-date deduction subtraction.
//    - itemsWithHistoricalStock excludes items whose batches are ALL
//      invisible (depleted before selectedDate).
// ✅ Total QTY EXCLUDES a batch's own quantity starting on (and
//    including) the exact date it was batch-level archived.
// ✅ depletedItems: items where EVERY one of their batches is
//    depleted (invisible) as of selectedDate. depletedSince is the
//    LATEST (max) depletedDate among the item's batches.
// ✅ MetaSnapshot restoredAt override: when the PARENT ITEM (not an
//    individual batch) was restored exactly on selectedDate, every
//    one of that item's visible batch rows gets isBatchRestoredToday
//    overridden to true for that one date.
// ✅ NEW — isArchivedDuring() REPLACES the old isArchivedAsOfDate():
//    now checks the FULL archiveHistory array (every past
//    archive/restore CYCLE), not just the current archivedAt/
//    isActive snapshot. This fixes a real bug: previously, restoring
//    an item made it look like it was "never archived" for ANY past
//    date — including dates that fell WITHIN its actual archived
//    period. E.g. archived 17 Sep, restored 22 Sep: 17 Sep shows
//    (archive date itself), 18-21 Sep correctly stay HIDDEN (the
//    real gap where it was genuinely archived), 22 Sep onward shows
//    again (restore date itself, and every date after — since the
//    item is simply active again going forward). Falls back to the
//    old archivedAt-only logic when archiveHistory is empty (legacy
//    items archived before this field existed).
// ✅ ADDITIVE (UI support only) — each HistoricalBatchWithIssues now
//    also carries closingQuantity: the SAME per-batch closing value
//    already computed in closingQuantityByBatchId (opening minus that
//    date's real deductions, floored at 0). Nothing about how opening,
//    closing, Total QTY, visibility or archive rules are calculated
//    changed — the existing value is just exposed per row so the table
//    can show Opening | Issue | Closing.
// ✅ CLOSING = NEXT DAY'S OPENING (review fix) — a batch's closing
//    quantity for selectedDate is now taken from the replay service
//    itself: replayBatchAsOfDate(batch, movements, selectedDate + 1)
//    applies every movement up to and including selectedDate, in
//    CHRONOLOGICAL order, with the exact same deduction/correction/
//    floor-at-0 rules as Opening. This replaces the old same-day
//    aggregate (opening − Σ deductions ± Σ corrections), which could
//    disagree with the replay when a batch hit 0 mid-day and was then
//    corrected (e.g. 5 − 10 → 0, then +10 = 10; the aggregate gave 5).
//    Closing therefore always equals the next day's Opening. A batch
//    not yet received on selectedDate has closing 0.
// ✅ BATCH DATA CHECK (approved feature) — batchChecksByInventoryId:
//    for every batch, computeBatchLedger() (batch-reconciliation-
//    service.ts, pure) compares the LIVE batch quantity with its
//    movement ledger. Batches that disagree (or carry a malformed
//    record) are grouped by inventoryId. hasInconsistency is now ALSO
//    true for an item with such a batch, so a mismatch the replay
//    alone cannot see (e.g. a batch set to 0 with no record while its
//    ledger stays positive) still shows the "data issue" badge. The
//    check is date-independent (live vs full ledger). Opening/closing/
//    visibility/archive rules are unchanged.
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
  computeBatchLedger, isBatchLedgerMismatch, BatchLedgerCheck,
} from "../services/batch-reconciliation-service";
import {
  replayBatchesAsOfDate, getIssuesForDate,
  toJsDate, toDateKey,
  HistoricalBatchState, HistoricalIssueEntry,
} from "../services/historical-batch-replay-service";

// Local calendar day after a "YYYY-MM-DD" key — same local-date
// convention as toDateKey() in the replay service.
function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + 1));
}

function movementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

export interface HistoricalBatchWithIssues extends HistoricalBatchState {
  issues: HistoricalIssueEntry[];
  closingQuantity: number; // CLOSING qty for selectedDate (= next day's replayed opening)
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
  batchChecksByInventoryId: Map<string, BatchLedgerCheck[]>;
  itemsWithHistoricalStock: HistoricalItemStock[];
  depletedItems:            DepletedItemInfo[];
  loading:                  boolean;
  error:                    string | null;
}

interface ArchiveCycle {
  archivedAt: unknown;
  restoredAt: unknown | null;
}

// ✅ The minimal snapshot of item metadata needed for the archive-
// date decision + display. Cached per-inventoryId so a momentary
// live-lookup miss can still make the correct archive/show decision.
interface MetaSnapshot {
  categoryId:     string | null;
  isActive:       boolean;
  archivedAt:     unknown;
  restoredAt:     unknown;
  archiveHistory: ArchiveCycle[];
}

function toMetaSnapshot(meta: InventoryItem): MetaSnapshot {
  return {
    categoryId:     meta.categoryId ?? null,
    isActive:       meta.isActive !== false,
    archivedAt:     meta.archivedAt ?? null,
    restoredAt:     meta.restoredAt ?? null,
    archiveHistory: meta.archiveHistory ?? [],
  };
}

// ✅ Returns true if this item should be EXCLUDED from the historical
// view for selectedDate — i.e. selectedDate falls within any PAST
// archive cycle recorded in archiveHistory. The archive date of a
// cycle shows the item; the restore date of a cycle (and everything
// after it, until the NEXT archive if any) shows the item again.
// Falls back to the simple archivedAt-only check when archiveHistory
// is empty (legacy data).
function isArchivedDuring(snapshot: MetaSnapshot, selectedDate: string): boolean {
  if (snapshot.archiveHistory.length > 0) {
    for (const cycle of snapshot.archiveHistory) {
      const archivedDate = toJsDate(cycle.archivedAt);
      if (!archivedDate) continue;
      const archivedKey = toDateKey(archivedDate);
      if (selectedDate < archivedKey) continue; // this cycle hadn't started yet

      if (cycle.restoredAt === null) {
        // Still open — archive date itself still shows the item,
        // hidden only strictly AFTER it.
        if (selectedDate > archivedKey) return true;
        continue;
      }

      const restoredDate = toJsDate(cycle.restoredAt);
      if (!restoredDate) return true; // malformed — conservatively treat as archived
      const restoredKey = toDateKey(restoredDate);
      if (selectedDate < restoredKey) return true; // archived strictly before the restore date
    }
    return false;
  }

  // Legacy fallback — no archiveHistory recorded yet.
  if (snapshot.isActive) return false;
  if (!snapshot.archivedAt) return true;
  const archivedDate = toJsDate(snapshot.archivedAt);
  if (!archivedDate) return true;
  return selectedDate > toDateKey(archivedDate);
}

// ✅ Returns true if the ITEM (not any individual batch) was restored
// exactly on selectedDate — used to also mark that item's batch rows
// as "Restored" that day, even when no batch was individually
// archived/restored.
function isItemRestoredToday(snapshot: MetaSnapshot, selectedDate: string): boolean {
  if (!snapshot.restoredAt) return false;
  const restoredDate = toJsDate(snapshot.restoredAt);
  if (!restoredDate) return false;
  return toDateKey(restoredDate) === selectedDate;
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

    const states: Omit<HistoricalBatchWithIssues, "closingQuantity">[] = replayed.map((state) => ({
      ...state,
      issues: getIssuesForDate(
        state.batchId,
        movementsByBatchId.get(state.batchId) ?? [],
        selectedDate
      ),
    }));

    // ✅ Closing = the replay's own opening for the NEXT day (see header).
    const replayedNextDay = replayBatchesAsOfDate(batches, movements, nextDateKey(selectedDate));
    const nextDayQuantityByBatchId = new Map(replayedNextDay.map((s) => [s.batchId, s.quantity]));

    const closingMap = new Map<string, number>();
    for (const state of states) {
      const closing = selectedDate < state.receivedDate
        ? 0
        : nextDayQuantityByBatchId.get(state.batchId) ?? state.quantity;
      closingMap.set(state.batchId, closing);
    }

    const statesWithClosing: HistoricalBatchWithIssues[] = states.map((state) => ({
      ...state,
      closingQuantity: closingMap.get(state.batchId) ?? state.quantity,
    }));

    return { batchStates: statesWithClosing, closingQuantityByBatchId: closingMap };
  }, [batches, movements, selectedDate]);

  // ✅ Batch Data Check — live quantity vs movement ledger (see header).
  const batchChecksByInventoryId = useMemo(() => {
    const movementsByBatchId = new Map<string, StockMovement[]>();
    for (const movement of movements) {
      for (const allocation of movement.batchAllocations ?? []) {
        const list = movementsByBatchId.get(allocation.batchId) ?? [];
        list.push(movement);
        movementsByBatchId.set(allocation.batchId, list);
      }
    }

    const map = new Map<string, BatchLedgerCheck[]>();
    for (const batch of batches) {
      const check = computeBatchLedger(batch, movementsByBatchId.get(batch.id) ?? []);
      if (!isBatchLedgerMismatch(check)) continue;
      const list = map.get(batch.inventoryId) ?? [];
      list.push(check);
      map.set(batch.inventoryId, list);
    }
    return map;
  }, [batches, movements]);

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
      if (snapshot && isArchivedDuring(snapshot, selectedDate)) continue;

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

      if (state.inconsistent || batchChecksByInventoryId.has(batch.inventoryId)) {
        entry.hasInconsistency = true;
      }

      if (state.visible) {
        // ✅ Total QTY excludes this batch's own quantity starting on
        // (and including) its own archive date. The batch ROW itself
        // still gets pushed below (still visible, still shows its
        // "Archived" indicator via isBatchArchived/batchArchivedDate)
        // — only the SUM changes.
        const isArchivedOnOrBeforeSelectedDate =
          state.isBatchArchived && state.batchArchivedDate !== null && selectedDate >= state.batchArchivedDate;

        if (!isArchivedOnOrBeforeSelectedDate) {
          const closingQuantity = closingQuantityByBatchId.get(state.batchId) ?? state.quantity;
          entry.historicalStock += closingQuantity;
        }

        // ✅ If the PARENT ITEM (not this specific batch) was
        // restored exactly on selectedDate, show the "Restored"
        // indicator on this batch's row too — even though the batch
        // itself was never individually archived/restored.
        const finalState = (!state.isBatchRestoredToday && snapshot && isItemRestoredToday(snapshot, selectedDate))
          ? { ...state, isBatchRestoredToday: true }
          : state;

        entry.batches.push(finalState);
      }

      byItem.set(batch.inventoryId, entry);
    }

    return Array.from(byItem.values()).filter((item) => item.batches.length > 0);
  }, [batchStates, batches, inventoryItems, selectedDate, closingQuantityByBatchId, batchChecksByInventoryId]);

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
    batchChecksByInventoryId,
    itemsWithHistoricalStock,
    depletedItems,
    loading: batchesLoading || movementsLoading,
    error: batchesError ?? movementsError,
  };
}