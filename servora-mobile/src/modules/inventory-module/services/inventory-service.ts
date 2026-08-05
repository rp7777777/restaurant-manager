// ============================================
// SERVORA ERP — Inventory Service
// ✅ ARCHITECTURE — this file holds BUSINESS OPERATIONS only, not
//    CRUD wrappers. Plain create/read/update/delete for inventory
//    items, categories, and departments stay in their respective
//    repositories and are called directly from hooks — wrapping
//    every repository function here would be a pure pass-through
//    layer (over-engineering) with zero added value.
// ✅ This file exists for operations that involve business rules,
//    orchestration across repositories, or delegation to another
//    module's service (e.g. stock-movement-service.ts).
// ✅ adjustStock() — thin wrapper around stock-movement-service.ts's
//    recordStockMovement(). Does NOT duplicate any movement logic;
//    recordStockMovement() remains the single source of truth for
//    all currentStock changes (transaction-safe, writes the audit
//    record, syncs store summary). This function exists only so
//    UI/hooks call inventory-service (business layer) rather than
//    reaching into a different module's service directly.
// ✅ archiveInventoryItem() / restoreInventoryItem() — toggle the
//    isActive flag (added in Phase 1/2). This is a business
//    operation, not a plain field update: archiving is meant for
//    items an owner wants to retire from active use WITHOUT losing
//    stock/movement history (the delete guard in
//    inventory-repository.ts already blocks hard-deleting items
//    with stock or movement history — archiving is the intended
//    alternative for that exact case).
// ✅ duplicateInventoryItem() — real, common ERP row-action ("Save
//    as new item"). Copies static fields, resets movement-derived
//    fields (currentStock starts at 0, so the new item enters
//    stock the same way every other new item does — via
//    recordStockMovement(), never a raw copy of quantity).
//    - duplicatedName is passed IN by the caller (hook), not built
//      here — this service layer stays language-agnostic; the
//      "(Copy)" / translated suffix belongs in the UI layer where
//      t() is available, not hardcoded English in a service file.
//    - expiryAlertDaysOverride IS copied — it's a standing
//      item-level configuration, not batch data.
//    - sku/barcode are deliberately NOT copied (left blank on the
//      duplicate) — both are typically meant to be unique per item;
//      copying them would hand the new item a colliding identifier
//      before the owner has assigned it a real one.
//    - expiryDate/batchNo remain NOT copied — batch-specific data,
//      not part of the item definition being cloned.
// ✅ DEFERRED (future phases, not built here):
//    bulkImportInventory() / bulkExportInventory() — belongs with
//      the Print/PDF/Excel phase (Phase 7), not this phase.
//    mergeInventoryItems() / convertUnit() — no current UI need;
//      would be premature abstraction today.
//    receivePurchaseOrder() / issueStockToKitchen() — these already
//      live in purchase-order-module and kitchen-module
//      respectively. They are NOT duplicated here — both already
//      call recordStockMovement() directly, which is the correct
//      single entry point regardless of which module initiates it.
// FROZEN
// ============================================

import { createInventoryItem as repoCreateInventoryItem } from "../repository/inventory-repository";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import { RecordStockMovementInput } from "../../stock-movement-module/types/stock-movement";
import { db, auth } from "../../../firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { COL, RCOL } from "../../../constants/firestore-collections";

function inventoryDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
}

// ── Stock Adjustment ─────────────────────────────
// Thin delegation to stock-movement-service.ts. See FROZEN header —
// this function must never grow its own quantity-mutation logic.
export async function adjustStock(
  restaurantId: string,
  input: RecordStockMovementInput
): Promise<{ movementId: string; beforeQuantity: number; afterQuantity: number; movementValue: number }> {
  return recordStockMovement(restaurantId, input);
}

// ── Archive ──────────────────────────────────────
// Sets isActive: false. Does NOT touch currentStock, totalValue, or
// movement history — this is purely a visibility/lifecycle flag.
// Intended as the alternative to delete for items the inventory
// repository's delete guard already blocks (stock > 0 or movement
// history exists).
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
// Sets isActive: true — reverses archiveInventoryItem().
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
// Copies an existing item's static fields into a brand-new item.
// currentStock always starts at 0 — the new item must enter stock
// the same way every other item does: through recordStockMovement()
// (e.g. a PURCHASE or ADJUSTMENT), never by copying the source
// item's quantity. This mirrors the same double-count-prevention
// rule already enforced when Purchase Orders create new items.
//
// duplicatedName is supplied by the caller (hook) — this service
// stays language-agnostic and never hardcodes UI text like "(Copy)".
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
    // sku/barcode intentionally left undefined — see FROZEN header.
    // expiryDate/batchNo intentionally NOT copied — batch-specific
    // data, not part of the item definition being cloned.
  };

  return repoCreateInventoryItem(restaurantId, input);
}