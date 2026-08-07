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
//    engine (batch-allocation-service.ts's deductStockFEFO()) + the
//    matching StockMovement audit record. NO ARCHITECTURAL SEAM
//    here (unlike receiveBatch()) — calls deductStockFEFO() FIRST
//    (the single source of truth for currentStock, computed inside
//    its own transaction), THEN records the StockMovement using the
//    AllocationResult's beforeQuantity/afterQuantity DIRECTLY via
//    writeMovementRecord() — a local helper that writes a
//    StockMovement document with addDoc(), deliberately NOT a call
//    to recordStockMovement() (which would re-read currentStock and
//    could disagree with the FEFO-computed truth).
// ✅ It CANNOT be called with movementType "PURCHASE"/"RETURN"/
//    "TRANSFER_IN"/"ADJUSTMENT" — enforced via the
//    DeductibleMovementType restriction, a TypeScript-level guard.
// ⚠️ KNOWN LIMITATION (documented, accepted for this phase):
//    writeMovementRecord()'s movementValue is currently computed as
//    `deductedQuantity × item.unitCost` — i.e. the ITEM's current
//    unitCost, NOT a weighted cost across the specific batches FEFO
//    actually drew from. Since each batch can have its OWN unitCost,
//    a deduction that spans multiple batches with different costs
//    will report a movementValue/unitCostAtTime that doesn't exactly
//    match a true weighted-average across the batches drawn from.
//    This does NOT affect inventory quantity accuracy — it only
//    affects the VALUATION figure on this movement record, an
//    accounting-precision concern. THE PROPER FIX — deferred: return
//    each batch's own unitCost per allocation line and compute a
//    true weighted movementValue/effectiveUnitCostAtTime from that.
//    Planned for a future accounting/valuation phase.
// ✅ DEFERRED (future phases, not built here):
//    recordStockMovement() batch-awareness upgrade — Phase 3d.
//    Per-batch weighted movementValue accuracy (see limitation).
//    bulkImportInventory() / bulkExportInventory() — Phase 7.
//    mergeInventoryItems() / convertUnit() — no current UI need.
//    receivePurchaseOrder() / issueStockToKitchen() — already live
//      in purchase-order-module and kitchen-module; NOT duplicated
//      here. FUTURE INTEGRATION NOTE: once those modules' flows are
//      ready to adopt batch tracking, they should call
//      receiveBatch()/deductStockBatch() — NOT recordStockMovement()
//      directly and NOT a raw currentStock-- — so every stock change
//      goes through FEFO and stays batch-consistent.
// FROZEN
// ============================================

import { createInventoryItem as repoCreateInventoryItem, updateInventoryItem } from "../repository/inventory-repository";
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