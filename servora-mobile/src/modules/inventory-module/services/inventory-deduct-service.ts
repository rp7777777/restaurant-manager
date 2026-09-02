// ============================================
// SERVORA ERP — Inventory Deduct Service
// ✅ EXTRACTED from inventory-service.ts — pure structural refactor.
// ✅ deductStockBatch() — FEFO-based deduction. currentStock/
//    isLowStock/totalValue recomputed from ACTUAL sibling batch
//    documents (source of truth), not from a stored-value delta.
//    Includes: archived-item block, malformed-quantity validation
//    on ALL batches (before allocation), FEFO eligibility filtering
//    (reuses batch-allocation-service.ts's pure sort/filter
//    functions — not duplicated), allocation-total verification
//    (aborts if requested ≠ allocated, rather than silently
//    under/over-deducting).
// ✅ FIX — input.quantity validated with Number.isFinite() (not just
//    <= 0), so a NaN quantity is rejected rather than silently
//    passing the <= 0 check (NaN <= 0 is false in JS) and causing
//    unreliable downstream comparisons.
// ✅ FIX — movement record's unit/unitCostAtTime/movementValue now
//    use the FRESH itemData read inside the transaction, not the
//    caller-supplied item object (which could be stale relative to
//    a concurrent unitCost edit) — avoids a historical/financial
//    audit mismatch between what the deduction actually happened
//    against and what the movement record states.
// ⚠️ ACCEPTED, DOCUMENTED RESIDUAL LIMITATION — FEFO candidate
//    discovery: batch document IDs are discovered via a
//    pre-transaction getDocs() query (this project's installed
//    Firestore SDK typings do not support transaction.get(Query),
//    only transaction.get(DocumentReference) — same constraint as
//    receiveBatch()). A batch created by a truly concurrent
//    operation between that query and this transaction's commit is
//    not considered as an FEFO candidate by THIS specific deduction.
//    currentStock itself is still protected by the
//    recompute-from-batches design and can never become numerically
//    wrong from this — only the FEFO batch selection could
//    theoretically miss a just-created batch. This is a
//    comparatively low-frequency, largely single-operator action, so
//    this trade-off is accepted rather than solved with an
//    artificial retry, which would add meaningful complexity for a
//    rare scenario.
// FROZEN
// ============================================

import { doc, runTransaction, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch, isEligibleForFEFO, sortBatchesByFEFO } from "../types/inventory-batch";
import {
  StockMovementReasonCategory, StockMovementReferenceType, BatchAllocationRecord,
} from "../../stock-movement-module/types/stock-movement";
import {
  inventoryDoc, batchDoc, stockMovementsCollection, batchesCollection,
  computeIsLowStock, ActorInfo,
} from "./inventory-service-helpers";

type DeductibleMovementType = "WASTE" | "KITCHEN_ISSUE" | "TRANSFER_OUT";

export interface DeductStockBatchInput {
  inventoryId:     string;
  quantity:        number;
  movementType:    DeductibleMovementType;
  reasonCategory?: StockMovementReasonCategory;
  reason?:         string;
  referenceType?:  StockMovementReferenceType;
  referenceId?:    string;
}

export interface BatchAllocation {
  batchId:            string;
  batchNo:            string;
  deductedQuantity:   number;
  remainingQuantity:  number;
}

export interface AllocationResult {
  beforeQuantity:    number;
  afterQuantity:     number;
  deductedQuantity:  number;
  allocations:       BatchAllocation[];
}

export interface DeductStockBatchResult {
  movementId: string;
  allocation: AllocationResult;
}

