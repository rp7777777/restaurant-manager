// ============================================
// SERVORA ERP — Inventory Correct Service
// ✅ EXTRACTED from inventory-service.ts — pure structural refactor.
// ✅ correctBatchDetails() — for fixing a batch's own typo'd
//    details (batchNo, expiryDate, quantity). currentStock/
//    isLowStock/totalValue recomputed from ACTUAL sibling batch
//    documents (source of truth) ONLY when quantity is actually
//    changing — batchNo/expiryDate-only edits never touch the item
//    document at all.
// ✅ Two integrity guards: existingItem.id must match input.itemId
//    (caller/input consistency), AND the batch's own
//    inventoryId must match input.itemId (batch really belongs to
//    the claimed item) — two independent checks against a
//    stale/mismatched caller silently correcting the wrong item's
//    batch.
// ✅ oldQuantity (the batch's CURRENT stored quantity) is validated
//    BEFORE being used in the quantityIsChanging comparison — a
//    malformed existing value would otherwise make that comparison
//    unreliable.
// ⚠️ PENDING ARCHITECTURE ITEM (not fixed here, documented) —
//    manual quantity correction changes `quantity` but leaves
//    `originalQuantity` unchanged (by design — originalQuantity
//    means "quantity at batch creation time", which a later
//    correction does not retroactively rewrite). No movement/audit
//    record is created for a correction, and
//    historical-batch-replay-service.ts has no concept of a
//    "correction event" — so a manual quantity correction is not
//    currently reflected in historical replay for dates BEFORE the
//    correction. Representing this properly would require a new
//    BATCH_CORRECTION-style audit event and coordinated changes to
//    the replay service — a larger design decision, deferred.
// ⚠️ CONCURRENCY NOTE — same project-wide Firestore SDK typings
//    constraint as receiveBatch()/deductStockBatch(): sibling
//    batches are read with getDocs() BEFORE the transaction starts
//    (only when quantity is changing), then re-read by direct
//    reference INSIDE the transaction. Narrow concurrency window
//    accepted for the same reasons (low-frequency, manual
//    operation).
// FROZEN
// ============================================

