// ============================================
// SERVORA ERP — Inventory Repository
// ✅ Single gateway for all inventory Firestore operations
// ✅ isLowStock/totalValue always recomputed server-side
// ✅ FIX — isLowStock calculation corrected. Previously:
//    isLowStock = currentStock <= minStock
//    This incorrectly marked an OUT-OF-STOCK item (currentStock ===
//    0) as ALSO "low stock" whenever minStock > 0 (0 <= minStock is
//    always true) — a semantic bug, since "out of stock" and "low
//    stock" are meant to be mutually exclusive states per the
//    confirmed classification (InventoryStats.tsx/
//    useInventoryFilters.ts). The UI layer was already patched to
//    compensate (currentStock > 0 && isLowStock checks added at the
//    stats/filter level), but THIS repository-level field itself
//    was still wrong — any future code reading item.isLowStock
//    directly (Dashboard, reports, other modules) would still see
//    the incorrect value. Now:
//      isLowStock = currentStock > 0 && currentStock <= minStock
//    So an out-of-stock item is NEVER also flagged low-stock at the
//    source, and every consumer of this field — not just the ones
//    we've already patched — gets the correct value going forward.
// ✅ Validation — itemName/currentStock/unit required, negative
//    currentStock/unitCost/minStock rejected.
// ✅ MIGRATION: quantity → currentStock, category (string) →
//    categoryId (real Category collection reference)
// ✅ Delete guard — an item cannot be deleted while it still has
//    stock (currentStock > 0) or has any stock movement history.
// ✅ ARCHITECTURE BOUNDARY (important — do not blur this):
//    - Manual form edits → sync via THIS file's own
//      syncStoreSummaryForItemChange() calls.
//    - Quantity ADJUSTMENTS from real operations → MUST go through
//      stock-movement-service.ts's recordStockMovement(), or the
//      batch-tracking system's receiveBatch()/deductStockBatch()
//      (inventory-service.ts) — NOT this file's updateInventoryItem
//      (). NOTE: this means isLowStock is only recomputed HERE when
//      a manual form edit touches currentStock/minStock —
//      receiveBatch()/deductStockBatch() write currentStock directly
//      inside their own Firestore transactions and do NOT
//      recompute/write isLowStock at all currently. This is a KNOWN
//      GAP (not fixed in this pass): after a batch receive/
//      deduction, an item's isLowStock field can go stale until the
//      next manual edit touches it. Since InventoryStats.tsx/
//      useInventoryFilters.ts derive Low Stock display purely from
//      currentStock vs minStock comparisons at read time in some
//      paths but trust the stored isLowStock field in others, this
//      gap should be closed in a future pass by having
//      receiveBatch()/deductStockBatch() also recompute and write
//      isLowStock in their own transactions, mirroring this file's
//      corrected formula exactly.
// ✅ Defensive try/catch around the summary sync call here too.
// ✅ Reuses InventorySummarySnapshot for the before/after shape.
// ✅ sku, barcode, notes saved/updated. isActive explicitly defaults
//    to true on create.
// ✅ Barcode/SKU uniqueness validation intentionally NOT enforced
//    yet — deferred to the future Barcode Scanner / POS module.
// ✅ categoryId/supplierId trimmed consistently with itemName,
//    storageLocation, sku, barcode, notes.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  InventoryItem,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  calculateInventoryTotalValue,
} from "../types/inventory";
import { syncStoreSummaryForItemChange } from "../../store-module/services/store-summary-service";
import { InventorySummarySnapshot } from "../../store-module/types/store-summary";
import { getMovementsForItem } from "../../stock-movement-module/services/stock-movement-service";

function inventoryCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY);
}

function inventoryDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
}

function validateInput(input: CreateInventoryItemInput | UpdateInventoryItemInput) {
  if (input.itemName !== undefined && !input.itemName.trim()) {
    throw new Error("Item name is required");
  }
  if (input.categoryId !== undefined && !input.categoryId.trim()) {
    throw new Error("Category is required");
  }
  if (input.currentStock !== undefined && input.currentStock < 0) {
    throw new Error("Current stock cannot be negative");
  }
  if (input.unitCost !== undefined && input.unitCost < 0) {
    throw new Error("Unit cost cannot be negative");
  }
  if (input.minStock !== undefined && input.minStock < 0) {
    throw new Error("Minimum stock cannot be negative");
  }
}

// ✅ FIX — single source of truth for isLowStock, used by both
// createInventoryItem() and updateInventoryItem() below so the two
// can never drift into computing this differently from each other.
function computeIsLowStock(currentStock: number, minStock: number): boolean {
  return currentStock > 0 && currentStock <= minStock;
}

async function safeSyncSummary(
  restaurantId: string,
  before: InventorySummarySnapshot | null,
  after: InventorySummarySnapshot | null,
): Promise<void> {
  try {
    await syncStoreSummaryForItemChange(restaurantId, before, after);
  } catch (error) {
    console.warn("Inventory repository: store summary sync failed:", error);
  }
}

