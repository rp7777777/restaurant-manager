// ============================================
// SERVORA ERP — Inventory Batch Repository
// ✅ Single gateway for all InventoryBatch Firestore operations.
// ✅ ARCHITECTURE BOUNDARY — this repository ONLY manages batch
//    documents. It NEVER touches InventoryItem.currentStock itself
//    — keeping that in sync is inventory-service.ts's job.
// ✅ Validation — quantity/unitCost cannot be negative, batchNo/
//    itemName required, purchaseDate/receivedDate must be valid
//    YYYY-MM-DD strings.
// ✅ status defaults to "ACTIVE" on create if not explicitly passed.
// ✅ Duplicate batchNo guard — scoped to inventoryId, not global.
// ✅ updatedBy captured on updateBatchQuantity()/updateBatchStatus().
// ✅ getBatchesForItem() returns batches ordered by receivedDate
//    ASCENDING — NOT FEFO order.
// ✅ subscribeAllBatches() — restaurant-wide live subscription, for
//    InventoryBatchReport / InventoryTableView.
// ✅ NEW — updateBatchDetails() (correction/typo-fix support):
//    for a HUMAN correcting a mistake — a mistyped batchNo, a wrong
//    expiryDate, or a mis-keyed quantity. Distinct from
//    updateBatchQuantity() (the FEFO engine's deduction path) and
//    updateBatchStatus() (lifecycle changes) — this is the manual-
//    correction entry point. Updates whichever of batchNo/
//    expiryDate/quantity are provided (all optional). Does NOT
//    check for duplicate batchNo across batches the way
//    createInventoryBatch() does at creation time — an accepted gap
//    for this manual-correction path, not the automated receiving
//    path. Does NOT touch status/unitCost/purchaseDate/
//    receivedDate/supplierId/locationId/notes — outside this
//    correction flow's confirmed scope.
// ✅ No delete function — batches are never deleted, only depleted
//    or status-changed. This preserves the audit trail permanently.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, doc, getDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  InventoryBatch,
  CreateInventoryBatchInput,
  InventoryBatchStatus,
} from "../types/inventory-batch";

function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
}

function batchDoc(restaurantId: string, batchId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES, batchId);
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function validateInput(input: CreateInventoryBatchInput) {
  if (!input.itemName.trim()) {
    throw new Error("Item name is required");
  }
  if (!input.batchNo.trim()) {
    throw new Error("Batch number is required");
  }
  if (input.quantity < 0) {
    throw new Error("Batch quantity cannot be negative");
  }
  if (input.unitCost < 0) {
    throw new Error("Unit cost cannot be negative");
  }
  if (!input.purchaseDate || !isValidDateString(input.purchaseDate)) {
    throw new Error("Purchase date must be a valid date (YYYY-MM-DD)");
  }
  if (!input.receivedDate || !isValidDateString(input.receivedDate)) {
    throw new Error("Received date must be a valid date (YYYY-MM-DD)");
  }
  if (input.expiryDate && !isValidDateString(input.expiryDate)) {
    throw new Error("Expiry date must be a valid date (YYYY-MM-DD)");
  }
}

async function assertBatchNoNotTaken(
  restaurantId: string,
  inventoryId: string,
  batchNo: string
): Promise<void> {
  const snap = await getDocs(
    query(
      batchesCollection(restaurantId),
      where("inventoryId", "==", inventoryId),
      where("batchNo", "==", batchNo.trim()),
      limit(1)
    )
  );
  if (!snap.empty) {
    throw new Error(`Batch number "${batchNo.trim()}" already exists for this item`);
  }
}

export async function createInventoryBatch(
  restaurantId: string,
  input: CreateInventoryBatchInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  validateInput(input);
  await assertBatchNoNotTaken(restaurantId, input.inventoryId, input.batchNo);

  const ref = await addDoc(batchesCollection(restaurantId), {
    inventoryId:      input.inventoryId,
    itemName:         input.itemName.trim(),
    batchNo:          input.batchNo.trim(),
    quantity:         input.quantity,
    originalQuantity: input.quantity,
    unit:             input.unit,
    unitCost:         input.unitCost,
    purchaseDate:     input.purchaseDate,
    receivedDate:     input.receivedDate,
    expiryDate:       input.expiryDate ?? null,
    status:           input.status ?? "ACTIVE",
    supplierId:       input.supplierId ?? null,
    locationId:       input.locationId ?? null,
    notes:            input.notes?.trim() || null,
    restaurantId,
    createdBy:        auth.currentUser.uid,
    createdAt:        serverTimestamp(),
    updatedAt:        serverTimestamp(),
  });

  return ref.id;
}

export async function updateBatchQuantity(
  restaurantId: string,
  batchId: string,
  newQuantity: number
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (newQuantity < 0) {
    throw new Error("Batch quantity cannot go negative");
  }

  await updateDoc(batchDoc(restaurantId, batchId), {
    quantity:  newQuantity,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  });
}

export async function updateBatchStatus(
  restaurantId: string,
  batchId: string,
  status: InventoryBatchStatus
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  await updateDoc(batchDoc(restaurantId, batchId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  });
}

// ── Correction/typo-fix support — see FROZEN header. ──
export interface UpdateBatchDetailsInput {
  batchNo?:    string;
  expiryDate?: string; // pass empty string "" to clear it
  quantity?:   number;
}

export async function updateBatchDetails(
  restaurantId: string,
  batchId: string,
  input: UpdateBatchDetailsInput
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  if (input.batchNo !== undefined && !input.batchNo.trim()) {
    throw new Error("Batch number cannot be empty");
  }
  if (input.quantity !== undefined && input.quantity < 0) {
    throw new Error("Batch quantity cannot be negative");
  }
  if (input.expiryDate && !isValidDateString(input.expiryDate)) {
    throw new Error("Expiry date must be a valid date (YYYY-MM-DD)");
  }

  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  };
  if (input.batchNo !== undefined) updates.batchNo = input.batchNo.trim();
  if (input.expiryDate !== undefined) updates.expiryDate = input.expiryDate.trim() || null;
  if (input.quantity !== undefined) updates.quantity = input.quantity;

  await updateDoc(batchDoc(restaurantId, batchId), updates);
}

export async function getBatchById(
  restaurantId: string,
  batchId: string
): Promise<InventoryBatch | null> {
  const snap = await getDoc(batchDoc(restaurantId, batchId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<InventoryBatch, "id">) };
}

export async function getBatchesForItem(
  restaurantId: string,
  inventoryId: string
): Promise<InventoryBatch[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(
    query(
      batchesCollection(restaurantId),
      where("inventoryId", "==", inventoryId),
      orderBy("receivedDate", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryBatch, "id">) }));
}

export function subscribeBatchesForItem(
  restaurantId: string,
  inventoryId: string,
  callback: (batches: InventoryBatch[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId || !inventoryId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(
      batchesCollection(restaurantId),
      where("inventoryId", "==", inventoryId),
      orderBy("receivedDate", "asc")
    ),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<InventoryBatch, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}

export function subscribeAllBatches(
  restaurantId: string,
  callback: (batches: InventoryBatch[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(batchesCollection(restaurantId), orderBy("receivedDate", "asc")),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<InventoryBatch, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}