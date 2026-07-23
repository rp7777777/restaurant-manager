// ============================================
// SERVORA ERP — Inventory Repository
// ✅ Single gateway for all inventory Firestore operations
// ✅ isLowStock/totalValue always recomputed server-side
// ✅ Validation — itemName/currentStock/unit required, negative
//    currentStock/unitCost/minStock rejected
// ✅ MIGRATION: quantity → currentStock, category (string) →
//    categoryId (real Category collection reference)
// ✅ Delete guard — an item cannot be deleted while it still has
//    stock (currentStock > 0) or has any stock movement history.
//    Deleting an item with movement history would silently orphan
//    those audit records.
// ✅ ARCHITECTURE BOUNDARY (important — do not blur this):
//    - Manual form edits → sync via THIS file's own
//      syncStoreSummaryForItemChange() calls.
//    - Quantity ADJUSTMENTS from real operations → MUST go through
//      stock-movement-service.ts's recordStockMovement() instead.
// ✅ Defensive try/catch around the summary sync call here too.
// ✅ Reuses InventorySummarySnapshot for the before/after shape.
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
  const isLowStock    = currentStock <= minStock;

  const ref = await addDoc(inventoryCollection(restaurantId), {
    itemName:         input.itemName.trim(),
    categoryId:       input.categoryId,
    currentStock,
    unit:             input.unit,
    unitCost,
    totalValue,
    minStock,
    isLowStock,
    expiryDate:       input.expiryDate ?? null,
    batchNo:          input.batchNo?.trim() || null,
    storageLocation:  input.storageLocation?.trim() || null,
    supplierId:       input.supplierId ?? null,
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
  const newIsLowStock = currentStock <= minStock;

  const updates: Record<string, unknown> = {
    ...(input.itemName        !== undefined && { itemName: input.itemName.trim() }),
    ...(input.categoryId      !== undefined && { categoryId: input.categoryId }),
    ...(input.currentStock    !== undefined && { currentStock: input.currentStock }),
    ...(input.unit             !== undefined && { unit: input.unit }),
    ...(input.unitCost        !== undefined && { unitCost: input.unitCost }),
    ...(input.minStock        !== undefined && { minStock: input.minStock }),
    ...(input.expiryDate      !== undefined && { expiryDate: input.expiryDate || null }),
    ...(input.batchNo         !== undefined && { batchNo: input.batchNo?.trim() || null }),
    ...(input.storageLocation !== undefined && { storageLocation: input.storageLocation?.trim() || null }),
    ...(input.supplierId      !== undefined && { supplierId: input.supplierId || null }),
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