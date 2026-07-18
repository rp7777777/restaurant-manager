// ============================================
// SERVORA ERP — Inventory Repository
// ✅ Single gateway for all inventory Firestore operations
// ✅ isLowStock/totalValue always recomputed server-side
// ✅ Validation — itemName/quantity/unit required, negative
//    quantity/unitCost/minStock rejected
// ✅ NOTE: quantity here is a full REPLACE (manual add/edit form),
//    not an increment. Concurrent quantity ADJUSTMENTS will be
//    handled by a separate, transaction-safe function in the
//    Stock Movements phase.
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
} from "../types/inventory";

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
  if (input.quantity !== undefined && input.quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  if (input.unitCost !== undefined && input.unitCost < 0) {
    throw new Error("Unit cost cannot be negative");
  }
  if (input.minStock !== undefined && input.minStock < 0) {
    throw new Error("Minimum stock cannot be negative");
  }
}

export async function createInventoryItem(
  restaurantId: string,
  input: CreateInventoryItemInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  validateInput(input);

  const quantity   = input.quantity;
  const unitCost   = input.unitCost;
  const minStock   = input.minStock;
  const totalValue = quantity * unitCost;
  const isLowStock = quantity <= minStock;

  const ref = await addDoc(inventoryCollection(restaurantId), {
    itemName:         input.itemName.trim(),
    category:         input.category,
    quantity,
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

  const quantity = input.quantity ?? existing.quantity;
  const unitCost = input.unitCost ?? existing.unitCost;
  const minStock = input.minStock ?? existing.minStock;

  const updates: Record<string, unknown> = {
    ...(input.itemName        !== undefined && { itemName: input.itemName.trim() }),
    ...(input.category        !== undefined && { category: input.category }),
    ...(input.quantity        !== undefined && { quantity: input.quantity }),
    ...(input.unit             !== undefined && { unit: input.unit }),
    ...(input.unitCost        !== undefined && { unitCost: input.unitCost }),
    ...(input.minStock        !== undefined && { minStock: input.minStock }),
    ...(input.expiryDate      !== undefined && { expiryDate: input.expiryDate || null }),
    ...(input.batchNo         !== undefined && { batchNo: input.batchNo?.trim() || null }),
    ...(input.storageLocation !== undefined && { storageLocation: input.storageLocation?.trim() || null }),
    ...(input.supplierId      !== undefined && { supplierId: input.supplierId || null }),
    totalValue: quantity * unitCost,
    isLowStock: quantity <= minStock,
    updatedAt:  serverTimestamp(),
  };

  await updateDoc(inventoryDoc(restaurantId, itemId), updates);
}

export async function deleteInventoryItem(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  await deleteDoc(inventoryDoc(restaurantId, itemId));
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