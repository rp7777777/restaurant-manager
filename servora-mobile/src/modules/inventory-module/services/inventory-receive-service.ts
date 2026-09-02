// ============================================
// SERVORA ERP — Inventory Receive Service
// ✅ EXTRACTED from inventory-service.ts — pure structural refactor.
// ✅ receiveBatch() — currentStock/isLowStock/totalValue recomputed
//    from ACTUAL sibling batch documents (source of truth), never
//    from a stored-value delta. Includes: archived-item block,
//    unit-mismatch guard (fresh Firestore snapshot, not caller
//    object), malformed-quantity validation, fresh itemName
//    (denormalized-mismatch guard), zero-quantity rejection.
// ✅ createInventoryItemWithInitialBatch() — fully atomic: creates
//    the item AND its first batch AND the PURCHASE movement in one
//    transaction. No sibling-batch recomputation needed (a brand-new
//    item has no existing batches by definition).
// ⚠️ CONCURRENCY NOTE — this project's installed Firestore SDK
//    typings do not support transaction.get(Query), only
//    transaction.get(DocumentReference). Sibling batches are
//    therefore read with getDocs() BEFORE the transaction starts,
//    then re-read by direct reference INSIDE the transaction. This
//    introduces a narrow concurrency window: a batch write for the
//    same item occurring between the pre-transaction getDocs() and
//    the transaction's commit would not be included in this
//    operation's recomputed currentStock. Receiving stock is a
//    low-frequency, largely single-operator action, so this
//    trade-off is currently accepted.
// FROZEN
// ============================================

