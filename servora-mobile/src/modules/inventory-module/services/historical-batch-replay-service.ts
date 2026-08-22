// ============================================
// SERVORA ERP — Historical Batch Replay Service
// ✅ PURE FUNCTION — no Firestore calls, no React, no side effects.
//    Takes batches + movements + a target date, returns each batch's
//    reconstructed quantity/visibility as of that date. Testable in
//    complete isolation.
// ✅ CONFIRMED REPLAY RULES:
//    - Starting quantity = batch.originalQuantity, as of
//      batch.receivedDate.
//    - selectedDate < receivedDate → invisible (batch didn't exist
//      yet on that date).
//    - Movements are replayed in chronological order (by createdAt).
//      For each movement, if it has a batchAllocations entry
//      matching this batch's id, that allocation's quantity is
//      DEDUCTED — batchAllocations always represents a deduction
//      FROM an existing batch (WASTE/KITCHEN_ISSUE/TRANSFER_OUT via
//      deductStockBatch()/issueKitchenRequest()). A PURCHASE
//      movement creates a BRAND NEW batch via receiveBatch() — it
//      never adds an allocation entry pointing at an existing
//      batch's id, so there's no double-counting risk to guard
//      against in practice.
//    - The exact movement whose replay brings quantity to 0 sets
//      depletedDate = that movement's date.
//    - selectedDate === depletedDate → visible, quantity 0.
//    - selectedDate > depletedDate → invisible.
//    - Otherwise (receivedDate <= selectedDate < depletedDate, or no
//      depletedDate yet) → visible, quantity = reconstructed value.
// ✅ SAFETY — quantity is NEVER allowed to go negative. If replaying
//    an allocation would take a batch's running quantity below 0, or
//    if an allocation's quantity is itself malformed (NaN, Infinity,
//    negative), the batch is flagged inconsistent rather than
//    silently producing a wrong/NaN number. The caller decides how
//    to surface that (e.g. a warning icon) — this service only
//    detects and reports it.
// ✅ relevantMovements = "deduction movements containing an
//    allocation for this batch" (not "all movements relevant to
//    this batch") — matches exactly what the filter does. This
//    deliberately does NOT include the batch's own creation/receive
//    movement — receivedDate + originalQuantity already establish
//    the starting state without replaying the PURCHASE movement
//    itself.
// ✅ Each allocation's quantity is validated (Number.isFinite + >= 0)
//    BEFORE being subtracted — a malformed allocation.quantity (e.g.
//    NaN from corrupted data) is caught explicitly rather than
//    silently propagating through `runningQuantity - NaN`, which
//    would otherwise defeat the `next < 0` negative-guard entirely
//    (NaN < 0 is false in JS).
// ✅ Local-timezone date key (getFullYear/getMonth/getDate, NOT UTC
//    methods) — matches the same "what a person physically there
//    calls today" convention already established in
//    MovementHistoryModal.tsx's own movementDateKey() fix. This
//    means batch.receivedDate (a plain YYYY-MM-DD string, entered by
//    a user in their local context) and this function's output are
//    both consistently LOCAL-date-based — a movement recorded at
//    23:50 local time is keyed to that same local day, not shifted
//    to the next UTC day. No cross-timezone mismatch between the two
//    date sources this service compares.
// ✅ Firestore Timestamp vs JS Date — movement.createdAt can arrive
//    as either (Firestore Timestamp objects have a .toDate() method;
//    plain Date/ISO-string values do not) — toJsDate() normalizes
//    both safely.
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
  quantity:     number;    // reconstructed quantity as of selectedDate
  visible:      boolean;
  depletedDate: string | null; // YYYY-MM-DD the batch first reached 0, or null if never depleted (yet)
  inconsistent: boolean;   // true if replay detected a negative/malformed-quantity scenario
}

function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  const anyVal = value as any;
  if (typeof anyVal.toDate === "function") return anyVal.toDate();
  const d = new Date(anyVal);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ✅ Local-timezone date key — see FROZEN header.
function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Reconstructs one batch's quantity/visibility as of `selectedDate`.
 * `movements` should already be filtered to ONLY movements relevant
 * to this batch's item (the caller/hook layer is responsible for
 * that scoping) — this function further narrows to deduction
 * movements carrying a batchAllocations entry for this specific
 * batch's id.
 */
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

  // Not received yet as of selectedDate — invisible, no replay needed.
  if (selectedDate < batch.receivedDate) {
    return { ...base, quantity: 0, visible: false, depletedDate: null, inconsistent: false };
  }

  // Deduction movements carrying an allocation for THIS batch — see
  // FROZEN header. Sorted chronologically.
  const relevantMovements = movements
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
    if (dateKey > selectedDate) break;

    const allocation = (movement.batchAllocations ?? []).find((a) => a.batchId === batch.id);
    if (!allocation) continue;

    // Validate BEFORE subtracting — see FROZEN header.
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

/**
 * Convenience wrapper — replays ALL given batches as of selectedDate.
 * `movements` should be the full relevant movement set for the
 * restaurant/items being reconstructed (scoping is the caller's
 * responsibility, e.g. useHistoricalInventory.ts).
 */
export function replayBatchesAsOfDate(
  batches: InventoryBatch[],
  movements: StockMovement[],
  selectedDate: string
): HistoricalBatchState[] {
  return batches.map((batch) => replayBatchAsOfDate(batch, movements, selectedDate));
}