// ============================================
// SERVORA ERP — Historical Batch Replay Service
// ✅ PURE FUNCTION — no Firestore calls, no React, no side effects.
// ✅ CONFIRMED FINAL REPLAY RULES:
//    - "quantity" (Batch QTY / Lot/Batch QTY) is the CLOSING quantity
//      as of selectedDate — movements dated selectedDate OR EARLIER
//      (inclusive) are applied.
//    - depletedDate detected within the SAME replay loop as quantity.
//      A batch depleted ON selectedDate is still VISIBLE that day
//      (quantity=0); hidden only starting the day AFTER depletedDate.
//    - originalQuantity is EXPOSED on the returned state (previously
//      internal-only) — this is the batch's RECEIPT quantity, fixed
//      at creation time, and NEVER changes based on selectedDate.
//      Callers (e.g. the "Received Qty" column in
//      HistoricalInventoryTableView.tsx) use this alongside
//      receivedDate to show "how much came in" ONLY on the date it
//      was actually received — originalQuantity is a historical
//      fact, quantity is a point-in-time snapshot; they answer
//      different questions and must never be confused with each
//      other (batch.quantity alone cannot answer "how much was
//      originally received," since it decreases as movements are
//      replayed).
// ✅ CRITICAL — relevantMovements filters to an explicit
//    DEDUCTING_MOVEMENT_TYPES allowlist (KITCHEN_ISSUE, WASTE,
//    TRANSFER_OUT) BEFORE checking batchAllocations.
// ✅ isRealStockDeduction(): excludes DATA_CORRECTION-tagged
//    TRANSFER_OUT (moveBatchToItem()) from being treated as a real
//    stock deduction/issue.
// ✅ SAFETY — quantity is NEVER allowed to go negative. Malformed
//    allocation quantities are caught and flagged inconsistent.
// ✅ Local-timezone date key. Firestore Timestamp vs JS Date handled
//    via toJsDate().
// FROZEN
// ============================================

import { InventoryBatch } from "../types/inventory-batch";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";

export interface HistoricalBatchState {
  batchId:          string;
  batchNo:          string;
  itemName:         string;
  unit:             string;
  receivedDate:     string;    // YYYY-MM-DD
  expiryDate:       string | null;
  // ✅ NEW — exposed. The batch's original receipt quantity, fixed
  // at creation, independent of selectedDate.
  originalQuantity: number;
  quantity:         number;    // CLOSING quantity as of selectedDate
  visible:          boolean;
  depletedDate:     string | null;
  inconsistent:     boolean;
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

const DEDUCTING_MOVEMENT_TYPES = new Set(["KITCHEN_ISSUE", "WASTE", "TRANSFER_OUT"]);

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
    batchId:          batch.id,
    batchNo:          batch.batchNo,
    itemName:         batch.itemName,
    unit:             batch.unit,
    receivedDate:     batch.receivedDate,
    expiryDate:       batch.expiryDate ?? null,
    originalQuantity: batch.originalQuantity,
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
    if (dateKey > selectedDate) break;

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