import {
  doc, collection, runTransaction, query, where, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import { CreateInventoryBatchInput } from "../types/inventory-batch";
import { BatchAllocationRecord } from "../../stock-movement-module/types/stock-movement";
import { createInventoryItem as repoCreateInventoryItem } from "../repository/inventory-repository";
import { todayISO } from "../../../utils/date-utils";
import {
  inventoryDoc, batchDoc, batchesCollection, stockMovementsCollection,
  batchKeyDoc, computeIsLowStock, normalizeBatchKey, isValidDateString,
  ActorInfo,
} from "./inventory-service-helpers";

export function validateBatchInput(batchInput: Omit<CreateInventoryBatchInput, "inventoryId">) {
  if (!batchInput.itemName.trim()) throw new Error("Item name is required");
  if (!batchInput.batchNo.trim()) throw new Error("Batch number is required");
  if (!Number.isFinite(batchInput.quantity) || batchInput.quantity < 0) {
    throw new Error("Batch quantity must be a valid non-negative number");
  }
  if (!Number.isFinite(batchInput.unitCost) || batchInput.unitCost < 0) {
    throw new Error("Unit cost must be a valid non-negative number");
  }
  if (!isValidDateString(batchInput.purchaseDate)) throw new Error("Purchase date must be a valid date (YYYY-MM-DD)");
  if (!isValidDateString(batchInput.receivedDate)) throw new Error("Received date must be a valid date (YYYY-MM-DD)");
  if (batchInput.expiryDate && !isValidDateString(batchInput.expiryDate)) {
    throw new Error("Expiry date must be a valid date (YYYY-MM-DD)");
  }
}

// ── Receive Batch — currentStock + isLowStock + totalValue authoritative ──
export interface ReceiveBatchResult {
  batchId:         string;
  newCurrentStock: number;
  movementId:      string;
}

export async function receiveBatch(
  restaurantId: string,
  existingItem: InventoryItem,
  batchInput: CreateInventoryBatchInput,
  actor?: ActorInfo
): Promise<ReceiveBatchResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (batchInput.inventoryId !== existingItem.id) {
    throw new Error("Batch inventory item does not match the selected inventory item");
  }
  validateBatchInput(batchInput);
  if (batchInput.quantity <= 0) {
    throw new Error("Received quantity must be greater than 0");
  }

  const batchKey = normalizeBatchKey(batchInput.inventoryId, batchInput.batchNo);
  const batchKeyRef = batchKeyDoc(restaurantId, batchKey);
  const newBatchRef = doc(batchesCollection(restaurantId));
  const movementRef = doc(stockMovementsCollection(restaurantId));
  const itemRef = inventoryDoc(restaurantId, existingItem.id);

  // ⚠️ See file-level CONCURRENCY NOTE.
  const siblingBatchesSnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", existingItem.id))
  );
  const siblingBatchRefs = siblingBatchesSnap.docs.map((d) => batchDoc(restaurantId, d.id));

  const result = await runTransaction(db, async (transaction) => {
    const batchKeySnap = await transaction.get(batchKeyRef);
    if (batchKeySnap.exists()) {
      throw new Error(`Batch number "${batchInput.batchNo.trim()}" already exists for this item`);
    }

    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error("Inventory item not found");
    const itemData = itemSnap.data();

    if ((itemData.isActive ?? true) === false) {
      throw new Error("Cannot receive stock — this item is archived. Restore it first.");
    }

    const itemUnit: string = itemData.unit;
    if (batchInput.unit !== itemUnit) {
      throw new Error(
        `Cannot receive — this batch is measured in ${batchInput.unit}, but ` +
        `"${itemData.itemName}" is measured in ${itemUnit}`
      );
    }

    const siblingSnaps = await Promise.all(siblingBatchRefs.map((ref) => transaction.get(ref)));
    let beforeQuantity = 0;
    for (const snap of siblingSnaps) {
      if (!snap.exists()) continue;
      const data = snap.data();
      const q = Number(data.quantity);
      if (!Number.isFinite(q) || q < 0) {
        throw new Error(`Cannot receive stock — existing batch "${data.batchNo}" has an invalid quantity`);
      }
      if (q > 0) beforeQuantity += q;
    }

    const afterQuantity = beforeQuantity + batchInput.quantity;
    const minStock: number = Number(itemData.minStock ?? 0);
    const isLowStock = computeIsLowStock(afterQuantity, minStock);

    const itemUnitCost: number = itemData.unitCost ?? 0;
    const recomputedTotalValue = Math.round(afterQuantity * itemUnitCost * 100) / 100;

    const freshItemName: string = itemData.itemName;

    const batchAllocations: BatchAllocationRecord[] = [{
      batchId:  newBatchRef.id,
      batchNo:  batchInput.batchNo.trim(),
      quantity: batchInput.quantity,
    }];

    transaction.set(batchKeyRef, {
      inventoryId: batchInput.inventoryId,
      batchNo:     batchInput.batchNo.trim(),
      batchId:     newBatchRef.id,
      restaurantId,
      createdAt:   serverTimestamp(),
    });

    transaction.set(newBatchRef, {
      inventoryId:      batchInput.inventoryId,
      itemName:         freshItemName,
      batchNo:          batchInput.batchNo.trim(),
      quantity:         batchInput.quantity,
      originalQuantity: batchInput.quantity,
      unit:             batchInput.unit,
      unitCost:         batchInput.unitCost,
      purchaseDate:     batchInput.purchaseDate,
      receivedDate:     batchInput.receivedDate,
      expiryDate:       batchInput.expiryDate ?? null,
      status:           batchInput.status ?? "ACTIVE",
      supplierId:       batchInput.supplierId ?? null,
      locationId:       batchInput.locationId ?? null,
      notes:            batchInput.notes?.trim() || null,
      restaurantId,
      createdBy:        auth.currentUser!.uid,
      createdAt:        serverTimestamp(),
      updatedAt:        serverTimestamp(),
    });

    transaction.set(movementRef, {
      inventoryId:      existingItem.id,
      itemName:         freshItemName,
      movementType:     "PURCHASE",
      quantityChanged:  batchInput.quantity,
      beforeQuantity,
      afterQuantity,
      unit:             batchInput.unit,
      unitCostAtTime:   batchInput.unitCost,
      movementValue:    Math.round(batchInput.quantity * batchInput.unitCost * 100) / 100,
      reasonCategory:   null,
      referenceType:    "MANUAL",
      referenceId:      null,
      reason:           `Received batch ${batchInput.batchNo.trim()}`,
      batchAllocations,
      restaurantId,
      createdBy:        auth.currentUser!.uid,
      createdByName:    actor?.createdByName ?? null,
      createdByRole:    actor?.createdByRole ?? null,
      createdAt:        serverTimestamp(),
    });

    transaction.update(itemRef, {
      currentStock: afterQuantity,
      isLowStock,
      totalValue:   recomputedTotalValue,
      updatedAt:    serverTimestamp(),
    });

    return { newCurrentStock: afterQuantity };
  });

  return {
    batchId:         newBatchRef.id,
    newCurrentStock: result.newCurrentStock,
    movementId:      movementRef.id,
  };
}

// ── Create Item WITH Initial Batch — fully atomic ────
export interface CreateItemWithInitialBatchInput {
  itemInput:      CreateInventoryItemInput;
  batchNo?:       string;
  receivedDate?:  string;
}

export interface CreateItemWithInitialBatchResult {
  itemId:  string;
  batchId: string | null;
}

function generateInitialBatchNo(itemName: string): string {
  const initials = itemName.trim().slice(0, 3).toUpperCase() || "ITM";
  return `${initials}-INIT-${Date.now()}`;
}

