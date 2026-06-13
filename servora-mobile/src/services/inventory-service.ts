// ============================================
// SERVORA ERP — Inventory Service
// Multi-tenant + Stock management
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, where,
  serverTimestamp, increment,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { logCreate, logEdit, logDelete } from "../security/audit-service";

// ── Types ────────────────────────────────────
export interface InventoryItem {
  id?: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalValue: number;
  minStock: number;
  isLowStock: boolean;
  restaurantId?: string;
  userId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── Helpers ──────────────────────────────────
function getRestaurantId(): string {
  return auth.currentUser?.uid ?? "";
}

function inventoryCollection(restaurantId: string) {
  return collection(db, "restaurants", restaurantId, "inventory");
}

// ── Create ───────────────────────────────────
export async function createInventoryItem(
  item: Omit<InventoryItem, "id" | "totalValue" | "isLowStock" | "createdAt" | "updatedAt">
): Promise<string> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  const totalValue = item.quantity * item.unitCost;
  const isLowStock = item.quantity <= item.minStock;

  const data = {
    ...item,
    totalValue,
    isLowStock,
    restaurantId,
    userId: auth.currentUser!.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(inventoryCollection(restaurantId), data);

  await logCreate("INVENTORY", docRef.id, {
    itemName: item.itemName,
    quantity: item.quantity,
    totalValue,
  });

  return docRef.id;
}

// ── Update quantity (store issue) ───────────
export async function issueStock(
  itemId: string,
  issuedQty: number,
  itemData: InventoryItem
): Promise<void> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  const newQty = itemData.quantity - issuedQty;
  if (newQty < 0) throw new Error("Insufficient stock");

  const newTotalValue = newQty * itemData.unitCost;
  const isLowStock = newQty <= itemData.minStock;

  await updateDoc(
    doc(db, "restaurants", restaurantId, "inventory", itemId),
    {
      quantity: increment(-issuedQty),
      totalValue: newTotalValue,
      isLowStock,
      updatedAt: serverTimestamp(),
    }
  );

  await logEdit("INVENTORY", itemId, itemData as unknown as unknown as Record<string, unknown>, {
    action: "ISSUE",
    issuedQty,
    remainingQty: newQty,
  });
}

// ── Update item ──────────────────────────────
export async function updateInventoryItem(
  itemId: string,
  oldItem: InventoryItem,
  updates: Partial<InventoryItem>
): Promise<void> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  const qty = updates.quantity ?? oldItem.quantity;
  const cost = updates.unitCost ?? oldItem.unitCost;
  const min = updates.minStock ?? oldItem.minStock;

  const finalUpdates = {
    ...updates,
    totalValue: qty * cost,
    isLowStock: qty <= min,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(
    doc(db, "restaurants", restaurantId, "inventory", itemId),
    finalUpdates
  );

  await logEdit("INVENTORY", itemId, oldItem as unknown as Record<string, unknown>, finalUpdates as unknown as unknown as Record<string, unknown>);
}

// ── Delete ───────────────────────────────────
export async function deleteInventoryItem(
  itemId: string,
  itemData: InventoryItem
): Promise<void> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  await deleteDoc(doc(db, "restaurants", restaurantId, "inventory", itemId));
  await logDelete("INVENTORY", itemId, itemData as unknown as unknown as Record<string, unknown>);
}

// ── Real-time listener ───────────────────────
export function subscribeInventory(
  restaurantId: string,
  callback: (items: InventoryItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    inventoryCollection(restaurantId),
    orderBy("itemName", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: InventoryItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<InventoryItem, "id">),
      }));
      callback(items);
    },
    (err) => onError?.(err)
  );
}

// ── Low stock items ──────────────────────────
export function subscribeLowStock(
  restaurantId: string,
  callback: (items: InventoryItem[]) => void
): () => void {
  const q = query(
    inventoryCollection(restaurantId),
    where("isLowStock", "==", true)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<InventoryItem, "id">),
    })));
  });
}