import { runTransaction, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { InventoryItem } from "../types/inventory";
import {
  inventoryDoc, batchDoc, batchesCollection, batchKeyDoc,
  computeIsLowStock, normalizeBatchKey, normalizeBatchKeyString, isValidDateString,
} from "./inventory-service-helpers";

export interface CorrectBatchDetailsInput {
  batchId:     string;
  itemId:      string;
  batchNo?:    string;
  expiryDate?: string;
  quantity?:   number;
}

export interface CorrectBatchDetailsResult {
  newCurrentStock: number | null;
}

export async function correctBatchDetails(
  restaurantId: string,
  existingItem: InventoryItem,
  input: CorrectBatchDetailsInput
): Promise<CorrectBatchDetailsResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  if (existingItem.id !== input.itemId) {
    throw new Error("Batch correction item does not match the selected inventory item");
  }

  if (input.batchNo !== undefined && !input.batchNo.trim()) {
    throw new Error("Batch number cannot be empty");
  }
  if (input.quantity !== undefined && (!Number.isFinite(input.quantity) || input.quantity < 0)) {
    throw new Error("Batch quantity must be a valid non-negative number");
  }
  if (input.expiryDate && !isValidDateString(input.expiryDate)) {
    throw new Error("Expiry date must be a valid date (YYYY-MM-DD)");
  }

  const targetBatchRef = batchDoc(restaurantId, input.batchId);
  const itemRef = inventoryDoc(restaurantId, input.itemId);

  // ⚠️ See file-level CONCURRENCY NOTE.
  const siblingBatchesSnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", input.itemId))
  );
  const siblingBatchRefs = siblingBatchesSnap.docs.map((d) => batchDoc(restaurantId, d.id));

  const result = await runTransaction(db, async (transaction) => {
    const batchSnap = await transaction.get(targetBatchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const batchData = batchSnap.data();

    if (batchData.inventoryId !== input.itemId) {
      throw new Error("This batch does not belong to the specified inventory item");
    }

    const currentBatchNo: string = batchData.batchNo;

    const oldQuantity = Number(batchData.quantity);
    if (!Number.isFinite(oldQuantity) || oldQuantity < 0) {
      throw new Error(`Cannot correct batch — batch "${batchData.batchNo}" has an invalid quantity`);
    }

    const quantityIsChanging = input.quantity !== undefined && input.quantity !== oldQuantity;

    let itemSnap = null;
    if (quantityIsChanging) {
      itemSnap = await transaction.get(itemRef);
      if (!itemSnap.exists()) throw new Error("Inventory item not found");
    }

    let newKeyRef = null;
    let oldKeyRef = null;
    const batchNoIsChanging =
      input.batchNo !== undefined &&
      normalizeBatchKeyString(input.batchNo) !== normalizeBatchKeyString(currentBatchNo);

    if (batchNoIsChanging) {
      const newKey = normalizeBatchKey(input.itemId, input.batchNo!);
      newKeyRef = batchKeyDoc(restaurantId, newKey);
      const newKeySnap = await transaction.get(newKeyRef);
      if (newKeySnap.exists()) {
        throw new Error(`Batch number "${input.batchNo!.trim()}" already exists for this item`);
      }

      const oldKey = normalizeBatchKey(input.itemId, currentBatchNo);
      oldKeyRef = batchKeyDoc(restaurantId, oldKey);
      const oldKeySnap = await transaction.get(oldKeyRef);
      if (oldKeySnap.exists() && oldKeySnap.data().batchId !== input.batchId) {
        throw new Error("Batch key integrity conflict — please retry");
      }
    }

    let newCurrentStock: number | null = null;
    if (itemSnap && quantityIsChanging) {
      const itemData = itemSnap.data();

      const siblingSnaps = await Promise.all(siblingBatchRefs.map((ref) => transaction.get(ref)));

      let recomputedStock = 0;
      for (const snap of siblingSnaps) {
        if (!snap.exists()) continue;
        const isTargetBatch = snap.id === input.batchId;
        const data = snap.data();
        const q = isTargetBatch ? input.quantity! : Number(data.quantity);
        if (!Number.isFinite(q) || q < 0) {
          throw new Error(`Cannot correct batch — batch "${data.batchNo}" has an invalid quantity`);
        }
        if (q > 0) recomputedStock += q;
      }

      newCurrentStock = recomputedStock;
      const minStock: number = Number(itemData.minStock ?? 0);
      const isLowStock = computeIsLowStock(newCurrentStock, minStock);
      const itemUnitCost: number = Number(itemData.unitCost ?? 0);
      const recomputedTotalValue = Math.round(newCurrentStock * itemUnitCost * 100) / 100;

      transaction.update(itemRef, {
        currentStock: newCurrentStock,
        isLowStock,
        totalValue:   recomputedTotalValue,
        updatedAt:    serverTimestamp(),
      });
    }

    const batchUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser!.uid,
    };
    if (input.batchNo !== undefined) batchUpdates.batchNo = input.batchNo.trim();
    if (input.expiryDate !== undefined) batchUpdates.expiryDate = input.expiryDate.trim() || null;
    if (input.quantity !== undefined) batchUpdates.quantity = input.quantity;

    transaction.update(targetBatchRef, batchUpdates);

    if (newKeyRef && oldKeyRef) {
      transaction.set(newKeyRef, {
        inventoryId: input.itemId,
        batchNo:     input.batchNo!.trim(),
        batchId:     input.batchId,
        restaurantId,
        createdAt:   serverTimestamp(),
      });
      transaction.delete(oldKeyRef);
    }

    return { newCurrentStock };
  });

  return result;
}