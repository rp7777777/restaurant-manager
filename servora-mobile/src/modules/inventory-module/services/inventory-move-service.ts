// ============================================
// SERVORA ERP — Inventory Move Service
// ✅ EXTRACTED from inventory-service.ts — pure structural refactor.
// ✅ moveBatchToItem() — for correcting a batch that was received
//    against the WRONG InventoryItem entirely (e.g. "beer" stock
//    accidentally receipted onto "water"'s document — a
//    different-item mistake, distinct from correctBatchDetails()'s
//    same-item typo fixes). Moves the batch's inventoryId/itemName,
//    transfers its quantity between the SOURCE and TARGET items'
//    currentStock/isLowStock/totalValue (both recomputed from ACTUAL
//    remaining batch documents, never from a stored-value delta),
//    and records a paired TRANSFER_OUT/TRANSFER_IN movement (both
//    tagged reasonCategory: "DATA_CORRECTION") for a full audit
//    trail.
// ✅ Guards: batch quantity validated (rejects malformed/zero/
//    negative — nothing meaningful to move if the batch is already
//    depleted); source inventoryId presence validated; unit
//    compatibility checked against the FRESH target item snapshot
//    (not the caller-supplied targetItem object, which could be
//    stale); target item's isActive checked (blocks moving a batch
//    onto an archived item); batch-key uniqueness on the target
//    (rejects if the target already has a batch with this same
//    batchNo).
// ✅ CRITICAL — historical-batch-replay-service.ts's
//    isRealStockDeduction() excludes TRANSFER_OUT movements tagged
//    reasonCategory "DATA_CORRECTION" (written exclusively by this
//    function) from being treated as a real stock deduction. Without
//    that exclusion, a moved batch would appear to be
//    "double-deducted" in historical replay — once via the item
//    reassignment itself, and again via the TRANSFER_OUT movement's
//    batchAllocations entry. See historical-batch-replay-service.ts
//    for the full rationale.
// ⚠️ CONCURRENCY NOTE — same project-wide Firestore SDK typings
//    constraint as receiveBatch()/deductStockBatch()/
//    correctBatchDetails(): sibling batches for BOTH the source and
//    target items are read with getDocs() BEFORE the transaction
//    starts, then re-read by direct reference INSIDE the
//    transaction. Narrow concurrency window accepted for the same
//    reasons (low-frequency, manual, single-operator correction
//    action).
// FROZEN
// ============================================