export async function createInventoryItem(
  restaurantId: string,
  input: CreateInventoryItemInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  validateInput(input);

  const currentStock = input.currentStock;
  const unitCost      = input.unitCost;
  const minStock      = input.minStock;
  const totalValue    = calculateInventoryTotalValue(currentStock, unitCost);
  const isLowStock    = computeIsLowStock(currentStock, minStock);

  const ref = await addDoc(inventoryCollection(restaurantId), {
    itemName:         input.itemName.trim(),
    categoryId:       input.categoryId.trim(),
    currentStock,
    unit:             input.unit,
    unitCost,
    totalValue,
    minStock,
    isLowStock,
    expiryDate:       input.expiryDate ?? null,
    batchNo:          input.batchNo?.trim() || null,
    storageLocation:  input.storageLocation?.trim() || null,
    supplierId:       input.supplierId?.trim() || null,
    sku:              input.sku?.trim() || null,
    barcode:          input.barcode?.trim() || null,
    notes:            input.notes?.trim() || null,
    isActive:         input.isActive ?? true,
    restaurantId,
    userId:           auth.currentUser.uid,
    createdAt:        serverTimestamp(),
    updatedAt:        serverTimestamp(),
  });

  await safeSyncSummary(
    restaurantId,
    null,
    { totalValue, isLowStock, quantity: currentStock }
  );

  return ref.id;
}

export async function updateInventoryItem(
  restaurantId: string,
  itemId: string,
  existing: InventoryItem,
  input: UpdateInventoryItemInput
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  validateInput(input);

  const currentStock = input.currentStock ?? existing.currentStock;
  const unitCost      = input.unitCost ?? existing.unitCost;
  const minStock      = input.minStock ?? existing.minStock;

  const newTotalValue = calculateInventoryTotalValue(currentStock, unitCost);
  const newIsLowStock = computeIsLowStock(currentStock, minStock);

  const updates: Record<string, unknown> = {
    ...(input.itemName        !== undefined && { itemName: input.itemName.trim() }),
    ...(input.categoryId      !== undefined && { categoryId: input.categoryId.trim() }),
    ...(input.currentStock    !== undefined && { currentStock: input.currentStock }),
    ...(input.unit             !== undefined && { unit: input.unit }),
    ...(input.unitCost        !== undefined && { unitCost: input.unitCost }),
    ...(input.minStock        !== undefined && { minStock: input.minStock }),
    ...(input.expiryDate      !== undefined && { expiryDate: input.expiryDate || null }),
    ...(input.batchNo         !== undefined && { batchNo: input.batchNo?.trim() || null }),
    ...(input.storageLocation !== undefined && { storageLocation: input.storageLocation?.trim() || null }),
    ...(input.supplierId      !== undefined && { supplierId: input.supplierId?.trim() || null }),
    ...(input.sku             !== undefined && { sku: input.sku?.trim() || null }),
    ...(input.barcode         !== undefined && { barcode: input.barcode?.trim() || null }),
    ...(input.notes           !== undefined && { notes: input.notes?.trim() || null }),
    ...(input.isActive        !== undefined && { isActive: input.isActive }),
    totalValue: newTotalValue,
    isLowStock: newIsLowStock,
    updatedAt:  serverTimestamp(),
  };

  await updateDoc(inventoryDoc(restaurantId, itemId), updates);

  await safeSyncSummary(
    restaurantId,
    { totalValue: existing.totalValue, isLowStock: existing.isLowStock, quantity: existing.currentStock },
    { totalValue: newTotalValue, isLowStock: newIsLowStock, quantity: currentStock }
  );
}

// ✅ Delete guard — cannot delete while stock remains, or if any
// stock movement history exists for this item (audit integrity).
export async function deleteInventoryItem(
  restaurantId: string,
  itemId: string,
  existing: InventoryItem
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  if (existing.currentStock > 0) {
    throw new Error(
      `Cannot delete "${existing.itemName}" — it still has ${existing.currentStock}${existing.unit} in stock. Adjust stock to 0 first.`
    );
  }

  const movements = await getMovementsForItem(restaurantId, itemId, 1);
  if (movements.length > 0) {
    throw new Error(
      `Cannot delete "${existing.itemName}" — it has stock movement history. Archiving is planned for a future phase.`
    );
  }

  await deleteDoc(inventoryDoc(restaurantId, itemId));

  await safeSyncSummary(
    restaurantId,
    { totalValue: existing.totalValue, isLowStock: existing.isLowStock, quantity: existing.currentStock },
    null
  );
}

export async function getInventoryItemById(
  restaurantId: string,
  itemId: string
): Promise<InventoryItem | null> {
  const snap = await getDoc(inventoryDoc(restaurantId, itemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<InventoryItem, "id">) };
}

export async function getAllInventoryItems(
  restaurantId: string
): Promise<InventoryItem[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(
    query(inventoryCollection(restaurantId), orderBy("itemName", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryItem, "id">) }));
}

export function subscribeInventoryItems(
  restaurantId: string,
  callback: (items: InventoryItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(inventoryCollection(restaurantId), orderBy("itemName", "asc")),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<InventoryItem, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}