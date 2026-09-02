// ============================================
// SERVORA ERP — Historical Batch Replay Service
// ✅ PURE FUNCTION — no Firestore calls, no React, no side effects.
// ✅ CONFIRMED REPLAY RULES:
//    - Starting quantity = batch.originalQuantity, as of
//      batch.receivedDate.
//    - selectedDate < receivedDate → invisible.
//    - "quantity" (Lot/Batch QTY) represents the OPENING quantity
//      for selectedDate — before that day's own outgoing movements.
//      Movements are replayed chronologically, deducting only
//      movements dated STRICTLY BEFORE selectedDate.
// ✅ CRITICAL FIX — relevantMovements filters to an explicit
//    DEDUCTING_MOVEMENT_TYPES allowlist (KITCHEN_ISSUE, WASTE,
//    TRANSFER_OUT) BEFORE checking batchAllocations, instead of
//    matching ANY movement carrying a batchAllocations entry
//    regardless of type — so moveBatchToItem()'s paired
//    TRANSFER_OUT+TRANSFER_IN no longer both get treated as
//    deductions (TRANSFER_IN was never in this set to begin with).
// ✅ NEW — isRealStockDeduction(): a TRANSFER_OUT tagged with
//    reasonCategory "DATA_CORRECTION" (written exclusively by
//    moveBatchToItem()) represents a data-entry correction, NOT a
//    real physical stock loss — the batch's actual quantity didn't
//    decrease, only its item assignment changed. Real deduction
//    already happened via the item reassignment itself; historical
//    replay must not ALSO subtract the batch's quantity again on top
//    of that, which would fabricate a phantom depletion after the
//    move date. This same exclusion applies to getIssuesForDate()
//    below, so the Issue column doesn't show a data-correction move
//    as if it were a real Kitchen/Waste-style stock issue either.
// ✅ SAFETY — quantity is NEVER allowed to go negative. Malformed
//    allocation quantities are caught and flagged inconsistent.
// ✅ Local-timezone date key. Firestore Timestamp vs JS Date handled
//    via toJsDate().
// FROZEN
// ============================================

import { InventoryBatch } from "../types/inventory-batch";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";

export interface HistoricalBatchState {
  batchId:      string;
  batchNo:      string;
  itemName:     string;
  unit:         string;
  receivedDate: string;    // YYYY-MM-DD
  expiryDate:   string | null;
  quantity:     number;    // OPENING quantity for selectedDate (before that day's own movements)
  visible:      boolean;
  depletedDate: string | null;
  inconsistent: boolean;
}

function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  const anyVal = value as any;
  if (typeof anyVal.toDate === "function") return anyVal.toDate();
  const d = new Date(anyVal);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ Explicit deducting-movement allowlist.
const DEDUCTING_MOVEMENT_TYPES = new Set(["KITCHEN_ISSUE", "WASTE", "TRANSFER_OUT"]);

// ✅ NEW — see FROZEN header. Excludes DATA_CORRECTION-tagged
// TRANSFER_OUT (moveBatchToItem()) from being treated as a real
// stock deduction/issue, in BOTH replayBatchAsOfDate() and
// getIssuesForDate() below.
function isRealStockDeduction(movement: StockMovement): boolean {
  if (!DEDUCTING_MOVEMENT_TYPES.has(movement.movementType)) return false;
  if (movement.movementType === "TRANSFER_OUT" && movement.reasonCategory === "DATA_CORRECTION") {
    return false;
  }
  return true;
}

export function replayBatchAsOfDate(
  batch: InventoryBatch,
  movements: StockMovement[],
  selectedDate: string
): HistoricalBatchState {
  const base: Omit<HistoricalBatchState, "quantity" | "visible" | "depletedDate" | "inconsistent"> = {
    batchId:      batch.id,
    batchNo:      batch.batchNo,
    itemName:     batch.itemName,
    unit:         batch.unit,
    receivedDate: batch.receivedDate,
    expiryDate:   batch.expiryDate ?? null,
  };

  if (selectedDate < batch.receivedDate) {
    return { ...base, quantity: 0, visible: false, depletedDate: null, inconsistent: false };
  }

  // ✅ FIX — isRealStockDeduction() instead of a raw type-Set check,
  // so DATA_CORRECTION transfers are excluded from this replay.
  const relevantMovements = movements
    .filter((m) => isRealStockDeduction(m))
    .filter((m) => (m.batchAllocations ?? []).some((a) => a.batchId === batch.id))
    .map((m) => {
      const jsDate = toJsDate(m.createdAt);
      return jsDate ? { movement: m, date: jsDate, dateKey: toDateKey(jsDate) } : null;
    })
    .filter((x): x is { movement: StockMovement; date: Date; dateKey: string } => x !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningQuantity = batch.originalQuantity;
  let depletedDate: string | null = null;
  let inconsistent = false;

  for (const { movement, dateKey } of relevantMovements) {
    if (dateKey >= selectedDate) break;

    const allocation = (movement.batchAllocations ?? []).find((a) => a.batchId === batch.id);
    if (!allocation) continue;

    if (!Number.isFinite(allocation.quantity) || allocation.quantity < 0) {
      inconsistent = true;
      continue;
    }

    const next = runningQuantity - allocation.quantity;
    if (next < 0) {
      inconsistent = true;
      runningQuantity = 0;
    } else {
      runningQuantity = next;
    }

    if (runningQuantity === 0 && depletedDate === null) {
      depletedDate = dateKey;
    }
  }

  if (depletedDate !== null && selectedDate > depletedDate) {
    return { ...base, quantity: 0, visible: false, depletedDate, inconsistent };
  }

  return { ...base, quantity: runningQuantity, visible: true, depletedDate, inconsistent };
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
    // ✅ FIX — DATA_CORRECTION TRANSFER_OUT excluded from the Issue
    // column too — see FROZEN header.
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