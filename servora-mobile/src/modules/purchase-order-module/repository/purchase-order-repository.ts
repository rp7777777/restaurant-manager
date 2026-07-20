// ============================================
// SERVORA ERP — Purchase Order Repository
// ✅ Transaction-safe poNumber generation — a dedicated counter
//    document (restaurants/{id}/store/counters) is read + incremented
//    inside the SAME transaction that creates the PO, so two
//    concurrent "Create PO" attempts can never collide on the same
//    number (same pattern used throughout Servora for anything
//    that needs a guaranteed-unique sequence)
// ✅ totalAmount/lineTotal always server-computed from
//    quantity × unitCost — never trusted from the caller
// ✅ Status transitions strictly validated inside a transaction —
//    a PO can never be received twice, or skip from DRAFT straight
//    to RECEIVED. Guard + write happen atomically (same "read the
//    lock state, then write" pattern used by Schedule/Attendance).
// ✅ Delete only allowed while status === "DRAFT" — once a PO enters
//    the real approval/ordering workflow it becomes an audit record,
//    not something that should silently disappear.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query,
  orderBy, serverTimestamp, runTransaction,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  CreatePurchaseOrderInput,
} from "../types/purchase-order";

function purchaseOrdersCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.PURCHASE_ORDERS);
}

function purchaseOrderDoc(restaurantId: string, poId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.PURCHASE_ORDERS, poId);
}

// ── Counter doc for sequential poNumber generation ──
function poCounterDoc(restaurantId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.STORE, "counters");
}

// ── Valid status transitions — anything not listed here is
//    rejected. RECEIVED and CANCELLED are terminal states. ──
const VALID_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT:     ["PENDING", "CANCELLED"],
  PENDING:   ["APPROVED", "CANCELLED"],
  APPROVED:  ["RECEIVED", "CANCELLED"],
  RECEIVED:  [],
  CANCELLED: [],
};

// ── Create ──────────────────────────────────────
// Generates the next sequential poNumber (e.g. "PO-0001") and
// creates the PO in one transaction, so the counter can never be
// incremented without a matching PO actually being created (and
// vice versa).
export async function createPurchaseOrder(
  restaurantId: string,
  input: CreatePurchaseOrderInput
): Promise<{ id: string; poNumber: string }> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!input.supplierId) throw new Error("Supplier is required");
  if (!input.items || input.items.length === 0) {
    throw new Error("At least one item is required");
  }
  input.items.forEach((item) => {
    if (!item.itemName.trim()) throw new Error("Item name is required");
    if (item.quantity <= 0) throw new Error("Quantity must be greater than 0");
    if (item.unitCost < 0) throw new Error("Unit cost cannot be negative");
  });

  const counterRef = poCounterDoc(restaurantId);
  const newPoRef    = doc(purchaseOrdersCollection(restaurantId));

  const items: PurchaseOrderItem[] = input.items.map((item) => ({
    itemId:    item.itemId,
    itemName:  item.itemName.trim(),
    quantity:  item.quantity,
    unit:      item.unit,
    unitCost:  item.unitCost,
    lineTotal: Math.round(item.quantity * item.unitCost * 100) / 100,
  }));
  const totalAmount = Math.round(
    items.reduce((sum, i) => sum + i.lineTotal, 0) * 100
  ) / 100;

  const poNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const lastNumber   = Number(counterSnap.data()?.poNumber ?? 0);
    const nextNumber   = lastNumber + 1;
    const formattedNo  = `PO-${String(nextNumber).padStart(4, "0")}`;

    transaction.set(counterRef, { poNumber: nextNumber }, { merge: true });

    transaction.set(newPoRef, {
      poNumber:              formattedNo,
      supplierId:            input.supplierId,
      items,
      totalAmount,
      status:                "DRAFT" as PurchaseOrderStatus,
      expectedDeliveryDate:  input.expectedDeliveryDate ?? null,
      receivedDate:          null,
      restaurantId,
      createdBy:             auth.currentUser!.uid,
      createdAt:             serverTimestamp(),
      updatedAt:             serverTimestamp(),
    });

    return formattedNo;
  });

  return { id: newPoRef.id, poNumber };
}

// ── Status transition — the only way a PO's status ever changes.
//    Reads current status + writes new status inside one
//    transaction, rejecting any transition not in VALID_TRANSITIONS.
export async function updatePurchaseOrderStatus(
  restaurantId: string,
  poId: string,
  newStatus: PurchaseOrderStatus
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = purchaseOrderDoc(restaurantId, poId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Purchase order not found");

    const currentStatus = snap.data().status as PurchaseOrderStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Cannot change status from ${currentStatus} to ${newStatus}`
      );
    }

    const updates: Record<string, unknown> = {
      status:    newStatus,
      updatedAt: serverTimestamp(),
    };
    if (newStatus === "RECEIVED") {
      updates.receivedDate = new Date().toISOString().slice(0, 10);
    }

    transaction.update(ref, updates);
  });
}

// ── Delete — only while still a DRAFT. Once submitted/approved,
//    a PO is an audit record and should be cancelled, not deleted. ──
export async function deletePurchaseOrder(
  restaurantId: string,
  poId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = purchaseOrderDoc(restaurantId, poId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Purchase order not found");

    const status = snap.data().status as PurchaseOrderStatus;
    if (status !== "DRAFT") {
      throw new Error(
        `Cannot delete a purchase order that is ${status} — cancel it instead`
      );
    }

    transaction.delete(ref);
  });
}

// ── Get single PO ────────────────────────────────
export async function getPurchaseOrderById(
  restaurantId: string,
  poId: string
): Promise<PurchaseOrder | null> {
  const snap = await getDoc(purchaseOrderDoc(restaurantId, poId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<PurchaseOrder, "id">) };
}

// ── Get all (one-time fetch) ────────────────────
export async function getAllPurchaseOrders(
  restaurantId: string
): Promise<PurchaseOrder[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(
    query(purchaseOrdersCollection(restaurantId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, "id">) }));
}

// ── Subscribe (live) ────────────────────────────
export function subscribePurchaseOrders(
  restaurantId: string,
  callback: (orders: PurchaseOrder[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(purchaseOrdersCollection(restaurantId), orderBy("createdAt", "desc")),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<PurchaseOrder, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}