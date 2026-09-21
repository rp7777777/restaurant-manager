// ============================================
// SERVORA ERP — Inventory Item Service
// ✅ EXTRACTED from inventory-service.ts — pure structural refactor,
//    byte-for-byte identical logic, just relocated.
// ✅ adjustStock() — thin delegate to stock-movement-service.ts's
//    recordStockMovement() (the ORIGINAL non-batch path). Untouched.
//    ⚠️ KNOWN ARCHITECTURE RISK (documented, not fixed here) — for a
//    batch-tracked item, recordStockMovement() changes currentStock
//    WITHOUT touching batch documents, which can desynchronize
//    currentStock from the actual batch sum. A guard to reject
//    Increase/Decrease/Correction on batch-tracked items is PENDING
//    (blocked on migrating Purchase Order's PURCHASE calls off this
//    same function first — see inventory-service.ts's file header).
// ✅ archiveInventoryItem()/restoreInventoryItem() — toggle isActive.
//    Deliberately do NOT touch currentStock/batches — archiving an
//    ITEM is purely a visibility/lifecycle flag, not a stock
//    operation. A stock>0 + isActive=false item is a VALID state
//    (the user consciously archived it) — NOT automatically treated
//    as corruption.
// ✅ archivedAt (serverTimestamp()) is recorded on archive, and
//    explicitly cleared (null) on restore. restoredAt records the
//    LAST restore timestamp — see FROZEN header of the type file.
// ✅ duplicateInventoryItem() — creates a new item with currentStock
//    always 0.
// ✅ NEW — syncItemStockFromBatches(): recomputes InventoryItem.
//    currentStock from its batches' actual sum (via
//    calculateTotalFromBatches(), which now EXCLUDES batch-level-
//    archived batches — see inventory-batch.ts's own FROZEN header)
//    and writes it back. This is the "keeping currentStock in sync"
//    responsibility that inventory-batch-repository.ts's own header
//    explicitly delegates to THIS file (repository boundary: batch
//    repository never touches InventoryItem itself). Called by the
//    UI layer immediately after a BATCH-level archive/restore
//    (ArchivedItemsModal.tsx, InventoryBatchTable.tsx's caller) —
//    NOT wired into archiveInventoryBatch()/restoreInventoryBatch()
//    themselves, preserving the repository's single-responsibility
//    boundary. Safe to call even if nothing changed (idempotent —
//    just overwrites currentStock with the same recomputed value).
// FROZEN
// ============================================

import { updateDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "../../../firebase";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import { calculateTotalFromBatches } from "../types/inventory-batch";
import { RecordStockMovementInput } from "../../stock-movement-module/types/stock-movement";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import { createInventoryItem as repoCreateInventoryItem } from "../repository/inventory-repository";
import { getBatchesForItem } from "../repository/inventory-batch-repository";
import { inventoryDoc } from "./inventory-service-helpers";

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
  if (!itemId) throw new Error("Inventory item is required");

  await updateDoc(inventoryDoc(restaurantId, itemId), {
    isActive:   false,
    archivedAt: serverTimestamp(),
    updatedAt:  serverTimestamp(),
    updatedBy:  auth.currentUser.uid,
  });
}

// ── Restore ──────────────────────────────────────
export async function restoreInventoryItem(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!itemId) throw new Error("Inventory item is required");

  await updateDoc(inventoryDoc(restaurantId, itemId), {
    isActive:   true,
    archivedAt: null,
    restoredAt: serverTimestamp(),
    updatedAt:  serverTimestamp(),
    updatedBy:  auth.currentUser.uid,
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

// ── Sync currentStock from batches (see FROZEN header) ──
export async function syncItemStockFromBatches(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!itemId) throw new Error("Inventory item is required");

  const batches = await getBatchesForItem(restaurantId, itemId);
  const recomputedStock = calculateTotalFromBatches(batches);

  await updateDoc(inventoryDoc(restaurantId, itemId), {
    currentStock: recomputedStock,
    updatedAt:    serverTimestamp(),
    updatedBy:    auth.currentUser.uid,
  });
}