export async function createInventoryItemWithInitialBatch(
  restaurantId: string,
  input: CreateItemWithInitialBatchInput,
  actor?: ActorInfo
): Promise<CreateItemWithInitialBatchResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const requestedQuantity = input.itemInput.currentStock;

  if (!Number.isFinite(requestedQuantity) || requestedQuantity < 0) {
    throw new Error("Initial stock must be a valid non-negative number");
  }

  if (requestedQuantity === 0) {
    const itemId = await repoCreateInventoryItem(restaurantId, {
      ...input.itemInput,
      currentStock: 0,
    });
    return { itemId, batchId: null };
  }

  const receivedDate = input.receivedDate?.trim() || todayISO();
  const batchNo = input.batchNo?.trim() || generateInitialBatchNo(input.itemInput.itemName);

  validateBatchInput({
    itemName:     input.itemInput.itemName,
    batchNo,
    quantity:     requestedQuantity,
    unit:         input.itemInput.unit,
    unitCost:     input.itemInput.unitCost,
    purchaseDate: receivedDate,
    receivedDate,
    expiryDate:   input.itemInput.expiryDate,
  });

  const itemId = doc(collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY)).id;
  const itemRef = inventoryDoc(restaurantId, itemId);
  const newBatchRef = doc(batchesCollection(restaurantId));
  const movementRef = doc(stockMovementsCollection(restaurantId));
  const batchKey = normalizeBatchKey(itemId, batchNo);
  const batchKeyRef = batchKeyDoc(restaurantId, batchKey);

  await runTransaction(db, async (transaction) => {
    const batchKeySnap = await transaction.get(batchKeyRef);
    if (batchKeySnap.exists()) {
      throw new Error(`Batch number "${batchNo}" already exists for this item`);
    }

    const batchAllocations: BatchAllocationRecord[] = [{
      batchId:  newBatchRef.id,
      batchNo,
      quantity: requestedQuantity,
    }];

    const isLowStock = computeIsLowStock(requestedQuantity, input.itemInput.minStock);

    transaction.set(itemRef, {
      itemName:                 input.itemInput.itemName,
      categoryId:                input.itemInput.categoryId,
      currentStock:              requestedQuantity,
      unit:                      input.itemInput.unit,
      unitCost:                  input.itemInput.unitCost,
      minStock:                  input.itemInput.minStock,
      isLowStock,
      totalValue:                Math.round(requestedQuantity * input.itemInput.unitCost * 100) / 100,
      storageLocation:           input.itemInput.storageLocation ?? null,
      supplierId:                input.itemInput.supplierId ?? null,
      expiryDate:                input.itemInput.expiryDate ?? null,
      batchNo:                   input.itemInput.batchNo ?? null,
      sku:                       input.itemInput.sku ?? null,
      barcode:                   input.itemInput.barcode ?? null,
      notes:                     input.itemInput.notes ?? null,
      expiryAlertDaysOverride:   input.itemInput.expiryAlertDaysOverride ?? null,
      isActive:                  input.itemInput.isActive ?? true,
      restaurantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(batchKeyRef, {
      inventoryId: itemId,
      batchNo,
      batchId:     newBatchRef.id,
      restaurantId,
      createdAt:   serverTimestamp(),
    });

    transaction.set(newBatchRef, {
      inventoryId:      itemId,
      itemName:         input.itemInput.itemName,
      batchNo,
      quantity:         requestedQuantity,
      originalQuantity: requestedQuantity,
      unit:             input.itemInput.unit,
      unitCost:         input.itemInput.unitCost,
      purchaseDate:     receivedDate,
      receivedDate,
      expiryDate:       input.itemInput.expiryDate ?? null,
      status:           "ACTIVE",
      supplierId:       input.itemInput.supplierId ?? null,
      locationId:       null,
      notes:            null,
      restaurantId,
      createdBy:        auth.currentUser!.uid,
      createdAt:        serverTimestamp(),
      updatedAt:        serverTimestamp(),
    });

    transaction.set(movementRef, {
      inventoryId:      itemId,
      itemName:         input.itemInput.itemName,
      movementType:     "PURCHASE",
      quantityChanged:  requestedQuantity,
      beforeQuantity:   0,
      afterQuantity:    requestedQuantity,
      unit:             input.itemInput.unit,
      unitCostAtTime:   input.itemInput.unitCost,
      movementValue:    Math.round(requestedQuantity * input.itemInput.unitCost * 100) / 100,
      reasonCategory:   null,
      referenceType:    "MANUAL",
      referenceId:      null,
      reason:           `Received batch ${batchNo}`,
      batchAllocations,
      restaurantId,
      createdBy:        auth.currentUser!.uid,
      createdByName:    actor?.createdByName ?? null,
      createdByRole:    actor?.createdByRole ?? null,
      createdAt:        serverTimestamp(),
    });
  });

  return { itemId, batchId: newBatchRef.id };
}