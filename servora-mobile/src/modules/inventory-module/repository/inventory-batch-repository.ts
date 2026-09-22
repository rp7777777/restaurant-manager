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
// ✅ updateBatchDetails() (correction/typo-fix support): for a
//    HUMAN correcting a mistake — a mistyped batchNo, a wrong
//    expiryDate, or a mis-keyed quantity. Distinct from
//    updateBatchQuantity() (the FEFO engine's deduction path) and
//    updateBatchStatus() (lifecycle changes) — this is the manual-
//    correction entry point.
// ✅ NEW — archiveInventoryBatch()/restoreInventoryBatch() now use a
//    Firestore transaction (was a plain getDoc + updateDoc) to
//    read-modify-write the archiveHistory array — same pattern as
//    inventory-item-service.ts's item-level archive/restore (Step
//    2/3 of the archive-history-tracking rollout): archive() appends
//    a new open cycle { archivedAt, restoredAt: null }; restore()
//    finds the LAST entry with restoredAt === null and closes it.
//    This lets Historical views correctly determine batch visibility
//    for any past date range, instead of only knowing the LAST
//    archive/restore event. The transaction also protects against a
//    concurrent archive/restore silently dropping a cycle entry.
//    Still sets/clears isActive+archivedAt/restoredAt on the BATCH
//    document only — never touches the parent InventoryItem or any
//    other batch.
// ✅ No delete function — batches are never deleted, only depleted
//    or status-changed/archived. This preserves the audit trail
//    permanently.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, doc, getDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, runTransaction,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  InventoryBatch,
  CreateInventoryBatchInput,
  InventoryBatchStatus,
} from "../types/inventory-batch";

type ArchiveCycle = { archivedAt: unknown; restoredAt: unknown | null };

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

// ── Batch-level archive — INDEPENDENT of InventoryItem.isActive.
//    Archiving/restoring a single batch never touches the parent
//    item or its other batches. Transaction-based to safely
//    read-modify-write archiveHistory. See FROZEN header. ──
export async function archiveInventoryBatch(
  restaurantId: string,
  batchId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = batchDoc(restaurantId, batchId);
  const uid = auth.currentUser.uid;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Batch not found");
    const existing = snap.data() as Omit<InventoryBatch, "id">;
    if (existing.isActive === false) {
      throw new Error("This batch is already archived");
    }

    const history = (existing.archiveHistory as ArchiveCycle[] | undefined) ?? [];
    const now = new Date();
    const updatedHistory: ArchiveCycle[] = [...history, { archivedAt: now, restoredAt: null }];

    transaction.update(ref, {
      isActive:       false,
      archivedAt:     serverTimestamp(),
      archiveHistory: updatedHistory,
      updatedAt:      serverTimestamp(),
      updatedBy:      uid,
    });
  });
}

export async function restoreInventoryBatch(
  restaurantId: string,
  batchId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = batchDoc(restaurantId, batchId);
  const uid = auth.currentUser.uid;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Batch not found");
    const existing = snap.data() as Omit<InventoryBatch, "id">;
    if (existing.isActive !== false) {
      throw new Error("This batch is not archived");
    }

    const history = (existing.archiveHistory as ArchiveCycle[] | undefined) ?? [];
    const now = new Date();
    const updatedHistory = [...history];
    const openIndex = updatedHistory.map((c) => c.restoredAt).lastIndexOf(null);
    if (openIndex !== -1) {
      updatedHistory[openIndex] = { ...updatedHistory[openIndex], restoredAt: now };
    }

    transaction.update(ref, {
      isActive:       true,
      archivedAt:     null,
      restoredAt:     serverTimestamp(),
      archiveHistory: updatedHistory,
      updatedAt:      serverTimestamp(),
      updatedBy:      uid,
    });
  });
}