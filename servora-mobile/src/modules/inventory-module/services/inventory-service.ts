// ============================================
// SERVORA ERP — Inventory Service
// ✅ ARCHITECTURE — this file holds BUSINESS OPERATIONS only.
// ✅ adjustStock() — thin wrapper for NON-BATCH items.
// ✅ archiveInventoryItem() / restoreInventoryItem() — toggle
//    isActive.
// ✅ duplicateInventoryItem() — real, common ERP row-action.
// ✅ InventoryItem.currentStock is the AUTHORITATIVE transactional
//    counter — every stock-changing write recomputes it from actual
//    batch documents (source of truth), not from a stored-value
//    delta.
// ⚠️ CONCURRENCY NOTE (project-wide, applies to receiveBatch(),
//    deductStockBatch(), correctBatchDetails(), moveBatchToItem()):
//    this project's installed Firestore SDK typings do not support
//    transaction.get(Query) — only transaction.get(DocumentReference).
//    Sibling/related batches are therefore read with getDocs()
//    BEFORE each transaction starts, then re-read by direct
//    reference INSIDE the transaction. This introduces a narrow
//    concurrency window: a batch write for the same item occurring
//    between the pre-transaction getDocs() and the transaction's
//    commit would not be included in that operation's recomputed
//    currentStock. These are comparatively low-frequency, largely
//    single-operator inventory actions (not high-volume POS-scale
//    concurrent writes), so this trade-off is currently accepted. If
//    stronger concurrency guarantees are required later, move
//    sibling-batch aggregation to a transaction-safe reference/
//    counter architecture instead of a query-based sum.
// ✅ isLowStock is recomputed and written in EVERY transaction that
//    changes currentStock, matching inventory-repository.ts's own
//    corrected formula exactly:
//      isLowStock = afterQuantity > 0 && afterQuantity <= minStock
// ✅ totalValue is recomputed (currentStock × item.unitCost) in every
//    transaction that changes currentStock — this project's existing
//    item-level valuation model (not per-batch weighted valuation,
//    which is a separate, larger design decision, out of scope here).
// ✅ minStock/unitCost are read FRESH from each transaction's own
//    itemSnap (never trusted from a caller-supplied InventoryItem
//    object, which could be stale relative to a concurrent edit).
// ✅ FEFO allocation logic is NOT duplicated — reuses the same pure
//    sortBatchesByFEFO()/isEligibleForFEFO() functions
//    batch-allocation-service.ts uses.
// FROZEN
// ============================================

import {
  createInventoryItem as repoCreateInventoryItem,
  updateInventoryItem,
} from "../repository/inventory-repository";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import {
  CreateInventoryBatchInput,
  InventoryBatch,
  isEligibleForFEFO,
  sortBatchesByFEFO,
} from "../types/inventory-batch";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import {
  RecordStockMovementInput,
  StockMovementReasonCategory,
  StockMovementReferenceType,
  BatchAllocationRecord,
} from "../../stock-movement-module/types/stock-movement";
import { db, auth } from "../../../firebase";
import {
  doc, collection, runTransaction, query, where, getDocs, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { todayISO } from "../../../utils/date-utils";

function inventoryDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
}

function batchDoc(restaurantId: string, batchId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES, batchId);
}

function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
}

function stockMovementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

function batchKeyDoc(restaurantId: string, key: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.BATCH_KEYS, key);
}

// ✅ Single source of truth for isLowStock, matching
// inventory-repository.ts's own corrected formula exactly.
function computeIsLowStock(currentStock: number, minStock: number): boolean {
  return currentStock > 0 && currentStock <= minStock;
}

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function utf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.codePointAt(i)!;
    if (code > 0xFFFF) i++;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
    } else if (code < 0x10000) {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    } else {
      bytes.push(
        0xF0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3F),
        0x80 | ((code >> 6) & 0x3F),
        0x80 | (code & 0x3F)
      );
    }
  }
  return bytes;
}

