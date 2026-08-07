// ============================================
// SERVORA ERP — Batch Allocation Service (FEFO Engine)
// ✅ SINGLE RESPONSIBILITY — this file ONLY allocates and deducts
//    from batches inside a Firestore transaction. It does NOT
//    create StockMovement audit records — the CALLER
//    (inventory-service.ts) calls recordStockMovement() with the
//    appropriate movementType AFTER this function returns its
//    AllocationResult.
// ✅ FIRESTORE TRANSACTION CONSTRAINT (documented): Firestore
//    transactions cannot run arbitrary `where()` queries. Pattern:
//    1. BEFORE the transaction: query for batch document IDs
//       belonging to this item (non-transactional read).
//    2. INSIDE the transaction: re-read each specific document via
//       transaction.get() — always fresh at commit time.
//    KNOWN EDGE CASE: a NEW batch created between step 1 and commit
//    is not included in this deduction — it remains available for
//    the NEXT one. Inherent to Firestore's transaction model.
// ✅ Read-before-write discipline — ALL reads happen before ANY
//    write.
// ✅ Only ELIGIBLE batches (isEligibleForFEFO()) are allocated from.
// ✅ Insufficient stock throws before any writes.
// ✅ isActive guard — archived items cannot have stock deducted.
// ✅ Allocation consistency check — sum of allocated quantities must
//    exactly equal the requested quantity before any writes commit.
// ✅ updatedBy captured on both batch and item updates.
// ✅ FIX — beforeQuantity now reads from InventoryItem.currentStock
//    (the business-visible stock figure), NOT from summing the
//    batches. Rationale: if currentStock has ever drifted from the
//    true batch sum (e.g. a bug elsewhere, a manual Firestore edit,
//    a future batch merge/split bug), the StockMovement audit record
//    should show what stock LOOKED LIKE to the business before this
//    operation (currentStock) and what it IS after reconciliation
//    (the freshly recomputed batch sum) — "Before: 100, After: 97"
//    tells an admin at a glance that a 3-unit reconciliation
//    happened during this deduction, rather than silently hiding
//    the drift by reporting a "before" that was never actually the
//    displayed stock. afterQuantity remains the batch-derived
//    recompute, preserving the core invariant that currentStock is
//    always corrected to match batches going forward. Falls back to
//    the batch sum only if currentStock is missing entirely
//    (defensive, for any pre-batch-system document).
// ✅ afterQuantity is computed by applying the allocation deltas to
//    the already-read batch list in memory, not via a second read.
// FROZEN
// ============================================

import {
  runTransaction, doc, collection, getDocs, query, where, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  InventoryBatch,
  isEligibleForFEFO,
  sortBatchesByFEFO,
  calculateTotalFromBatches,
} from "../types/inventory-batch";

function inventoryDoc(restaurantId: string, inventoryId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, inventoryId);
}

function batchDoc(restaurantId: string, batchId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES, batchId);
}

function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
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

export interface DeductStockFEFOInput {
  inventoryId: string;
  quantity:    number;  // amount to deduct — always positive
}

// ── FEFO deduction engine. Deducts `quantity` from the item's
//    eligible batches in FEFO order, inside a single Firestore
//    transaction. Returns an AllocationResult; does NOT create any
//    StockMovement itself. ──
export async function deductStockFEFO(
  restaurantId: string,
  input: DeductStockFEFOInput
): Promise<AllocationResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (input.quantity <= 0) throw new Error("Deduction quantity must be greater than 0");

  const itemRef = inventoryDoc(restaurantId, input.inventoryId);

  // ── Step 1 (BEFORE the transaction) — discover batch document
  //    IDs. See FROZEN header. ──
  const idQuerySnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", input.inventoryId))
  );
  const batchIds = idQuerySnap.docs.map((d) => d.id);

  if (batchIds.length === 0) {
    throw new Error("No batches found for this item — nothing to deduct from");
  }

  const result = await runTransaction(db, async (transaction) => {
    // ── ALL READS FIRST (Firestore mandatory rule) ──
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) {
      throw new Error("Inventory item not found");
    }

    const itemData = itemSnap.data();
    const isActive = itemData.isActive ?? true;
    if (!isActive) {
      throw new Error("Cannot deduct stock — this item is archived");
    }

    const batchRefs = batchIds.map((id) => batchDoc(restaurantId, id));
    const batchSnaps = await Promise.all(batchRefs.map((ref) => transaction.get(ref)));

    const allBatches: InventoryBatch[] = batchSnaps
      .filter((snap) => snap.exists())
      .map((snap) => ({ id: snap.id, ...(snap.data() as Omit<InventoryBatch, "id">) }));

    // beforeQuantity = the business-visible stock figure
    // (InventoryItem.currentStock), NOT the batch sum — see FROZEN
    // header for why this matters for audit accuracy.
    const beforeQuantity: number = itemData.currentStock ?? calculateTotalFromBatches(allBatches);

    // ── FEFO allocation — computed in memory from the fresh
    //    transaction reads. ──
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
      const newBatchQuantity = batch.quantity - deductFromThisBatch;

      allocations.push({
        batchId:           batch.id,
        batchNo:           batch.batchNo,
        deductedQuantity:  deductFromThisBatch,
        remainingQuantity: newBatchQuantity,
      });

      remainingToDeduct -= deductFromThisBatch;
    }

    // ── Defense-in-depth: verify allocation matches request exactly
    //    before committing any writes. ──
    const totalAllocated = allocations.reduce((sum, a) => sum + a.deductedQuantity, 0);
    if (totalAllocated !== input.quantity) {
      throw new Error(
        `Allocation mismatch — requested ${input.quantity} but allocated ${totalAllocated}. Deduction aborted.`
      );
    }

    // ── ALL WRITES AFTER ALL READS (Firestore mandatory rule) ──
    for (const allocation of allocations) {
      transaction.update(batchDoc(restaurantId, allocation.batchId), {
        quantity:  allocation.remainingQuantity,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser!.uid,
      });
    }

    // afterQuantity = recomputed batch sum after applying this
    // deduction — this is the reconciled truth going forward.
    const allocationMap = new Map(allocations.map((a) => [a.batchId, a.remainingQuantity]));
    const batchesAfter = allBatches.map((b) =>
      allocationMap.has(b.id) ? { ...b, quantity: allocationMap.get(b.id)! } : b
    );
    const afterQuantity = calculateTotalFromBatches(batchesAfter);

    transaction.update(itemRef, {
      currentStock: afterQuantity,
      updatedAt:    serverTimestamp(),
      updatedBy:    auth.currentUser!.uid,
    });

    return {
      beforeQuantity,
      afterQuantity,
      deductedQuantity: input.quantity,
      allocations,
    };
  });

  return result;
}