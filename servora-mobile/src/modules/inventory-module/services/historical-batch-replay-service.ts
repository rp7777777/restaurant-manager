// ============================================
// SERVORA ERP — Historical Batch Replay Service
// 🔧 DEBUG BUILD — console.log statements added temporarily to
//    diagnose why "TEST001" batch (fully depleted same-day) shows
//    hidden on its depletion date instead of visible with quantity 0.
//    Remove once root cause is confirmed and fixed.
// ✅ CONFIRMED FINAL REPLAY RULES:
//    - "quantity" (Lot/Batch QTY) is the CLOSING quantity as of
//      selectedDate — movements dated selectedDate OR EARLIER
//      (inclusive) are applied.
//    - depletedDate detected within the SAME replay loop as quantity.
//      A batch depleted ON selectedDate is still VISIBLE that day
//      (quantity=0); hidden only starting the day AFTER depletedDate.
// FROZEN (once debug removed)
// ============================================

import { InventoryBatch } from "../types/inventory-batch";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";

export interface HistoricalBatchState {
  batchId:      string;
  batchNo:      string;
  itemName:     string;
  unit:         string;
  receivedDate: string;
  expiryDate:   string | null;
  quantity:     number;
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
    batchId:      batch.id,
    batchNo:      batch.batchNo,
    itemName:     batch.itemName,
    unit:         batch.unit,
    receivedDate: batch.receivedDate,
    expiryDate:   batch.expiryDate ?? null,
  };

  // 🔧 DEBUG
  if (batch.batchNo === "TEST001") {
    console.log("[replay-debug] === START ===");
    console.log("[replay-debug] batch:", batch.batchNo, "id:", batch.id, "receivedDate:", batch.receivedDate, "selectedDate:", selectedDate);
    console.log("[replay-debug] originalQuantity:", batch.originalQuantity, "current stored quantity:", batch.quantity);
    console.log("[replay-debug] total movements passed in:", movements.length);
  }

  if (selectedDate < batch.receivedDate) {
    if (batch.batchNo === "TEST001") {
      console.log("[replay-debug] EARLY RETURN: selectedDate < receivedDate -> invisible");
    }
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

  if (batch.batchNo === "TEST001") {
    console.log("[replay-debug] relevantMovements count:", relevantMovements.length);
    console.log("[replay-debug] relevantMovements detail:", relevantMovements.map((m) => ({
      dateKey: m.dateKey,
      movementType: m.movement.movementType,
      allocations: m.movement.batchAllocations,
    })));
  }

  let quantity = batch.originalQuantity;
  let depletedDate: string | null = null;
  let inconsistent = false;

  for (const { dateKey, movement } of relevantMovements) {
    const willBreak = dateKey > selectedDate;
    if (batch.batchNo === "TEST001") {
      console.log("[replay-debug] LOOP dateKey:", dateKey, "selectedDate:", selectedDate, "dateKey > selectedDate:", willBreak);
    }
    if (willBreak) break;

    const allocation = (movement.batchAllocations ?? []).find((a) => a.batchId === batch.id);
    if (!allocation) {
      if (batch.batchNo === "TEST001") console.log("[replay-debug] no allocation found for this movement, skipping");
      continue;
    }

    if (!Number.isFinite(allocation.quantity) || allocation.quantity < 0) {
      inconsistent = true;
      continue;
    }

    const next = quantity - allocation.quantity;
    quantity = next < 0 ? 0 : next;
    if (next < 0) inconsistent = true;

    if (batch.batchNo === "TEST001") {
      console.log("[replay-debug] applied allocation qty:", allocation.quantity, "-> running quantity:", quantity);
    }

    if (quantity === 0 && depletedDate === null) {
      depletedDate = dateKey;
      if (batch.batchNo === "TEST001") {
        console.log("[replay-debug] DEPLETED on dateKey:", depletedDate);
      }
    }
  }

  const willHide = depletedDate !== null && selectedDate > depletedDate;

  if (batch.batchNo === "TEST001") {
    console.log("[replay-debug] FINAL quantity:", quantity, "depletedDate:", depletedDate, "selectedDate > depletedDate:", willHide, "=> visible:", !willHide);
    console.log("[replay-debug] === END ===");
  }

  if (willHide) {
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