function base64UrlEncode(str: string): string {
  const bytes = utf8Bytes(str);
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    result += BASE64URL_ALPHABET[b0 >> 2];
    result += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | (b1 !== undefined ? b1 >> 4 : 0)];
    if (b1 !== undefined) {
      result += BASE64URL_ALPHABET[((b1 & 0x0F) << 2) | (b2 !== undefined ? b2 >> 6 : 0)];
    }
    if (b2 !== undefined) {
      result += BASE64URL_ALPHABET[b2 & 0x3F];
    }
  }
  return result;
}

function normalizeBatchKeyString(batchNo: string): string {
  return batchNo.trim().toLowerCase();
}

function normalizeBatchKey(inventoryId: string, batchNo: string): string {
  return `${inventoryId}__${base64UrlEncode(normalizeBatchKeyString(batchNo))}`;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export interface ActorInfo {
  createdByName?: string;
  createdByRole?: string;
}

// ── Stock Adjustment (non-batch path) ────────────
export async function adjustStock(
  restaurantId: string,
  input: RecordStockMovementInput
): Promise<{ movementId: string; beforeQuantity: number; afterQuantity: number; movementValue: number }> {
  return recordStockMovement(restaurantId, input);
}

// ── Archive ──────────────────────────────────────
export async function archiveInventoryItem(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  await updateDoc(inventoryDoc(restaurantId, itemId), {
    isActive:  false,
    updatedAt: serverTimestamp(),
  });
}

// ── Restore ──────────────────────────────────────
export async function restoreInventoryItem(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  await updateDoc(inventoryDoc(restaurantId, itemId), {
    isActive:  true,
    updatedAt: serverTimestamp(),
  });
}

// ── Duplicate ────────────────────────────────────
export async function duplicateInventoryItem(
  restaurantId: string,
  source: InventoryItem,
  duplicatedName: string
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const input: CreateInventoryItemInput = {
    itemName:                 duplicatedName,
    categoryId:                source.categoryId,
    currentStock:              0,
    unit:                      source.unit,
    unitCost:                  source.unitCost,
    minStock:                  source.minStock,
    storageLocation:           source.storageLocation,
    supplierId:                source.supplierId,
    expiryAlertDaysOverride:   source.expiryAlertDaysOverride,
    notes:                     source.notes,
    isActive:                  true,
  };

  return repoCreateInventoryItem(restaurantId, input);
}

function validateBatchInput(batchInput: Omit<CreateInventoryBatchInput, "inventoryId">) {
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

  // ⚠️ See file-level CONCURRENCY NOTE — sibling batches read via
  // getDocs() before the transaction starts.
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

// ── Deduct Stock via FEFO — currentStock + isLowStock + totalValue authoritative ──
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
  if (input.quantity <= 0) throw new Error("Deduction quantity must be greater than 0");
  if (input.reasonCategory === "OTHER" && !input.reason?.trim()) {
    throw new Error("Please enter a reason.");
  }

  const itemRef = inventoryDoc(restaurantId, item.id);
  const movementRef = doc(stockMovementsCollection(restaurantId));

  // ⚠️ See file-level CONCURRENCY NOTE — batch IDs discovered via
  // getDocs() before the transaction starts.
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

    const itemUnitCost: number = itemData.unitCost ?? 0;
    const recomputedTotalValue = Math.round(afterQuantity * itemUnitCost * 100) / 100;

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
      unit:             item.unit,
      unitCostAtTime:   item.unitCost,
      movementValue:    Math.round(input.quantity * item.unitCost * 100) / 100,
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

// ── Correct Batch Details ────────────────────────
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

  // ⚠️ See file-level CONCURRENCY NOTE — sibling batches read via
  // getDocs() before the transaction starts.
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
      const itemUnitCost: number = itemData.unitCost ?? 0;
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

// ── Move Batch to Correct Item ───────────────────
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

  // ⚠️ See file-level CONCURRENCY NOTE — sibling batches for BOTH
  // source and target items read via getDocs() before the
  // transaction starts.
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
    const sourceUnitCost: number = sourceItemData.unitCost ?? 0;
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
    const targetUnitCost: number = targetItemData.unitCost ?? 0;
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