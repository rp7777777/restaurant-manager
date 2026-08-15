// ============================================
// SERVORA ERP — Inventory Service
// ✅ ARCHITECTURE — this file holds BUSINESS OPERATIONS only.
// ✅ adjustStock() — thin wrapper for NON-BATCH items.
// ✅ archiveInventoryItem() / restoreInventoryItem() — toggle
//    isActive.
// ✅ duplicateInventoryItem() — real, common ERP row-action.
// ✅ InventoryItem.currentStock is the AUTHORITATIVE transactional
//    counter (Phase 2 concurrency hardening) — every stock-changing
//    write reads it fresh inside its own transaction, calculates
//    the new value, and writes that back. Batch lists are used ONLY
//    to decide WHICH batches FEFO draws from, never as the source
//    of currentStock itself.
// ✅ FIX — inventoryId cross-check: receiveBatch() and
//    deductStockBatch() both now verify batchInput.inventoryId/
//    input.inventoryId matches the existingItem/item actually
//    passed in, BEFORE doing anything else. Without this, a caller
//    bug that passed a mismatched item/inventoryId pair could write
//    a batch under one item's ID while updating a DIFFERENT item's
//    currentStock and movement history — a serious cross-item data
//    corruption. This is now impossible; the function throws
//    immediately instead.
// ✅ FIX — deductStockBatch() now rejects a deduction that would
//    take currentStock negative, checked BEFORE running FEFO
//    allocation: `if (beforeQuantity < input.quantity) throw`. This
//    is a safety net independent of the FEFO eligible-batch-total
//    check (which could theoretically pass even if currentStock
//    itself were smaller, in a data-drift scenario) — currentStock,
//    once authoritative, must never be allowed to go negative.
// ✅ FIX — correctBatchDetails() now verifies the OLD batchKey
//    actually points at the SAME batchId being corrected, inside
//    the transaction, before deleting it — protects against a rare
//    lock-document integrity conflict silently deleting the wrong
//    lock.
// ✅ FIX — "pending" placeholder removed. validateBatchInput() no
//    longer requires inventoryId at all (it never used it) — the
//    function signature was simplified to not take inventoryId,
//    removing the need for any placeholder value.
// ✅ FIX — createInventoryItemWithInitialBatch()'s initial-quantity
//    check now explicitly rejects NaN/Infinity via Number.isFinite
//    () before treating "falsy or <= 0" as the zero-stock path —
//    previously `!NaN === true` could silently route a NaN quantity
//    into "just create the item with no batch" instead of surfacing
//    a validation error.
// ⚠️ ACCEPTED, DOCUMENTED RESIDUAL LIMITATION — FEFO candidate
//    discovery: deductStockBatch() still discovers batch document
//    IDs via a pre-transaction query (Firestore transactions cannot
//    run arbitrary `where` queries). A batch created by a truly
//    concurrent operation between that query and this transaction's
//    commit is not considered as an FEFO candidate by THIS
//    deduction — it remains fully available for the next one. This
//    can only affect WHICH batch is drawn from in a same-instant
//    race; currentStock itself is protected by the transactional-
//    counter design above and can never become numerically wrong
//    from this. Fully closing this residual gap would require a
//    batch-index/registry document architecture — evaluated and
//    deliberately deferred as unnecessary complexity at current
//    scale.
// ⚠️ DEPLOYMENT NOTE (not code — an operational step): any batch
//    documents that existed BEFORE the batchKeys system was
//    introduced have no corresponding batchKeys lock document. A
//    one-time backfill migration (for each existing batch, write
//    batchKeys/{normalizeBatchKey(inventoryId, batchNo)} pointing
//    at that batch's existing ID) should be run before relying on
//    duplicate-batchNo protection for pre-existing data. This is an
//    operational/deployment task, not something this service file
//    can enforce at runtime.
// ✅ FEFO allocation logic is NOT duplicated — reuses the same pure
//    sortBatchesByFEFO()/isEligibleForFEFO() functions
//    batch-allocation-service.ts uses.
// ✅ createdByName/createdByRole populated via optional ActorInfo.
// ⚠️ KNOWN LIMITATION (documented, accepted): movementValue uses
//    item.unitCost, not a per-batch weighted cost. Deferred.
// ✅ DEFERRED: real calendar-date validation; recordStockMovement()
//    batch-awareness for the non-batch adjustStock() path; per-
//    batch weighted movementValue; audit trail entry for
//    correctBatchDetails() changes; bulkImport/Export;
//    mergeInventoryItems()/convertUnit(); receivePurchaseOrder()/
//    issueStockToKitchen() (already live elsewhere).
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
    result += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | (b1 !== undefined ? (b1 >> 4) : 0)];
    if (b1 !== undefined) {
      result += BASE64URL_ALPHABET[((b1 & 0x0F) << 2) | (b2 !== undefined ? (b2 >> 6) : 0)];
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

// ── FIX — no longer takes inventoryId (never used it). ──
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

// ── Receive Batch — currentStock is the authoritative counter ──
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
  // ✅ FIX — inventoryId cross-check, before anything else.
  if (batchInput.inventoryId !== existingItem.id) {
    throw new Error("Batch inventory item does not match the selected inventory item");
  }
  validateBatchInput(batchInput);

  const batchKey = normalizeBatchKey(batchInput.inventoryId, batchInput.batchNo);
  const batchKeyRef = batchKeyDoc(restaurantId, batchKey);
  const newBatchRef = doc(batchesCollection(restaurantId));
  const movementRef = doc(stockMovementsCollection(restaurantId));
  const itemRef = inventoryDoc(restaurantId, existingItem.id);

  const result = await runTransaction(db, async (transaction) => {
    const batchKeySnap = await transaction.get(batchKeyRef);
    if (batchKeySnap.exists()) {
      throw new Error(`Batch number "${batchInput.batchNo.trim()}" already exists for this item`);
    }

    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error("Inventory item not found");

    const beforeQuantity: number = itemSnap.data().currentStock ?? 0;
    const afterQuantity = beforeQuantity + batchInput.quantity;

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
      itemName:         batchInput.itemName.trim(),
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
      itemName:         existingItem.itemName,
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

// ── Deduct Stock via FEFO ──
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
  // ✅ FIX — inventoryId cross-check.
  if (input.inventoryId !== item.id) {
    throw new Error("Deduction inventory item does not match the selected inventory item");
  }
  if (input.quantity <= 0) throw new Error("Deduction quantity must be greater than 0");
  if (input.reasonCategory === "OTHER" && !input.reason?.trim()) {
    throw new Error("Please enter a reason.");
  }

  const itemRef = inventoryDoc(restaurantId, item.id);
  const movementRef = doc(stockMovementsCollection(restaurantId));

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

    const beforeQuantity: number = itemData.currentStock ?? 0;

    // ✅ FIX — negative-stock guard, independent of the FEFO
    // eligible-total check below.
    if (beforeQuantity < input.quantity) {
      throw new Error(`Cannot deduct ${input.quantity} — only ${beforeQuantity} stock available`);
    }

    const batchRefs = batchIds.map((id) => batchDoc(restaurantId, id));
    const batchSnaps = await Promise.all(batchRefs.map((ref) => transaction.get(ref)));
    const allBatches: InventoryBatch[] = batchSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...(s.data() as Omit<InventoryBatch, "id">) }));

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

    const afterQuantity = beforeQuantity - input.quantity;

    transaction.update(itemRef, {
      currentStock: afterQuantity,
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
      itemName:         item.itemName,
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

  // ✅ FIX — explicit NaN/Infinity rejection before the "falsy or
  // <= 0" zero-stock branch.
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

  // ✅ FIX — no more "pending" placeholder; validateBatchInput()
  // doesn't take inventoryId at all now.
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

    transaction.set(itemRef, {
      itemName:                 input.itemInput.itemName,
      categoryId:                input.itemInput.categoryId,
      currentStock:              requestedQuantity,
      unit:                      input.itemInput.unit,
      unitCost:                  input.itemInput.unitCost,
      minStock:                  input.itemInput.minStock,
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
  _existingItem: InventoryItem,
  input: CorrectBatchDetailsInput
): Promise<CorrectBatchDetailsResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

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

  const result = await runTransaction(db, async (transaction) => {
    const batchSnap = await transaction.get(targetBatchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const batchData = batchSnap.data();
    const currentBatchNo: string = batchData.batchNo;
    const oldQuantity: number = batchData.quantity;

    let itemSnap = null;
    if (input.quantity !== undefined && input.quantity !== oldQuantity) {
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
      // ✅ FIX — verify the old lock actually belongs to THIS batch
      // before deleting it, protecting against a rare integrity
      // conflict silently deleting the wrong lock document.
      const oldKeySnap = await transaction.get(oldKeyRef);
      if (oldKeySnap.exists() && oldKeySnap.data().batchId !== input.batchId) {
        throw new Error("Batch key integrity conflict — please retry");
      }
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

    let newCurrentStock: number | null = null;
    if (itemSnap && input.quantity !== undefined) {
      const delta = input.quantity - oldQuantity;
      const currentItemStock: number = itemSnap.data().currentStock ?? 0;
      newCurrentStock = currentItemStock + delta;
      transaction.update(itemRef, {
        currentStock: newCurrentStock,
        updatedAt:    serverTimestamp(),
      });
    }

    return { newCurrentStock };
  });

  return { newCurrentStock: result.newCurrentStock };
}