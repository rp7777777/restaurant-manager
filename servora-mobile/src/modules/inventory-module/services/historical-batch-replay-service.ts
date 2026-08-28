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
//      movements dated STRICTLY BEFORE selectedDate
//      (`dateKey >= selectedDate` breaks the loop).
// ✅ CRITICAL FIX — relevantMovements now filters to an explicit
//    DEDUCTING_MOVEMENT_TYPES allowlist (KITCHEN_ISSUE, WASTE,
//    TRANSFER_OUT) BEFORE checking batchAllocations, instead of
//    matching ANY movement carrying a batchAllocations entry
//    regardless of type. Root cause this fixes: moveBatchToItem()
//    (Move Batch to Correct Item feature) records TWO paired
//    movements for a single batch move — TRANSFER_OUT (source item)
//    AND TRANSFER_IN (target item) — BOTH carrying the SAME
//    batchAllocations entry (same batchId, same quantity), since
//    it's the same physical batch. The old filter treated both as
//    deductions, so a 10kg moved batch computed
//    originalQuantity - 10 (OUT) - 10 (IN) = -10, triggering the
//    negative-quantity safety clamp and a false "inconsistent" flag.
//    This allowlist now exactly mirrors OUTGOING_MOVEMENT_TYPES
//    (used by getIssuesForDate() below) — both functions share one
//    consistent definition of "what counts as stock leaving this
//    batch." TRANSFER_IN, PURCHASE, RETURN, and any other incoming/
//    neutral movement type are never treated as a deduction, even if
//    they happen to carry a batchAllocations entry.
// ✅ SAFETY — quantity is NEVER allowed to go negative. Malformed
//    allocation quantities are caught and flagged inconsistent.
// ✅ Local-timezone date key. Firestore Timestamp vs JS Date handled
//    via toJsDate().
// ✅ getIssuesForDate() — SEPARATE pure function, UNCHANGED,
//    answering "what went OUT of this batch on EXACTLY this date"
//    (matches dateKey === selectedDate). Same
//    OUTGOING_MOVEMENT_TYPES definition as replayBatchAsOfDate's new
//    DEDUCTING_MOVEMENT_TYPES — kept as two separately-named
//    constants (not shared/exported) since they're conceptually
//    identical but independently owned by each function; a future
//    refactor could unify them if desired, but that's out of scope
//    for this fix.
// ✅ CONFIRMED, ACCEPTED BEHAVIOR — after a batch is moved via
//    moveBatchToItem(), historical views for dates BEFORE the move
//    will show that batch under its CURRENT (corrected) item, not
//    the item it was originally (incorrectly) attributed to. This is
//    NOT a replay quantity bug — replayBatchAsOfDate() reconstructs
//    each batch's quantity independently of item attribution; item
//    grouping in useHistoricalInventory.ts uses batch.inventoryId
//    (the CURRENT, corrected value). This is intentional: a "Move
//    Batch" correction means "this batch always belonged to the
//    correct item," so historical views reflecting the corrected
//    item is the intended semantics, not a defect.
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

// ✅ FIX — explicit deducting-movement allowlist, see FROZEN header.
const DEDUCTING_MOVEMENT_TYPES = new Set(["KITCHEN_ISSUE", "WASTE", "TRANSFER_OUT"]);

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

  // ✅ FIX — filters by DEDUCTING_MOVEMENT_TYPES first, then
  // batchAllocations. Excludes TRANSFER_IN/PURCHASE/RETURN even if
  // they carry a batchAllocations entry.
  const relevantMovements = movements
    .filter((m) => DEDUCTING_MOVEMENT_TYPES.has(m.movementType))
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