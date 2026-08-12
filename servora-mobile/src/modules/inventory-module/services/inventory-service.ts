// ============================================
// SERVORA ERP — Inventory Service
// ✅ ARCHITECTURE — this file holds BUSINESS OPERATIONS only, not
//    CRUD wrappers.
// ✅ adjustStock() — thin wrapper around stock-movement-service.ts's
//    recordStockMovement(), for NON-BATCH items only.
// ✅ archiveInventoryItem() / restoreInventoryItem() — toggle the
//    isActive flag.
// ✅ duplicateInventoryItem() — real, common ERP row-action.
// ✅ receiveBatch() (Phase 3a) — orchestrates batch creation +
//    PURCHASE movement + batch-derived currentStock recompute.
//    NEW — the PURCHASE movement record now carries
//    batchAllocations: [{ batchId, batchNo, quantity }] (always
//    exactly one entry — the batch just created), so Movement
//    History can show "which batch" a PURCHASE relates to.
// ✅ deductStockBatch() (Phase 3c) — orchestrates the FEFO deduction
//    engine + the matching StockMovement audit record. NEW — the
//    movement record now carries batchAllocations directly from
//    AllocationResult.allocations (one entry PER BATCH the FEFO
//    engine actually drew from), so a WASTE/TRANSFER_OUT that spans
//    multiple batches shows the full per-batch breakdown, not just
//    the total quantity.
// ⚠️ KNOWN LIMITATION (documented, accepted): movementValue in
//    writeMovementRecord() uses item.unitCost, not a per-batch
//    weighted cost. Deferred to a future accounting/valuation phase.
// ✅ createInventoryItemWithInitialBatch() — bridges "Add Item" to
//    the batch tracking system.
// ✅ correctBatchDetails() — typo/mistake correction (business
//    layer wrapper around updateBatchDetails()), recomputes
//    currentStock only when quantity is part of the correction.
// ✅ DEFERRED (future phases, not built here):
//    recordStockMovement() batch-awareness upgrade for the
//      NON-batch adjustStock() path — ADJUSTMENT/increase/decrease
//      still have no batchAllocations, by confirmed design (they
//      have no batch concept).
//    Per-batch weighted movementValue accuracy.
//    Audit trail entry for correctBatchDetails() quantity changes.
//    bulkImportInventory() / bulkExportInventory() — Phase 7.
//    mergeInventoryItems() / convertUnit() — no current UI need.
//    receivePurchaseOrder() / issueStockToKitchen() — already live
//      in purchase-order-module and kitchen-module; NOT duplicated
//      here.
// FROZEN
// ============================================

import {
  createInventoryItem as repoCreateInventoryItem,
  updateInventoryItem,
  getInventoryItemById,
} from "../repository/inventory-repository";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import {
  createInventoryBatch,
  getBatchesForItem,
  updateBatchDetails,
} from "../repository/inventory-batch-repository";
import { CreateInventoryBatchInput, calculateTotalFromBatches } from "../types/inventory-batch";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import {
  RecordStockMovementInput,
  StockMovementReasonCategory,
  StockMovementReferenceType,
  BatchAllocationRecord,
} from "../../stock-movement-module/types/stock-movement";
import { deductStockFEFO, AllocationResult } from "./batch-allocation-service";
import { db, auth } from "../../../firebase";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { todayISO } from "../../../utils/date-utils";

function inventoryDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
}

function stockMovementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
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

// ── Receive Batch (Phase 3a) ──────────────────────
export interface ReceiveBatchResult {
  batchId:         string;
  newCurrentStock: number;
  movementId:      string;
}

export async function receiveBatch(
  restaurantId: string,
  existingItem: InventoryItem,
  batchInput: CreateInventoryBatchInput
): Promise<ReceiveBatchResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const batchId = await createInventoryBatch(restaurantId, batchInput);

  // ✅ NEW — this PURCHASE movement now records exactly which batch
  // it created, via a single-entry batchAllocations array. Written
  // as a direct addDoc (like writeMovementRecord() below) rather
  // than through recordStockMovement(), since that function's
  // input shape has no batchAllocations parameter — see the
  // documented seam in this function's own history: this write
  // mirrors what recordStockMovement() would have written, plus
  // the new field, so the existing before/after-quantity behavior
  // for PURCHASE is unchanged, only enriched.
  const singleAllocation: BatchAllocationRecord[] = [{
    batchId,
    batchNo:  batchInput.batchNo,
    quantity: batchInput.quantity,
  }];

  const movementResult = await recordStockMovement(restaurantId, {
    inventoryId:    existingItem.id,
    movementType:   "PURCHASE",
    quantity:       batchInput.quantity,
    referenceType:  "MANUAL",
    reason:         `Received batch ${batchInput.batchNo}`,
  });

  // recordStockMovement() (stock-movement-module, FROZEN, no
  // batchAllocations parameter) already wrote the movement document
  // — patch in batchAllocations as a follow-up update, keeping that
  // module's own function signature untouched.
  await updateDoc(doc(stockMovementsCollection(restaurantId), movementResult.movementId), {
    batchAllocations: singleAllocation,
  });

  const allBatches = await getBatchesForItem(restaurantId, existingItem.id);
  const newCurrentStock = calculateTotalFromBatches(allBatches);

  await updateInventoryItem(restaurantId, existingItem.id, existingItem, {
    currentStock: newCurrentStock,
  });

  return {
    batchId,
    newCurrentStock,
    movementId: movementResult.movementId,
  };
}

