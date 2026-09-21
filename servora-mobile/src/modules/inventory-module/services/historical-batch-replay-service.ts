// ============================================
// SERVORA ERP — Historical Batch Replay Service
// ✅ PURE FUNCTION — no Firestore calls, no React, no side effects.
// ✅ CONFIRMED FINAL SEMANTICS —
//    - "quantity" (Lot/Batch QTY, per-row) is the OPENING quantity
//      for selectedDate: movements dated STRICTLY BEFORE selectedDate
//      are applied (`dateKey >= selectedDate` breaks the loop,
//      excluding that day's own movements).
//    - Total QTY (item-level, computed in useHistoricalInventory.ts,
//      NOT here) is the CLOSING quantity.
// ✅ CRITICAL — relevantMovements filters to an explicit
//    DEDUCTING_MOVEMENT_TYPES allowlist BEFORE checking
//    batchAllocations.
// ✅ isRealStockDeduction()/toJsDate()/toDateKey() — EXPORTED for
//    useHistoricalInventory.ts to reuse.
// ✅ originalQuantity is EXPOSED on the returned state.
// ✅ SAFETY — quantity is NEVER allowed to go negative.
// ✅ isBatchArchived/batchArchivedDate — batch-level archive
//    visibility: archived batch stays visible through its own
//    archive date, hidden from the day after.
// ✅ NEW — isBatchRestoredToday/batchRestoredDate: mirrors the
//    archive indicator, but for RESTORE. isBatchRestoredToday is
//    true ONLY when selectedDate exactly equals the batch's
//    restoredAt date (batchRestoredDate) — a purely cosmetic,
//    single-day indicator for the UI (Step 4) to show "Restored" on
//    that exact date's row, with no effect on any other date
//    (unlike the archive flag, restoredAt does NOT affect visibility
//    or quantity at all — a restored batch is simply active again,
//    fully governed by the normal quantity/visible logic below).
// FROZEN
// ============================================

import { InventoryBatch } from "../types/inventory-batch";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";

export interface HistoricalBatchState {
  batchId:            string;
  batchNo:            string;
  itemName:           string;
  unit:               string;
  receivedDate:       string;    // YYYY-MM-DD
  expiryDate:         string | null;
  originalQuantity:   number;
  quantity:           number;    // OPENING quantity as of selectedDate
  visible:            boolean;
  depletedDate:       string | null;
  inconsistent:       boolean;
  isBatchArchived:    boolean;   // true if this batch itself was archived (independent of the parent item)
  batchArchivedDate:  string | null; // YYYY-MM-DD the batch was archived on, or null if never
  isBatchRestoredToday: boolean; // true ONLY when selectedDate exactly matches batchRestoredDate — cosmetic, single-day UI indicator only
  batchRestoredDate:  string | null; // YYYY-MM-DD the batch was last restored on, or null if never
}

export function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  const anyVal = value as any;
  if (typeof anyVal.toDate === "function") return anyVal.toDate();
  const d = new Date(anyVal);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DEDUCTING_MOVEMENT_TYPES = new Set(["KITCHEN_ISSUE", "WASTE", "TRANSFER_OUT"]);

export function isRealStockDeduction(movement: StockMovement): boolean {
  if (!DEDUCTING_MOVEMENT_TYPES.has(movement.movementType)) return false;
  if (movement.movementType === "TRANSFER_OUT" && movement.reasonCategory === "DATA_CORRECTION") {
    return false;
  }
  return true;
}

function isBatchArchivedAsOfDate(batch: InventoryBatch, selectedDate: string): boolean {
  if (batch.isActive !== false) return false;
  if (!batch.archivedAt) return false;
  const archivedDate = toJsDate(batch.archivedAt);
  if (!archivedDate) return false;
  return selectedDate > toDateKey(archivedDate);
}

function getBatchArchivedDateKey(batch: InventoryBatch): string | null {
  if (batch.isActive !== false || !batch.archivedAt) return null;
  const d = toJsDate(batch.archivedAt);
  return d ? toDateKey(d) : null;
}

// ✅ Restore date key — independent of current isActive status (a
// batch can be restored today, then archived again later — this
// still reports the LAST restore date, same "last event only, not
// full history" semantics as the field itself).
function getBatchRestoredDateKey(batch: InventoryBatch): string | null {
  if (!batch.restoredAt) return null;
  const d = toJsDate(batch.restoredAt);
  return d ? toDateKey(d) : null;
}

