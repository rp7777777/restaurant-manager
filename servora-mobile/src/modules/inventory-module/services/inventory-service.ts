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
// ✅ deductStockBatch() (Phase 3c) — orchestrates the FEFO deduction
//    engine + the matching StockMovement audit record.
// ⚠️ KNOWN LIMITATION (documented, accepted): movementValue in
//    writeMovementRecord() uses item.unitCost, not a per-batch
//    weighted cost. Deferred to a future accounting/valuation phase.
// ✅ NEW — createInventoryItemWithInitialBatch(): bridges "Add Item"
//    to the batch tracking system. Previously, Add Item set
//    currentStock/batchNo/expiryDate directly on the InventoryItem
//    document but never created a real InventoryBatch — so a newly
//    added item with, say, 168 units showed up as "No batches yet"
//    / 0 in the batch-tracked table view, since that view reads
//    ONLY from the InventoryBatch collection. This function makes
//    Add Item create a REAL first batch (via receiveBatch(), the
//    exact same path Receive Batch itself uses) whenever the user
//    enters an initial quantity > 0.
//    - The item is always created with currentStock: 0 first;
//      receiveBatch() is what sets the real currentStock, computed
//      from the batch it creates — avoids double-counting the
//      user's entered quantity.
//    - If no initial quantity is given (or it's 0), no batch is
//      created — matches "just registering the item, stock arrives
//      later" (identical to what Receive Batch would leave behind
//      if invoked with nothing yet received).
//    - batchNo auto-generates if omitted (Batch Number stays
//      OPTIONAL on the Add Item form, per confirmed design):
//      "{ITEM-INITIALS}-INIT-{timestamp}".
//    - receivedDate defaults to today if omitted (the Add Item
//      form's "Received Date" field is optional); purchaseDate
//      mirrors receivedDate — Add Item has no separate "purchase
//      date" concept the way the dedicated Receive Batch form does.
//    - unitCost for the initial batch comes from the item's own
//      unitCost, consistent with ReceiveBatchModal's own pre-fill
//      behavior for subsequent batches.
// ✅ DEFERRED (future phases, not built here):
//    recordStockMovement() batch-awareness upgrade — Phase 3d.
//    Per-batch weighted movementValue accuracy.
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
} from "../repository/inventory-batch-repository";
import { CreateInventoryBatchInput, calculateTotalFromBatches } from "../types/inventory-batch";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import {
  RecordStockMovementInput,
  StockMovementReasonCategory,
  StockMovementReferenceType,
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

  const movementResult = await recordStockMovement(restaurantId, {
    inventoryId:    existingItem.id,
    movementType:   "PURCHASE",
    quantity:       batchInput.quantity,
    referenceType:  "MANUAL",
    reason:         `Received batch ${batchInput.batchNo}`,
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