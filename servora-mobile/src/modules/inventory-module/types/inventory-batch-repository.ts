// ============================================
// SERVORA ERP — Inventory Batch Repository
// ✅ Single gateway for all InventoryBatch Firestore operations.
// ✅ ARCHITECTURE BOUNDARY (important — do not blur this):
//    - This repository ONLY manages batch documents (create,
//      update quantity/status, query). It NEVER touches
//      InventoryItem.currentStock itself.
//    - Keeping InventoryItem.currentStock in sync with the sum of
//      its batches is inventory-service.ts's job (orchestration
//      across this repository AND inventory-repository.ts) — the
//      same "repositories never call each other" rule already
//      established for category/department repositories applies
//      here too.
// ✅ Validation — quantity/unitCost cannot be negative, batchNo/
//    itemName required, purchaseDate/receivedDate must be valid
//    YYYY-MM-DD strings (same lightweight shape check used
//    elsewhere in this module — not a full calendar-validity check,
//    which stays a UI-layer concern per the existing
//    isValidExpiryDate() precedent in useInventoryForm.ts).
// ✅ status defaults to "ACTIVE" on create if not explicitly passed.
// ✅ Duplicate batchNo guard — a batchNo must be unique WITHIN its
//    parent inventory item (the same batch number could legitimately
//    exist for two DIFFERENT items, e.g. two different products
//    both labeled "A100" by different suppliers, so uniqueness is
//    scoped to inventoryId, not global).
// ✅ updatedBy captured on updateBatchQuantity()/updateBatchStatus()
//    — every mutation after creation is attributable to a specific
//    user, matching the audit-trail principle already used
//    throughout this module (createdBy on creation, updatedBy on
//    every subsequent change).
// ✅ getBatchesForItem() returns batches ordered by receivedDate
//    ASCENDING (chronological/audit order) — this is NOT FEFO order.
//    FEFO ordering (nearest-expiry-first, with the receivedDate
//    tie-breaker) is intentionally computed at the SERVICE layer via
//    sortBatchesByFEFO() from types/inventory-batch.ts, not baked
//    into this repository's query — different callers need
//    different orderings from the same underlying data (an audit
//    view wants chronological order, the FEFO engine wants expiry
//    order), and a repository query can only sort one way.
// ✅ No delete function — batches are never deleted, only depleted
//    (quantity → 0) or status-changed (CLOSED/EXPIRED/QUARANTINED/
//    RECALLED). This preserves the audit trail permanently.
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

// ── Lightweight YYYY-MM-DD shape check — same precedent as
//    isValidExpiryDate() in useInventoryForm.ts. Real calendar-
//    validity checking (e.g. rejecting 2026-02-31) stays a UI-layer
//    concern; this is a repository-level guard against obviously
//    malformed input reaching Firestore. ──
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
//    item (not globally). ──
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

// ── Create — always creates a NEW batch document. Never merges
//    into an existing batch, per the confirmed design: every
//    purchase/stock-in is its own row. ──
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

// ── The ONLY way a batch's quantity changes after creation. Used
//    by the FEFO deduction engine to draw down batches, and by
//    manual corrections. Rejects negative results — the caller
//    (FEFO engine) is responsible for not requesting more than a
//    batch has. ──
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

// ── Change a batch's status (e.g. mark EXPIRED, QUARANTINED,
//    RECALLED, or CLOSED). Does not touch quantity — status and
//    quantity are orthogonal per the type's design. ──
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

// ── All batches for one item (including depleted/non-ACTIVE ones),
//    ordered by receivedDate ASCENDING (chronological/audit order —
//    NOT FEFO order, see FROZEN header). ──
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