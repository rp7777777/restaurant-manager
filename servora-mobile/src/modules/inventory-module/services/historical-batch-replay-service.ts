// ============================================
// SERVORA ERP — Historical Batch Replay Service
// ✅ PURE FUNCTION — no Firestore calls, no React, no side effects.
// ✅ CONFIRMED FINAL SEMANTICS —
//    - "quantity" (Lot/Batch QTY, per-row) is the OPENING quantity
//      for selectedDate: movements dated STRICTLY BEFORE selectedDate
//      are applied (`dateKey >= selectedDate` breaks the loop,
//      excluding that day's own movements). This is what each
//      batch's individual row displays.
//    - Total QTY (item-level, computed in useHistoricalInventory.ts,
//      NOT here) is the CLOSING quantity — opening minus that same
//      date's own real deductions, computed separately using the
//      SAME isRealStockDeduction() rule and toJsDate()/toDateKey()
//      helpers exported below.
//    - depletedDate is detected within the replay loop as before, but
//      since same-date movements are now excluded from replay, a
//      batch that becomes fully depleted ON selectedDate itself will
//      NOT have depletedDate set to selectedDate by this function —
//      that is expected and correct under opening-quantity semantics:
//      this function no longer controls same-day visibility the way
//      it did under the earlier (now reverted) closing-quantity
//      design. Visibility (`visible`) still correctly reflects
//      whether the batch had already been fully depleted on some
//      PRIOR date, per this same opening-quantity replay.
// ✅ CRITICAL — relevantMovements filters to an explicit
//    DEDUCTING_MOVEMENT_TYPES allowlist (KITCHEN_ISSUE, WASTE,
//    TRANSFER_OUT) BEFORE checking batchAllocations.
// ✅ isRealStockDeduction() — EXPORTED (was private) so
//    useHistoricalInventory.ts can reuse the EXACT SAME deduction
//    rule when computing each batch's same-date closing quantity —
//    never re-derived or duplicated.
// ✅ toJsDate()/toDateKey() — EXPORTED (were private) for the same
//    reason: useHistoricalInventory.ts needs identical date-parsing
//    behavior (Firestore Timestamp vs JS Date, local-timezone date
//    key) when checking "did this movement happen on selectedDate."
// ✅ originalQuantity is EXPOSED on the returned state — the batch's
//    original receipt quantity, fixed at creation, independent of
//    selectedDate. Used by the "Received Qty" column (shown only
//    when receivedDate === selectedDate).
// ✅ SAFETY — quantity is NEVER allowed to go negative. Malformed
//    allocation quantities are caught and flagged inconsistent.
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
  originalQuantity: number;
  quantity:         number;    // OPENING quantity as of selectedDate
  visible:          boolean;
  depletedDate:     string | null;
  inconsistent:     boolean;
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

  // ✅ CONFIRMED FINAL SEMANTICS — opening quantity: excludes
  // selectedDate's own movements (`dateKey >= selectedDate` breaks).
  // See FROZEN header for the full rationale and for how Total QTY
  // (closing) is computed separately in useHistoricalInventory.ts.
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