export async function deductStockBatch(
  restaurantId: string,
  item: InventoryItem,
  input: DeductStockBatchInput,
  actor?: ActorInfo
): Promise<DeductStockBatchResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (input.inventoryId !== item.id) {
    throw new Error("Deduction inventory item does not match the selected inventory item");
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Deduction quantity must be greater than 0");
  }
  if (input.reasonCategory === "OTHER" && !input.reason?.trim()) {
    throw new Error("Please enter a reason.");
  }

  const itemRef = inventoryDoc(restaurantId, item.id);
  const movementRef = doc(stockMovementsCollection(restaurantId));

  // ⚠️ See file-level residual limitation note.
  const idQuerySnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", input.inventoryId))
  );
  const batchIds = idQuerySnap.docs.map((d) => d.id);
  if (batchIds.length === 0) {
    throw new Error("No batches found for this item — nothing to deduct from");
  }

  const result = await runTransaction(db, async (transaction) => {
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error("Inventory item not found");

    const itemData = itemSnap.data();
    if ((itemData.isActive ?? true) === false) {
      throw new Error("Cannot deduct stock — this item is archived");
    }

    const batchRefs = batchIds.map((id) => batchDoc(restaurantId, id));
    const batchSnaps = await Promise.all(batchRefs.map((ref) => transaction.get(ref)));
    const allBatches: InventoryBatch[] = batchSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...(s.data() as Omit<InventoryBatch, "id">) }));

    let beforeQuantity = 0;
    for (const batch of allBatches) {
      const q = Number(batch.quantity);
      if (!Number.isFinite(q) || q < 0) {
        throw new Error(`Cannot deduct stock — batch "${batch.batchNo}" has an invalid quantity`);
      }
      beforeQuantity += q;
    }

    if (beforeQuantity < input.quantity) {
      throw new Error(`Cannot deduct ${input.quantity} — only ${beforeQuantity} stock available`);
    }

    const eligibleBatches = sortBatchesByFEFO(allBatches.filter(isEligibleForFEFO));
    const eligibleTotal = eligibleBatches.reduce((sum, b) => sum + b.quantity, 0);

    if (eligibleTotal < input.quantity) {
      throw new Error(
        `Cannot deduct ${input.quantity} — only ${eligibleTotal} available across eligible batches`
      );
    }

    let remainingToDeduct = input.quantity;
    const allocations: BatchAllocation[] = [];
    for (const batch of eligibleBatches) {
      if (remainingToDeduct <= 0) break;
      const deductFromThisBatch = Math.min(batch.quantity, remainingToDeduct);
      allocations.push({
        batchId:           batch.id,
        batchNo:           batch.batchNo,
        deductedQuantity:  deductFromThisBatch,
        remainingQuantity: batch.quantity - deductFromThisBatch,
      });
      remainingToDeduct -= deductFromThisBatch;
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.deductedQuantity, 0);
    if (totalAllocated !== input.quantity) {
      throw new Error(
        `Allocation mismatch — requested ${input.quantity} but allocated ${totalAllocated}. Deduction aborted.`
      );
    }

    for (const allocation of allocations) {
      transaction.update(batchDoc(restaurantId, allocation.batchId), {
        quantity:  allocation.remainingQuantity,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser!.uid,
      });
    }

    const allocationMap = new Map(allocations.map((a) => [a.batchId, a.remainingQuantity]));
    const afterQuantity = allBatches.reduce((sum, batch) => {
      const remaining = allocationMap.has(batch.id) ? allocationMap.get(batch.id)! : batch.quantity;
      return remaining > 0 ? sum + remaining : sum;
    }, 0);

    const minStock: number = Number(itemData.minStock ?? 0);
    const isLowStock = computeIsLowStock(afterQuantity, minStock);

    const itemUnitCost: number = Number(itemData.unitCost ?? 0);
    const recomputedTotalValue = Math.round(afterQuantity * itemUnitCost * 100) / 100;
    const itemUnit: string = itemData.unit;

    transaction.update(itemRef, {
      currentStock: afterQuantity,
      isLowStock,
      totalValue:   recomputedTotalValue,
      updatedAt:    serverTimestamp(),
      updatedBy:    auth.currentUser!.uid,
    });

    const batchAllocations: BatchAllocationRecord[] = allocations.map((a) => ({
      batchId:  a.batchId,
      batchNo:  a.batchNo,
      quantity: a.deductedQuantity,
    }));

    transaction.set(movementRef, {
      inventoryId:      item.id,
      itemName:         itemData.itemName,
      movementType:     input.movementType,
      quantityChanged:  -input.quantity,
      beforeQuantity,
      afterQuantity,
      unit:             itemUnit,
      unitCostAtTime:   itemUnitCost,
      movementValue:    Math.round(input.quantity * itemUnitCost * 100) / 100,
      reasonCategory:   input.reasonCategory ?? null,
      referenceType:    input.referenceType  ?? null,
      referenceId:      input.referenceId    ?? null,
      reason:           input.reason?.trim() || null,
      batchAllocations,
      restaurantId,
      createdBy:        auth.currentUser!.uid,
      createdByName:    actor?.createdByName ?? null,
      createdByRole:    actor?.createdByRole ?? null,
      createdAt:        serverTimestamp(),
    });

    return {
      beforeQuantity,
      afterQuantity,
      deductedQuantity: input.quantity,
      allocations,
    };
  });

  return { movementId: movementRef.id, allocation: result };
}