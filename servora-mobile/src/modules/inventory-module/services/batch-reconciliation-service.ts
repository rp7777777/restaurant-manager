// ============================================
// SERVORA ERP — Batch Reconciliation Service ("Batch Data Check")
// ✅ PURPOSE — detect and resolve a batch whose LIVE quantity (the
//    batch document) disagrees with its MOVEMENT LEDGER
//    (originalQuantity − real deductions ± recorded batch corrections).
//    Such a mismatch is what produces a "data issue" and makes
//    Historical Inventory disagree with Item Details.
// ✅ computeBatchLedger() — PURE (no Firestore). Uses the replay
//    service's own rules (isRealStockDeduction / isBatchCorrection /
//    getBatchCorrectionDelta) so the check and Historical Inventory
//    can never disagree about what counts. The ledger is computed
//    UNCLAMPED here (it may go below 0) — that is exactly the signal.
// ✅ Two resolutions (OWNER + MANAGER only — enforced by the UI via
//    the "fix_inventory_data" permission):
//    1. recordLedgerCorrection() — "LIVE is right": the batch was
//       changed without a record at some point. Writes ONE
//       ADJUSTMENT / DATA_CORRECTION movement with a batchAllocation
//       (the same record Edit Batch now writes), dated at the
//       suggested point, so the ledger reaches the live quantity.
//       NEVER changes the batch or the item.
//    2. syncBatchToLedger() — "LEDGER is right": the live quantity is
//       wrong. Delegates to correctBatchDetails() in "ledger-sync"
//       mode: batch quantity + item currentStock updated in ONE
//       transaction, plus an audit movement that carries NO
//       batchAllocation (so replay does not apply it again — the
//       ledger is already correct).
// ✅ Suggested date for a "LIVE is right" correction — a positive
//    correction goes 1 minute BEFORE the first deduction that drove
//    the ledger below 0 (it must have happened before that issue).
//    Otherwise the batch document's updatedAt when that is later than
//    the last movement (best trace of an unrecorded edit), else 1
//    minute after the last movement.
// ✅ Safety — recordLedgerCorrection() re-reads the batch inside a
//    transaction and refuses if its live quantity changed since the
//    check was computed (stale screen).
// ============================================

import { runTransaction, doc, Timestamp } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { InventoryBatch } from "../types/inventory-batch";
import { InventoryItem } from "../types/inventory";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";
import { batchDoc, stockMovementsCollection } from "./inventory-service-helpers";
import {
  isRealStockDeduction, isBatchCorrection, getBatchCorrectionDelta, toJsDate,
} from "./historical-batch-replay-service";
import { correctBatchDetails } from "./inventory-correct-service";

export interface BatchLedgerCheck {
  batchId:              string;
  batchNo:              string;
  inventoryId:          string;
  itemName:             string;
  unit:                 string;
  unitCost:             number;
  receivedDate:         string;
  isArchived:           boolean;
  originalQuantity:     number;
  totalDeducted:        number;  // Σ real deductions (positive number)
  totalCorrected:       number;  // Σ recorded corrections (signed)
  ledgerQuantity:       number;  // original − deducted ± corrected (UNclamped)
  liveQuantity:         number;  // batch document's current quantity
  difference:           number;  // live − ledger
  hasInvalidRecord:     boolean; // a malformed allocation/correction was skipped
  lastMovementAt:       Date | null;
  suggestedCorrectionAt: Date;   // where a "LIVE is right" correction would be dated
  balanceAtSuggestion:  number;  // ledger balance just before that point
}

