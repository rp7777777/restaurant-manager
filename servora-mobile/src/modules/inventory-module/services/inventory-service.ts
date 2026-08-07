// ============================================
// SERVORA ERP — Inventory Service
// ✅ ARCHITECTURE — this file holds BUSINESS OPERATIONS only, not
//    CRUD wrappers. Plain create/read/update/delete for inventory
//    items, categories, and departments stay in their respective
//    repositories and are called directly from hooks.
// ✅ adjustStock() — thin wrapper around stock-movement-service.ts's
//    recordStockMovement(), for NON-BATCH items only.
// ✅ archiveInventoryItem() / restoreInventoryItem() — toggle the
//    isActive flag.
// ✅ duplicateInventoryItem() — real, common ERP row-action.
// ✅ NEW — receiveBatch() (batch tracking system, Phase 3a):
//    orchestrates FOUR steps for one receiving event:
//    1. inventory-batch-repository.ts's createInventoryBatch() —
//       creates the new batch row (always new, never merged).
//    2. stock-movement-service.ts's recordStockMovement() with
//       movementType "PURCHASE" and the batch's quantity as a
//       DELTA — records the business event (audit trail) with
//       correct semantics: "PURCHASE +8kg (20→28)" reads correctly
//       to an auditor, unlike "ADJUSTMENT 28" which loses the
//       business-event meaning.
//    3. getBatchesForItem() + calculateTotalFromBatches() —
//       recompute the TRUE current stock from all active batches.
//    4. inventory-repository.ts's updateInventoryItem() — writes
//       the recomputed total as currentStock, OVERWRITING whatever
//       recordStockMovement() wrote internally in step 2.
//
//    ⚠️ KNOWN ARCHITECTURAL SEAM (documented, not silently
//    tolerated): recordStockMovement() was designed BEFORE the
//    batch system existed — it internally reads currentStock,
//    computes its own afterQuantity via simple delta arithmetic,
//    and writes that to InventoryItem.currentStock inside its own
//    transaction (step 2 above). Step 4 immediately overwrites that
//    value with the batch-derived recompute. In the normal case
//    these two values AGREE (delta-add and batch-sum produce the
//    same number). They can DISAGREE if currentStock had already
//    drifted from the batch total for some other reason (e.g. a
//    manual batch status change, a future batch merge/split, a data
//    repair) — in that rare case, the StockMovement audit record's
//    afterQuantity field will show the delta-based number, which
//    may not exactly match the final currentStock after step 4's
//    overwrite. This is an accepted, documented tradeoff: keeping
//    InventoryItem.currentStock ALWAYS correct (derived from
//    batches, the core invariant of this system) is prioritized
//    over the audit record's afterQuantity being perfectly
//    self-consistent with it in this edge case.
//    THE PROPER FIX — deferred, not built here: evolve
//    recordStockMovement() to accept optional
//    beforeQuantity/afterQuantity overrides (and a skipInventoryUpdate
//    flag) so batch-aware callers can supply the batch-derived
//    truth directly, and the function's own internal read/delta
//    logic is bypassed entirely rather than computed-then-
//    overwritten. Doing this properly requires editing
//    stock-movement-service.ts, which is currently FROZEN and used
//    by every other movementType (WASTE, KITCHEN_ISSUE, TRANSFER_*,
//    the plain ADJUSTMENT path) — that evolution is Phase 3c, done
//    deliberately and reviewed on its own, not bundled into this
//    file's changes.
// ✅ DEFERRED (future phases, not built here):
//    deductStockFEFO() — the transaction-wrapped, multi-batch FEFO
//      deduction engine (Phase 3b).
//    recordStockMovement() batch-awareness (Phase 3c, see above).
//    bulkImportInventory() / bulkExportInventory() — Phase 7.
//    mergeInventoryItems() / convertUnit() — no current UI need.
//    receivePurchaseOrder() / issueStockToKitchen() — already live
//      in purchase-order-module and kitchen-module; NOT duplicated
//      here.
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
import { RecordStockMovementInput } from "../../stock-movement-module/types/stock-movement";
import { db, auth } from "../../../firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { COL, RCOL } from "../../../constants/firestore-collections";

function inventoryDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
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

// ── Receive Batch (batch tracking system, Phase 3a) ──────────────
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

  // 1. Create the new batch row.
  const batchId = await createInventoryBatch(restaurantId, batchInput);

  // 2. Record the business event (audit trail) — correct semantics:
  //    PURCHASE with a delta, not ADJUSTMENT with an absolute value.
  //    See FROZEN header for the known seam this creates.
  const movementResult = await recordStockMovement(restaurantId, {
    inventoryId:    existingItem.id,
    movementType:   "PURCHASE",
    quantity:       batchInput.quantity,
    referenceType:  "MANUAL",
    reason:         `Received batch ${batchInput.batchNo}`,
  });

  // 3. Recompute the TRUE current stock from all active batches.
  const allBatches = await getBatchesForItem(restaurantId, existingItem.id);
  const newCurrentStock = calculateTotalFromBatches(allBatches);

  // 4. Overwrite currentStock with the batch-derived truth — this is
  //    the authoritative value; step 2's internally-computed value
  //    was necessary for the movement record but is not trusted as
  //    the final inventory state.
  await updateInventoryItem(restaurantId, existingItem.id, existingItem, {
    currentStock: newCurrentStock,
  });

  return {
    batchId,
    newCurrentStock,
    movementId: movementResult.movementId,
  };
}