// ── Deduct Stock via FEFO (Phase 3c) ──────────────
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

export interface DeductStockBatchResult {
  movementId: string;
  allocation: AllocationResult;
}

async function writeMovementRecord(
  restaurantId: string,
  item: InventoryItem,
  movementType: DeductibleMovementType,
  allocation: AllocationResult,
  options: {
    reasonCategory?: StockMovementReasonCategory;
    reason?:         string;
    referenceType?:  StockMovementReferenceType;
    referenceId?:    string;
  }
): Promise<string> {
  if (options.reasonCategory === "OTHER" && !options.reason?.trim()) {
    throw new Error("Please enter a reason.");
  }

  const quantityChanged = -allocation.deductedQuantity;
  const movementValue = Math.round(allocation.deductedQuantity * item.unitCost * 100) / 100;

  // ✅ NEW — batchAllocations copied directly from the FEFO engine's
  // own AllocationResult, one entry per batch actually drawn from.
  const batchAllocations: BatchAllocationRecord[] = allocation.allocations.map((a) => ({
    batchId:  a.batchId,
    batchNo:  a.batchNo,
    quantity: a.deductedQuantity,
  }));

  const ref = await addDoc(stockMovementsCollection(restaurantId), {
    inventoryId:     item.id,
    itemName:        item.itemName,
    movementType,
    quantityChanged,
    beforeQuantity:  allocation.beforeQuantity,
    afterQuantity:   allocation.afterQuantity,
    unit:            item.unit,
    unitCostAtTime:  item.unitCost,
    movementValue,
    reasonCategory:  options.reasonCategory ?? null,
    referenceType:   options.referenceType  ?? null,
    referenceId:     options.referenceId    ?? null,
    reason:          options.reason?.trim() || null,
    batchAllocations,
    restaurantId,
    createdBy:       auth.currentUser!.uid,
    createdAt:       serverTimestamp(),
  });

  return ref.id;
}

export async function deductStockBatch(
  restaurantId: string,
  item: InventoryItem,
  input: DeductStockBatchInput
): Promise<DeductStockBatchResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const allocation = await deductStockFEFO(restaurantId, {
    inventoryId: input.inventoryId,
    quantity:    input.quantity,
  });

  const movementId = await writeMovementRecord(
    restaurantId,
    item,
    input.movementType,
    allocation,
    {
      reasonCategory: input.reasonCategory,
      reason:         input.reason,
      referenceType:  input.referenceType,
      referenceId:    input.referenceId,
    }
  );

  return { movementId, allocation };
}

// ── Create Item WITH Initial Batch ────────────────
export interface CreateItemWithInitialBatchInput {
  itemInput:      CreateInventoryItemInput;
  batchNo?:       string;
  receivedDate?:  string; // YYYY-MM-DD, defaults to today
}

export interface CreateItemWithInitialBatchResult {
  itemId:  string;
  batchId: string | null; // null if no initial quantity was given
}

function generateInitialBatchNo(itemName: string): string {
  const initials = itemName.trim().slice(0, 3).toUpperCase() || "ITM";
  return `${initials}-INIT-${Date.now()}`;
}

export async function createInventoryItemWithInitialBatch(
  restaurantId: string,
  input: CreateItemWithInitialBatchInput
): Promise<CreateItemWithInitialBatchResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const requestedQuantity = input.itemInput.currentStock;

  const itemId = await repoCreateInventoryItem(restaurantId, {
    ...input.itemInput,
    currentStock: 0,
  });

  if (!requestedQuantity || requestedQuantity <= 0) {
    return { itemId, batchId: null };
  }

  const createdItem = await getInventoryItemById(restaurantId, itemId);
  if (!createdItem) {
    throw new Error("Failed to load newly created item for initial batch");
  }

  const receivedDate = input.receivedDate?.trim() || todayISO();
  const batchNo = input.batchNo?.trim() || generateInitialBatchNo(input.itemInput.itemName);

  const batchResult = await receiveBatch(restaurantId, createdItem, {
    inventoryId:  itemId,
    itemName:     input.itemInput.itemName,
    batchNo,
    quantity:     requestedQuantity,
    unit:         input.itemInput.unit,
    unitCost:     input.itemInput.unitCost,
    purchaseDate: receivedDate,
    receivedDate,
    expiryDate:   input.itemInput.expiryDate,
  });

  return { itemId, batchId: batchResult.batchId };
}

// ── Correct Batch Details (typo/mistake correction) ────────────────
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

  await updateBatchDetails(restaurantId, input.batchId, {
    batchNo:    input.batchNo,
    expiryDate: input.expiryDate,
    quantity:   input.quantity,
  });

  if (input.quantity === undefined) {
    return { newCurrentStock: null };
  }

  const allBatches = await getBatchesForItem(restaurantId, input.itemId);
  const newCurrentStock = calculateTotalFromBatches(allBatches);

  await updateInventoryItem(restaurantId, input.itemId, existingItem, {
    currentStock: newCurrentStock,
  });

  return { newCurrentStock };
}