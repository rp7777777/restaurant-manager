// ============================================
// SERVORA ERP — Inventory Batch Repository
// ✅ Single gateway for all InventoryBatch Firestore operations.
// ✅ ARCHITECTURE BOUNDARY (important — do not blur this):
//    - This repository ONLY manages batch documents (create,
//      update quantity/status, query). It NEVER touches
//      InventoryItem.currentStock itself.
//    - Keeping InventoryItem.currentStock in sync with the sum of
//      its batches is inventory-service.ts's job.
// ✅ Validation — quantity/unitCost cannot be negative, batchNo/
//    itemName required, purchaseDate/receivedDate must be valid
//    YYYY-MM-DD strings.
// ✅ status defaults to "ACTIVE" on create if not explicitly passed.
// ✅ Duplicate batchNo guard — scoped to inventoryId, not global.
// ✅ updatedBy captured on updateBatchQuantity()/updateBatchStatus().
// ✅ getBatchesForItem() returns batches ordered by receivedDate
//    ASCENDING — this is NOT FEFO order. FEFO ordering is computed
//    at the service layer via sortBatchesByFEFO().
// ✅ No delete function — batches are never deleted, only depleted
//    or status-changed.
// ✅ ADDITIVE — subscribeAllBatches() (for the future
//    InventoryBatchReport modal): restaurant-wide live subscription
//    across ALL batches, not scoped to a single item. Used ONLY by
//    the batch report (Category → Item → Batch rows → Total QTY),
//    which groups batches by item/category client-side.
//    Deliberately a SEPARATE function rather than a modification to
//    subscribeBatchesForItem() (which stays exactly as it was,
//    still scoped to one inventoryId) — the two serve genuinely
//    different callers, and merging them would force an unnecessary
//    optional parameter into the single-item path.
//    Scale note (documented, not solved here): a full-collection
//    realtime subscription is fine at the current scale (hundreds
//    of batches). If this grows to thousands, this should evolve to
//    a paginated or active-only query — a future optimization, not
//    built here, per the confirmed decision to not over-engineer
//    ahead of actual scale.
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

// ── Lightweight YYYY-MM-DD shape check ──
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

// ── Duplicate check — batchNo must be unique WITHIN one inventory
//    item. ──
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

// ── Create — always creates a NEW batch document. ──
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

// ── The ONLY way a batch's quantity changes after creation. ──
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

// ── Change a batch's status. ──
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

export async function getBatchById(
  restaurantId: string,
  batchId: string
): Promise<InventoryBatch | null> {
  const snap = await getDoc(batchDoc(restaurantId, batchId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<InventoryBatch, "id">) };
}

// ── All batches for one item, ordered by receivedDate ASCENDING —
//    NOT FEFO order. ──
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

// ── ADDITIVE — restaurant-wide live subscription across ALL
//    batches, for InventoryBatchReport. See FROZEN header. ──
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