import { doc, runTransaction, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { InventoryItem } from "../types/inventory";
import { BatchAllocationRecord } from "../../stock-movement-module/types/stock-movement";
import {
  inventoryDoc, batchDoc, batchesCollection, stockMovementsCollection, batchKeyDoc,
  computeIsLowStock, normalizeBatchKey, ActorInfo,
} from "./inventory-service-helpers";

export interface MoveBatchToItemResult {
  movementOutId: string;
  movementInId:  string;
}

export async function moveBatchToItem(
  restaurantId: string,
  batchId: string,
  targetItem: InventoryItem,
  actor?: ActorInfo
): Promise<MoveBatchToItemResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!batchId) throw new Error("Batch is required");
  if (!targetItem?.id) throw new Error("Target item is required");

  const targetBatchRef = batchDoc(restaurantId, batchId);
  const targetItemRef  = inventoryDoc(restaurantId, targetItem.id);
  const movementOutRef = doc(stockMovementsCollection(restaurantId));
  const movementInRef  = doc(stockMovementsCollection(restaurantId));

  // First, read this batch (outside the transaction) to know which
  // source item's sibling batches to fetch.
  const targetBatchLookupSnap = await getDocs(
    query(batchesCollection(restaurantId), where("__name__", "==", batchId))
  );
  if (targetBatchLookupSnap.empty) throw new Error("Batch not found");
  const sourceInventoryIdForFetch: string = targetBatchLookupSnap.docs[0].data().inventoryId;

  // ⚠️ See file-level CONCURRENCY NOTE.
  const sourceSiblingSnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", sourceInventoryIdForFetch))
  );
  const sourceSiblingRefs = sourceSiblingSnap.docs.map((d) => batchDoc(restaurantId, d.id));

  const targetSiblingSnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", targetItem.id))
  );
  const targetSiblingRefs = targetSiblingSnap.docs.map((d) => batchDoc(restaurantId, d.id));

  const result = await runTransaction(db, async (transaction) => {
    const batchSnap = await transaction.get(targetBatchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const batchData = batchSnap.data();

    const sourceInventoryId: string = batchData.inventoryId;
    const batchNo: string            = batchData.batchNo;
    const batchQuantity: number      = Number(batchData.quantity);
    const batchUnit: string          = batchData.unit;
    const batchUnitCost: number      = batchData.unitCost ?? 0;

    if (!Number.isFinite(batchQuantity) || batchQuantity <= 0) {
      throw new Error(`Cannot move — batch "${batchNo}" has an invalid or zero quantity`);
    }
    if (!sourceInventoryId) {
      throw new Error("Cannot move — batch has no source inventory item");
    }

    if (sourceInventoryId === targetItem.id) {
      throw new Error("Batch is already assigned to this item");
    }

    const sourceItemRef = inventoryDoc(restaurantId, sourceInventoryId);
    const sourceItemSnap = await transaction.get(sourceItemRef);
    if (!sourceItemSnap.exists()) throw new Error("Source inventory item not found");
    const sourceItemData = sourceItemSnap.data();

    const targetItemSnap = await transaction.get(targetItemRef);
    if (!targetItemSnap.exists()) throw new Error("Target inventory item not found");
    const targetItemData = targetItemSnap.data();

    const targetUnit: string = targetItemData.unit;
    const targetItemName: string = targetItemData.itemName;

    if (batchUnit !== targetUnit) {
      throw new Error(
        `Cannot move — this batch is measured in ${batchUnit}, but ` +
        `"${targetItemName}" is measured in ${targetUnit}`
      );
    }

    if (targetItemData.isActive === false) {
      throw new Error(`Cannot move — target item "${targetItemName}" is inactive`);
    }

    const newKey = normalizeBatchKey(targetItem.id, batchNo);
    const newKeyRef = batchKeyDoc(restaurantId, newKey);
    const newKeySnap = await transaction.get(newKeyRef);
    if (newKeySnap.exists()) {
      throw new Error(`Batch number "${batchNo}" already exists on "${targetItemName}"`);
    }

    const oldKey = normalizeBatchKey(sourceInventoryId, batchNo);
    const oldKeyRef = batchKeyDoc(restaurantId, oldKey);

    const sourceSiblingSnaps = await Promise.all(sourceSiblingRefs.map((ref) => transaction.get(ref)));
    let sourceAfterQuantity = 0;
    for (const snap of sourceSiblingSnaps) {
      if (!snap.exists()) continue;
      if (snap.id === batchId) continue; // this batch is leaving
      const data = snap.data();
      const q = Number(data.quantity);
      if (!Number.isFinite(q) || q < 0) {
        throw new Error(`Cannot move — source batch "${data.batchNo}" has an invalid quantity`);
      }
      if (q > 0) sourceAfterQuantity += q;
    }

    const sourceMinStock: number = Number(sourceItemData.minStock ?? 0);
    const sourceIsLowStock = computeIsLowStock(sourceAfterQuantity, sourceMinStock);
    const sourceUnitCost: number = Number(sourceItemData.unitCost ?? 0);
    const sourceRecomputedTotalValue = Math.round(sourceAfterQuantity * sourceUnitCost * 100) / 100;

    const targetSiblingSnaps = await Promise.all(targetSiblingRefs.map((ref) => transaction.get(ref)));
    let targetAfterQuantity = batchQuantity; // this batch, arriving
    for (const snap of targetSiblingSnaps) {
      if (!snap.exists()) continue;
      const data = snap.data();
      const q = Number(data.quantity);
      if (!Number.isFinite(q) || q < 0) {
        throw new Error(`Cannot move — target batch "${data.batchNo}" has an invalid quantity`);
      }
      if (q > 0) targetAfterQuantity += q;
    }

    const targetMinStock: number = Number(targetItemData.minStock ?? 0);
    const targetIsLowStock = computeIsLowStock(targetAfterQuantity, targetMinStock);
    const targetUnitCost: number = Number(targetItemData.unitCost ?? 0);
    const targetRecomputedTotalValue = Math.round(targetAfterQuantity * targetUnitCost * 100) / 100;

    const sourceBeforeQuantity = sourceAfterQuantity + batchQuantity;
    const targetBeforeQuantity = targetAfterQuantity - batchQuantity;

    const batchAllocations: BatchAllocationRecord[] = [{
      batchId,
      batchNo,
      quantity: batchQuantity,
    }];

    transaction.set(newKeyRef, {
      inventoryId: targetItem.id,
      batchNo,
      batchId,
      restaurantId,
      createdAt:   serverTimestamp(),
    });
    transaction.delete(oldKeyRef);

    transaction.update(targetBatchRef, {
      inventoryId: targetItem.id,
      itemName:    targetItemName,
      updatedAt:   serverTimestamp(),
      updatedBy:   auth.currentUser!.uid,
    });

    transaction.update(sourceItemRef, {
      currentStock: sourceAfterQuantity,
      isLowStock:   sourceIsLowStock,
      totalValue:   sourceRecomputedTotalValue,
      updatedAt:    serverTimestamp(),
    });
    transaction.update(targetItemRef, {
      currentStock: targetAfterQuantity,
      isLowStock:   targetIsLowStock,
      totalValue:   targetRecomputedTotalValue,
      updatedAt:    serverTimestamp(),
    });

    const movementValue = Math.round(batchQuantity * batchUnitCost * 100) / 100;

    transaction.set(movementOutRef, {
      inventoryId:     sourceInventoryId,
      itemName:        sourceItemData.itemName,
      movementType:    "TRANSFER_OUT",
      quantityChanged: -batchQuantity,
      beforeQuantity:  sourceBeforeQuantity,
      afterQuantity:   sourceAfterQuantity,
      unit:            batchUnit,
      unitCostAtTime:  batchUnitCost,
      movementValue,
      reasonCategory:  "DATA_CORRECTION",
      referenceType:   "MANUAL",
      referenceId:     null,
      reason:          `Batch ${batchNo} moved to "${targetItemName}" (incorrect item correction)`,
      batchAllocations,
      restaurantId,
      createdBy:       auth.currentUser!.uid,
      createdByName:   actor?.createdByName ?? null,
      createdByRole:   actor?.createdByRole ?? null,
      createdAt:       serverTimestamp(),
    });

    transaction.set(movementInRef, {
      inventoryId:     targetItem.id,
      itemName:        targetItemName,
      movementType:    "TRANSFER_IN",
      quantityChanged: batchQuantity,
      beforeQuantity:  targetBeforeQuantity,
      afterQuantity:   targetAfterQuantity,
      unit:            batchUnit,
      unitCostAtTime:  batchUnitCost,
      movementValue,
      reasonCategory:  "DATA_CORRECTION",
      referenceType:   "MANUAL",
      referenceId:     null,
      reason:          `Batch ${batchNo} moved from "${sourceItemData.itemName}" (incorrect item correction)`,
      batchAllocations,
      restaurantId,
      createdBy:       auth.currentUser!.uid,
      createdByName:   actor?.createdByName ?? null,
      createdByRole:   actor?.createdByRole ?? null,
      createdAt:       serverTimestamp(),
    });

    return {};
  });

  return {
    movementOutId: movementOutRef.id,
    movementInId:  movementInRef.id,
  };
}