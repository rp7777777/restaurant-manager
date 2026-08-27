// ============================================
// SERVORA ERP — Historical Batch Replay Service
// ✅ PURE FUNCTION — no Firestore calls, no React, no side effects.
//    Takes batches + movements + a target date, returns each batch's
//    reconstructed quantity/visibility as of that date. Testable in
//    complete isolation.
// ✅ CONFIRMED REPLAY RULES (UPDATED):
//    - Starting quantity = batch.originalQuantity, as of
//      batch.receivedDate.
//    - selectedDate < receivedDate → invisible (batch didn't exist
//      yet on that date).
//    - "quantity" (Lot/Batch QTY) now represents the OPENING
//      quantity for selectedDate — i.e. what was available at the
//      START of that day, BEFORE that day's own outgoing movements
//      are applied. Movements are replayed in chronological order
//      (by createdAt), deducting only movements dated STRICTLY
//      BEFORE selectedDate (`dateKey >= selectedDate` breaks the
//      loop). This is a CONFIRMED DESIGN CHANGE from the original
//      "closing quantity as of selectedDate" behavior — see the
//      full rationale below.
//    - WHY: previously, a batch that started a day at 12kg and had
//      4kg issued that SAME day showed "Lot/Batch QTY: 8" — already
//      reduced, indistinguishable from what remained AFTER that
//      day's Issue activity. This double-counted the day's movement
//      into a single already-reduced number, conflicting with the
//      separate "Issue" column (getIssuesForDate()) which ALSO shows
//      that same day's 4kg outgoing. Per confirmed requirement,
//      Lot/Batch QTY must show the OPENING balance (12kg) so Issue
//      (4kg) and Lot/Batch QTY (12kg) are complementary, non-
//      overlapping pieces of information — the item-level Total QTY
//      (computed by useHistoricalInventory.ts, summing
//      visible batches' quantity) is what independently reflects the
//      day's actual closing/remaining stock.
//    - depletedDate now only reflects a batch fully depleting on a
//      date STRICTLY BEFORE selectedDate (since selectedDate's own
//      movements are no longer replayed into this calculation) — a
//      batch that empties out ON selectedDate itself still shows its
//      (non-zero) opening quantity for that date, which is the
//      confirmed intended behavior.
// ✅ SAFETY — quantity is NEVER allowed to go negative. Malformed
//    allocation quantities (NaN, Infinity, negative) are caught and
//    flagged inconsistent rather than silently corrupting the total.
// ✅ relevantMovements = "deduction movements containing an
//    allocation for this batch" — deliberately does NOT include the
//    batch's own creation/receive movement.
// ✅ Local-timezone date key (getFullYear/getMonth/getDate).
// ✅ Firestore Timestamp vs JS Date — toJsDate() normalizes both.
// ✅ getIssuesForDate() — a SEPARATE pure function, UNCHANGED by
//    this update, answering "what went OUT of this batch on EXACTLY
//    this date" (matches dateKey === selectedDate, the complement of
//    replayBatchAsOfDate()'s now-exclusive-of-selectedDate logic).
//    Confirmed matching rules: movementType must be KITCHEN_ISSUE/
//    WASTE/TRANSFER_OUT; date must equal selectedDate exactly;
//    quantity is the ALLOCATION's quantity for this specific batch
//    (never the movement's overall quantityChanged, since a single
//    movement can span multiple batches via FEFO). Source label:
//    KITCHEN_ISSUE → "Kitchen", WASTE → "Waste", TRANSFER_OUT +
//    DATA_CORRECTION → "Correction", TRANSFER_OUT (other) →
//    "Transfer".
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
  depletedDate: string | null; // YYYY-MM-DD the batch first reached 0 (strictly before a later selectedDate), or null if never depleted (yet)
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
 * Reconstructs one batch's OPENING quantity/visibility for
 * `selectedDate` — i.e. what was available at the start of that day,
 * before that day's own outgoing movements. `movements` should
 * already be filtered to ONLY movements relevant to this batch's
 * item (the caller/hook layer is responsible for that scoping) —
 * this function further narrows to deduction movements carrying a
 * batchAllocations entry for this specific batch's id.
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

  // ✅ FIX — `dateKey >= selectedDate` (was `> selectedDate`):
  // excludes selectedDate's OWN movements from this opening-quantity
  // calculation. See FROZEN header for full rationale.
  for (const { movement, dateKey } of relevantMovements) {
    if (dateKey >= selectedDate) break;

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