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
//      deductStockBatch()/issueKitchenRequest()/moveBatchToItem()).
//      A PURCHASE movement creates a BRAND NEW batch via
//      receiveBatch() — it never adds an allocation entry pointing
//      at an existing batch's id, so there's no double-counting risk
//      to guard against in practice.
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
//    silently producing a wrong/NaN number.
// ✅ relevantMovements = "deduction movements containing an
//    allocation for this batch" — deliberately does NOT include the
//    batch's own creation/receive movement.
// ✅ Each allocation's quantity is validated (Number.isFinite + >= 0)
//    BEFORE being subtracted.
// ✅ Local-timezone date key (getFullYear/getMonth/getDate, NOT UTC
//    methods) — matches MovementHistoryModal.tsx's own convention.
// ✅ Firestore Timestamp vs JS Date — toJsDate() normalizes both.
// ✅ NEW — getIssuesForDate(): a SEPARATE pure function (does not
//    modify replayBatchAsOfDate() at all) answering a different
//    question — "what went OUT of this specific batch on this exact
//    date" (for the historical table's Issue column), as opposed to
//    replayBatchAsOfDate()'s "what remains AS OF this date" (closing
//    stock). Confirmed matching rules:
//    - Movement's movementType must be one of KITCHEN_ISSUE / WASTE /
//      TRANSFER_OUT (explicit allowlist, not just "any negative
//      quantityChanged" — guards against a future unrelated negative
//      movement type being misinterpreted as an "issue").
//    - Movement's date (from createdAt) must equal selectedDate
//      EXACTLY (not <=, unlike replay's cumulative matching).
//    - Movement must carry a batchAllocations entry for THIS
//      specific batch.id.
//    - The displayed quantity is the ALLOCATION's quantity for this
//      batch — NEVER the movement's overall quantityChanged — since
//      a single Kitchen Issue can draw from multiple batches via
//      FEFO, and only this batch's portion belongs in this batch's
//      entry.
//    - Source label: KITCHEN_ISSUE → "Kitchen", WASTE → "Waste",
//      TRANSFER_OUT + reasonCategory DATA_CORRECTION → "Correction",
//      TRANSFER_OUT (other reason) → "Transfer".
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

// ── Per-date Issue breakdown — see FROZEN header for full rules. ──
export interface HistoricalIssueEntry {
  quantity: number;
  source:   string;
}

const OUTGOING_MOVEMENT_TYPES = new Set(["KITCHEN_ISSUE", "WASTE", "TRANSFER_OUT"]);

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
    if (!OUTGOING_MOVEMENT_TYPES.has(movement.movementType)) continue;
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