export function replayBatchAsOfDate(
  batch: InventoryBatch,
  movements: StockMovement[],
  selectedDate: string
): HistoricalBatchState {
  const batchArchivedDate = getBatchArchivedDateKey(batch);
  const isBatchArchived = batch.isActive === false;
  const batchRestoredDate = getBatchRestoredDateKey(batch);
  const isBatchRestoredToday = batchRestoredDate !== null && batchRestoredDate === selectedDate;

  const base: Omit<HistoricalBatchState, "quantity" | "visible" | "depletedDate" | "inconsistent"> = {
    batchId:           batch.id,
    batchNo:           batch.batchNo,
    itemName:          batch.itemName,
    unit:              batch.unit,
    receivedDate:      batch.receivedDate,
    expiryDate:        batch.expiryDate ?? null,
    originalQuantity:  batch.originalQuantity,
    isBatchArchived,
    batchArchivedDate,
    isBatchRestoredToday,
    batchRestoredDate,
  };

  if (selectedDate < batch.receivedDate) {
    return { ...base, quantity: 0, visible: false, depletedDate: null, inconsistent: false };
  }

  const relevantMovements = movements
    .filter((m) => isRealStockDeduction(m))
    .filter((m) => (m.batchAllocations ?? []).some((a) => a.batchId === batch.id))
    .map((m) => {
      const jsDate = toJsDate(m.createdAt);
      return jsDate ? { movement: m, date: jsDate, dateKey: toDateKey(jsDate) } : null;
    })
    .filter((x): x is { movement: StockMovement; date: Date; dateKey: string } => x !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let quantity = batch.originalQuantity;
  let depletedDate: string | null = null;
  let inconsistent = false;

  for (const { dateKey, movement } of relevantMovements) {
    if (dateKey >= selectedDate) break;

    const allocation = (movement.batchAllocations ?? []).find((a) => a.batchId === batch.id);
    if (!allocation) continue;

    if (!Number.isFinite(allocation.quantity) || allocation.quantity < 0) {
      inconsistent = true;
      continue;
    }

    const next = quantity - allocation.quantity;
    quantity = next < 0 ? 0 : next;
    if (next < 0) inconsistent = true;

    if (quantity === 0 && depletedDate === null) {
      depletedDate = dateKey;
    }
  }

  if (depletedDate !== null && selectedDate > depletedDate) {
    return { ...base, quantity: 0, visible: false, depletedDate, inconsistent };
  }

  if (isBatchArchivedAsOfDate(batch, selectedDate)) {
    return { ...base, quantity, visible: false, depletedDate, inconsistent };
  }

  return { ...base, quantity, visible: true, depletedDate, inconsistent };
}

export function replayBatchesAsOfDate(
  batches: InventoryBatch[],
  movements: StockMovement[],
  selectedDate: string
): HistoricalBatchState[] {
  return batches.map((batch) => replayBatchAsOfDate(batch, movements, selectedDate));
}

export interface HistoricalIssueEntry {
  quantity: number;
  source:   string;
}

function deriveIssueSource(movementType: string, reasonCategory?: string): string {
  if (movementType === "KITCHEN_ISSUE") return "Kitchen";
  if (movementType === "WASTE") return "Waste";
  if (movementType === "TRANSFER_OUT") {
    return reasonCategory === "DATA_CORRECTION" ? "Correction" : "Transfer";
  }
  return movementType;
}

export function getIssuesForDate(
  batchId: string,
  movements: StockMovement[],
  selectedDate: string
): HistoricalIssueEntry[] {
  const entries: HistoricalIssueEntry[] = [];

  for (const movement of movements) {
    if (!isRealStockDeduction(movement)) continue;
    if (movement.quantityChanged >= 0) continue;

    const jsDate = toJsDate(movement.createdAt);
    if (!jsDate) continue;
    if (toDateKey(jsDate) !== selectedDate) continue;

    const allocation = (movement.batchAllocations ?? []).find((a) => a.batchId === batchId);
    if (!allocation) continue;

    if (!Number.isFinite(allocation.quantity) || allocation.quantity <= 0) continue;

    entries.push({
      quantity: allocation.quantity,
      source:   deriveIssueSource(movement.movementType, movement.reasonCategory),
    });
  }

  return entries;
}