const MINUTE_MS = 60_000;

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ✅ PURE — `batchMovements` may contain unrelated movements; only
// those with an allocation for this batch are used.
export function computeBatchLedger(
  batch: InventoryBatch,
  batchMovements: StockMovement[]
): BatchLedgerCheck {
  const original = Number(batch.originalQuantity);
  const live = Number(batch.quantity);
  let hasInvalidRecord = !Number.isFinite(original) || !Number.isFinite(live);

  const events: Array<{ date: Date; change: number; isDeduction: boolean }> = [];
  for (const m of batchMovements) {
    const isDeduction = isRealStockDeduction(m);
    const isCorrection = isBatchCorrection(m);
    if (!isDeduction && !isCorrection) continue;

    const allocation = (m.batchAllocations ?? []).find((a) => a.batchId === batch.id);
    if (!allocation) continue;
    const date = toJsDate(m.createdAt);
    if (!date) continue;

    if (isCorrection) {
      const delta = getBatchCorrectionDelta(m, allocation.quantity);
      if (delta === null) { hasInvalidRecord = true; continue; }
      events.push({ date, change: delta, isDeduction: false });
    } else {
      if (!Number.isFinite(allocation.quantity) || allocation.quantity < 0) { hasInvalidRecord = true; continue; }
      events.push({ date, change: -allocation.quantity, isDeduction: true });
    }
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  const safeOriginal = Number.isFinite(original) ? original : 0;
  let balance = safeOriginal;
  let totalDeducted = 0;
  let totalCorrected = 0;
  let firstNegativeIndex = -1;
  const balanceBefore: number[] = [];

  events.forEach((e, i) => {
    balanceBefore.push(balance);
    balance += e.change;
    if (e.isDeduction) totalDeducted += -e.change;
    else totalCorrected += e.change;
    if (balance < 0 && firstNegativeIndex === -1 && e.isDeduction) firstNegativeIndex = i;
  });

  const ledgerQuantity = roundQty(balance);
  const liveQuantity = Number.isFinite(live) ? live : 0;
  const difference = roundQty(liveQuantity - ledgerQuantity);

  const lastMovementAt = events.length > 0 ? events[events.length - 1].date : null;
  const batchUpdatedAt = toJsDate((batch as any).updatedAt);

  let suggestedCorrectionAt: Date;
  let balanceAtSuggestion: number;
  if (difference > 0 && firstNegativeIndex !== -1) {
    suggestedCorrectionAt = new Date(events[firstNegativeIndex].date.getTime() - MINUTE_MS);
    balanceAtSuggestion = balanceBefore[firstNegativeIndex];
  } else if (batchUpdatedAt && (!lastMovementAt || batchUpdatedAt.getTime() > lastMovementAt.getTime())) {
    suggestedCorrectionAt = batchUpdatedAt;
    balanceAtSuggestion = ledgerQuantity;
  } else if (lastMovementAt) {
    suggestedCorrectionAt = new Date(lastMovementAt.getTime() + MINUTE_MS);
    balanceAtSuggestion = ledgerQuantity;
  } else {
    const received = toJsDate(batch.receivedDate) ?? new Date();
    suggestedCorrectionAt = new Date(received.getTime() + MINUTE_MS);
    balanceAtSuggestion = safeOriginal;
  }

  return {
    batchId:           batch.id,
    batchNo:           batch.batchNo,
    inventoryId:       batch.inventoryId,
    itemName:          batch.itemName,
    unit:              batch.unit,
    unitCost:          Number.isFinite(Number(batch.unitCost)) ? Number(batch.unitCost) : 0,
    receivedDate:      batch.receivedDate,
    isArchived:        batch.isActive === false,
    originalQuantity:  safeOriginal,
    totalDeducted:     roundQty(totalDeducted),
    totalCorrected:    roundQty(totalCorrected),
    ledgerQuantity,
    liveQuantity,
    difference,
    hasInvalidRecord,
    lastMovementAt,
    suggestedCorrectionAt,
    balanceAtSuggestion: roundQty(balanceAtSuggestion),
  };
}

export function isBatchLedgerMismatch(check: BatchLedgerCheck): boolean {
  return check.difference !== 0 || check.hasInvalidRecord;
}

// ── Resolution 1: LIVE quantity is right → record the missing correction ──
export async function recordLedgerCorrection(
  restaurantId: string,
  check: BatchLedgerCheck
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (check.difference === 0) throw new Error("This batch already matches its ledger");

  const movementRef = doc(stockMovementsCollection(restaurantId));
  const batchRef = batchDoc(restaurantId, check.batchId);

  await runTransaction(db, async (transaction) => {
    const batchSnap = await transaction.get(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const liveNow = Number(batchSnap.data().quantity);
    if (liveNow !== check.liveQuantity) {
      throw new Error("This batch changed since the check was opened — close and reopen Batch Data Check");
    }

    const before = check.balanceAtSuggestion;
    const after = roundQty(before + check.difference);

    transaction.set(movementRef, {
      inventoryId:     check.inventoryId,
      itemName:        check.itemName,
      movementType:    "ADJUSTMENT",
      quantityChanged: check.difference,
      beforeQuantity:  before,
      afterQuantity:   after,
      unit:            check.unit,
      unitCostAtTime:  check.unitCost,
      movementValue:   Math.round(Math.abs(check.difference) * check.unitCost * 100) / 100,
      reasonCategory:  "DATA_CORRECTION",
      referenceType:   "MANUAL",
      referenceId:     `RECONCILE-${check.batchId}`,
      reason:
        `Batch Data Check: recorded an earlier unrecorded change on batch ${check.batchNo} ` +
        `(${before} → ${after}). Live quantity confirmed correct. Before/after are batch-level quantities.`,
      batchAllocations: [
        { batchId: check.batchId, batchNo: check.batchNo, quantity: Math.abs(check.difference) },
      ],
      restaurantId,
      createdBy:       auth.currentUser!.uid,
      createdByName:   null,
      createdByRole:   null,
      createdAt:       Timestamp.fromDate(check.suggestedCorrectionAt),
    });
  });
}

// ── Resolution 2: LEDGER is right → set the live batch to the ledger ──
export async function syncBatchToLedger(
  restaurantId: string,
  item: InventoryItem,
  check: BatchLedgerCheck
): Promise<void> {
  if (check.difference === 0) throw new Error("This batch already matches its ledger");
  if (check.ledgerQuantity < 0) {
    throw new Error(
      "The ledger is below 0, so it cannot be the true stock. Use \"Live stock is correct\" instead."
    );
  }
  await correctBatchDetails(restaurantId, item, {
    batchId:   check.batchId,
    itemId:    check.inventoryId,
    quantity:  check.ledgerQuantity,
    auditMode: "ledger-sync",
  });
}