// ============================================
// SERVORA ERP — useInventoryMonthlyReport Hook
// ✅ Step 1 of the Inventory Monthly Report feature — pure data
//    aggregation layer, NO UI. Combines THREE independent data
//    sources into one flat, chronological list of "report events"
//    for a given month:
//    1. stockMovements (PURCHASE/KITCHEN_ISSUE/WASTE/TRANSFER_*/
//       ADJUSTMENT) — reuses the SAME live onSnapshot subscription
//       pattern already used by useHistoricalInventory.ts (restaurant-
//       wide, not date-scoped at the query level — filtered in-memory
//       to the selected month instead, same architecture decision
//       already frozen there).
//    2. InventoryItem.archivedAt — item-level archive events.
//    3. InventoryBatch.archivedAt — batch-level archive events
//       (independent of item-level, per the confirmed batch-archive
//       architecture).
// ✅ Month is identified as a "YYYY-MM" string. isInMonth() compares
//    the UTC-derived YYYY-MM prefix of a date, consistent with the
//    UTC-based date-key convention used throughout this module
//    (historical-batch-replay-service.ts's toDateKey(), etc.).
// ✅ Stat totals (received/issued/waste/archived/currentStockValue)
//    are computed HERE, once, from the same event list the table
//    itself renders — no separate/duplicated aggregation logic.
// ✅ currentStockValue is intentionally NOT month-scoped — it is
//    "as of right now" (sum of unitCost × currentStock across all
//    active items), same as InventoryStats.tsx's own existing
//    Total Value card. Included for at-a-glance context alongside
//    the month's activity, not as a historical month-end snapshot
//    (no such snapshot exists in this architecture).
// ✅ CONFIRMED MOVEMENT MAPPING — RETURN is intentionally NOT
//    mapped (not part of the confirmed design; its exact accounting
//    meaning — supplier return vs kitchen return vs stock return —
//    was never confirmed, so it's excluded rather than guessed).
// ✅ CONFIRMED EXCLUSION — TRANSFER_OUT movements with
//    reasonCategory === "DATA_CORRECTION" are excluded entirely
//    (skipped before any event is built) — these represent
//    moveBatchToItem() fixing a batch that was received against the
//    wrong item, NOT a genuine operational transfer. This mirrors
//    historical-batch-replay-service.ts's own isRealStockDeduction()
//    rule, keeping Monthly Report and Historical Inventory
//    consistent about what counts as a "real" movement.
// FROZEN
// ============================================

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { StockMovement, StockMovementType } from "../../stock-movement-module/types/stock-movement";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch } from "../types/inventory-batch";
import { useAllInventoryBatches } from "./useAllInventoryBatches";
import { toJsDate, toDateKey } from "../services/historical-batch-replay-service";

function movementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

export type ReportEventKind = "RECEIVED" | "ISSUED" | "WASTE" | "TRANSFER" | "ADJUSTMENT" | "ARCHIVED_ITEM" | "ARCHIVED_BATCH";

export interface ReportEvent {
  id:          string; // unique key for list rendering
  dateKey:     string; // YYYY-MM-DD
  kind:        ReportEventKind;
  itemName:    string;
  categoryId:  string | null;
  batchNo:     string | null;
  quantity:    number | null; // absolute quantity for this event, null when not applicable (e.g. item archive with no single batch)
  unit:        string;
  note:        string | null;
}

export interface InventoryMonthlyReportResult {
  events:             ReportEvent[]; // chronological (oldest first), for the selected month only
  totalReceivedQty:   number;
  totalIssuedQty:     number;
  totalWasteQty:      number;
  totalArchivedCount: number; // items + batches archived this month, combined count
  currentStockValue:  number; // as-of-now, NOT month-scoped — see FROZEN header
  loading:            boolean;
  error:              string | null;
}

function isInMonth(dateKey: string, monthKey: string): boolean {
  return dateKey.startsWith(monthKey);
}

// ✅ CONFIRMED — RETURN intentionally not mapped (see FROZEN header).
const MOVEMENT_KIND_BY_TYPE: Partial<Record<StockMovementType, ReportEventKind>> = {
  PURCHASE:      "RECEIVED",
  KITCHEN_ISSUE: "ISSUED",
  WASTE:         "WASTE",
  TRANSFER_IN:   "TRANSFER",
  TRANSFER_OUT:  "TRANSFER",
  ADJUSTMENT:    "ADJUSTMENT",
};

