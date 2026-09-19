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
//      that is expected and correct under opening-quantity semantics.
// ✅ CRITICAL — relevantMovements filters to an explicit
//    DEDUCTING_MOVEMENT_TYPES allowlist (KITCHEN_ISSUE, WASTE,
//    TRANSFER_OUT) BEFORE checking batchAllocations.
// ✅ isRealStockDeduction() — EXPORTED so useHistoricalInventory.ts
//    can reuse the EXACT SAME deduction rule when computing each
//    batch's same-date closing quantity — never re-derived.
// ✅ toJsDate()/toDateKey() — EXPORTED for the same reason.
// ✅ originalQuantity is EXPOSED on the returned state.
// ✅ SAFETY — quantity is NEVER allowed to go negative. Malformed
//    allocation quantities are caught and flagged inconsistent.
// ✅ NEW (Step 4 of batch-level archive) — HistoricalBatchState now
//    carries isBatchArchived + batchArchivedDate, so the UI can show
//    a diagonal-line/badge indicator on an archived batch's row
//    without needing to separately look up InventoryBatch.isActive.
//    Archive visibility follows the SAME date-aware rule already
//    used for item-level archive (isArchivedAsOfDate() in
//    useHistoricalInventory.ts): the archive date itself STILL shows
//    the batch (visible stays whatever the quantity-replay result
//    was), hidden only from the day AFTER archivedAt onward — this
//    check is applied AFTER the existing depletion-based visible
//    calculation, so a batch that's both depleted AND archived stays
//    correctly invisible either way, and an archived-but-not-yet-
//    depleted batch is hidden only once its archive date has passed.
//    This is INDEPENDENT of the parent InventoryItem's own archive —
//    that's handled entirely in useHistoricalInventory.ts and never
//    touches batch-level state.
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

// ✅ Returns true if this BATCH should be hidden for selectedDate due
// to its own batch-level archive — i.e. archived BEFORE selectedDate
// (the archive date itself still shows the batch). A batch with no
// archivedAt recorded, or isActive !== false, is never hidden by
// this check.
function isBatchArchivedAsOfDate(batch: InventoryBatch, selectedDate: string): boolean {
  if (batch.isActive !== false) return false;
  if (!batch.archivedAt) return false; // archived flag set but no date — don't hide (conservative: never silently drop real data)
  const archivedDate = toJsDate(batch.archivedAt);
  if (!archivedDate) return false;
  return selectedDate > toDateKey(archivedDate);
}

function getBatchArchivedDateKey(batch: InventoryBatch): string | null {
  if (batch.isActive !== false || !batch.archivedAt) return null;
  const d = toJsDate(batch.archivedAt);
  return d ? toDateKey(d) : null;
}

export function replayBatchAsOfDate(
  batch: InventoryBatch,
  movements: StockMovement[],
  selectedDate: string
): HistoricalBatchState {
  const batchArchivedDate = getBatchArchivedDateKey(batch);
  const isBatchArchived = batch.isActive === false;

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

  // ✅ Batch-level archive check — applied AFTER the depletion-based
  // visibility above, so an already-invisible (depleted) batch stays
  // invisible either way, and an archived-but-still-stocked batch
  // becomes invisible only once its own archive date has passed.
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