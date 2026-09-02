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
// ✅ archiveInventoryItem()/restoreInventoryItem() — toggle isActive
//    only. Deliberately do NOT touch currentStock/batches — archiving
//    an item is purely a visibility/lifecycle flag, not a stock
//    operation. A stock>0 + isActive=false item is a VALID state
//    (the user consciously archived it) — NOT automatically treated
//    as corruption.
// ✅ duplicateInventoryItem() — creates a new item with currentStock
//    always 0 (never copies the source's stock or its batches — a
//    duplicated item starts genuinely empty, matching the confirmed
//    "new items start at 0, stock only enters via a real
//    receive/movement" principle). itemName validation (non-empty
//    after trim) is enforced by inventory-repository.ts's own
//    createInventoryItem() — not duplicated here.
// FROZEN
// ============================================

import { updateDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "../../../firebase";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import { RecordStockMovementInput } from "../../stock-movement-module/types/stock-movement";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import { createInventoryItem as repoCreateInventoryItem } from "../repository/inventory-repository";
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
    isActive:  false,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
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
    isActive:  true,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
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