export function useInventoryMonthlyReport(
  restaurantId: string | null | undefined,
  monthKey: string, // "YYYY-MM"
  items: InventoryItem[]
): InventoryMonthlyReportResult {
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

  const itemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const events = useMemo(() => {
    const result: ReportEvent[] = [];

    // ── Stock movements (received/issued/waste/transfer/adjustment) ──
    for (const m of movements) {
      const kind = MOVEMENT_KIND_BY_TYPE[m.movementType];
      if (!kind) continue;

      // ✅ CONFIRMED — exclude data-correction transfers entirely
      // (see FROZEN header) before building any event from them.
      if (m.movementType === "TRANSFER_OUT" && m.reasonCategory === "DATA_CORRECTION") continue;

      const jsDate = toJsDate(m.createdAt);
      if (!jsDate) continue;
      const dateKey = toDateKey(jsDate);
      if (!isInMonth(dateKey, monthKey)) continue;

      const item = itemById.get(m.inventoryId);

      if (m.batchAllocations && m.batchAllocations.length > 0) {
        for (const alloc of m.batchAllocations) {
          result.push({
            id:         `${m.id}-${alloc.batchId}`,
            dateKey,
            kind,
            itemName:   m.itemName,
            categoryId: item?.categoryId ?? null,
            batchNo:    alloc.batchNo,
            quantity:   alloc.quantity,
            unit:       m.unit,
            note:       m.reason ?? null,
          });
        }
      } else {
        result.push({
          id:         m.id,
          dateKey,
          kind,
          itemName:   m.itemName,
          categoryId: item?.categoryId ?? null,
          batchNo:    null,
          quantity:   Math.abs(m.quantityChanged),
          unit:       m.unit,
          note:       m.reason ?? null,
        });
      }
    }

    // ── Item-level archive events ──
    for (const item of items) {
      if (item.isActive !== false || !item.archivedAt) continue;
      const jsDate = toJsDate(item.archivedAt);
      if (!jsDate) continue;
      const dateKey = toDateKey(jsDate);
      if (!isInMonth(dateKey, monthKey)) continue;

      result.push({
        id:         `item-archive-${item.id}`,
        dateKey,
        kind:       "ARCHIVED_ITEM",
        itemName:   item.itemName,
        categoryId: item.categoryId ?? null,
        batchNo:    null,
        quantity:   null,
        unit:       item.unit,
        note:       "Item archived",
      });
    }

    // ── Batch-level archive events ──
    for (const batch of batches) {
      if (batch.isActive !== false || !batch.archivedAt) continue;
      const jsDate = toJsDate(batch.archivedAt);
      if (!jsDate) continue;
      const dateKey = toDateKey(jsDate);
      if (!isInMonth(dateKey, monthKey)) continue;

      const parentItem = itemById.get(batch.inventoryId);

      result.push({
        id:         `batch-archive-${batch.id}`,
        dateKey,
        kind:       "ARCHIVED_BATCH",
        itemName:   batch.itemName,
        categoryId: parentItem?.categoryId ?? null,
        batchNo:    batch.batchNo,
        quantity:   batch.quantity,
        unit:       batch.unit,
        note:       "Batch archived",
      });
    }

    result.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return result;
  }, [movements, items, batches, itemById, monthKey]);

  const totals = useMemo(() => {
    let totalReceivedQty = 0;
    let totalIssuedQty = 0;
    let totalWasteQty = 0;
    let totalArchivedCount = 0;

    for (const e of events) {
      if (e.kind === "RECEIVED" && e.quantity !== null) totalReceivedQty += e.quantity;
      if (e.kind === "ISSUED" && e.quantity !== null) totalIssuedQty += e.quantity;
      if (e.kind === "WASTE" && e.quantity !== null) totalWasteQty += e.quantity;
      if (e.kind === "ARCHIVED_ITEM" || e.kind === "ARCHIVED_BATCH") totalArchivedCount += 1;
    }

    return { totalReceivedQty, totalIssuedQty, totalWasteQty, totalArchivedCount };
  }, [events]);

  const currentStockValue = useMemo(() => {
    return items
      .filter((it) => it.isActive !== false)
      .reduce((sum, it) => sum + it.currentStock * it.unitCost, 0);
  }, [items]);

  return {
    events,
    totalReceivedQty:   totals.totalReceivedQty,
    totalIssuedQty:     totals.totalIssuedQty,
    totalWasteQty:      totals.totalWasteQty,
    totalArchivedCount: totals.totalArchivedCount,
    currentStockValue,
    loading: batchesLoading || movementsLoading,
    error:   batchesError ?? movementsError,
  };
}