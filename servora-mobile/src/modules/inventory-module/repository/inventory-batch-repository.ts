// ============================================
// SERVORA ERP — Inventory Batch Repository
// ✅ Single gateway for all InventoryBatch Firestore operations.
// ✅ ARCHITECTURE BOUNDARY (relaxed for archive/restore only — see
//    below) — this repository otherwise ONLY manages batch
//    documents. Keeping InventoryItem.currentStock in sync for
//    quantity/status changes outside archive/restore remains
//    inventory-item-service.ts's job.
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
// ✅ archiveInventoryBatch()/restoreInventoryBatch() recompute and
//    write the parent InventoryItem's currentStock IN THE SAME
//    TRANSACTION as the batch's own isActive/archivedAt/
//    archiveHistory update. Deliberate, justified exception to the
//    "batch repository never touches InventoryItem" boundary above.
// ✅ CRITICAL FIX — Firestore transactions CANNOT run a query
//    (getDocs) inside them; only transaction.get() on individual
//    document REFERENCES is allowed. The previous revision's
//    getDocs(query(...)) call INSIDE runTransaction() silently
//    produced a stale/incorrect batch list, which made the
//    recomputed currentStock wrong (observed bug: archiving a batch
//    left currentStock completely unchanged). Fixed by reading the
//    sibling batch ID list via a normal (non-transactional) query
//    BEFORE starting the transaction, then re-reading each of those
//    SPECIFIC documents via transaction.get() inside the transaction
//    — this keeps the actual recompute fully transactional/
//    consistent; only the "which document IDs exist for this item"
//    list is a pre-read. This is safe because batches are NEVER
//    deleted in this app (only archived — see header below), so the
//    ID list itself cannot go stale between the pre-read and the
//    transaction — at worst a batch CREATED in that tiny window is
//    simply not included yet, which self-corrects on its own next
//    archive/restore or sync.
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
  isActiveBatch,
} from "../types/inventory-batch";

type ArchiveCycle = { archivedAt: unknown; restoredAt: unknown | null };

function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
}

function batchDoc(restaurantId: string, batchId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES, batchId);
}

function itemDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
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

// ── Batch-level archive — sets isActive/archivedAt/archiveHistory on
//    the batch AND recomputes+writes the parent item's currentStock,
//    atomically in one transaction. See FROZEN header for the
//    getDocs-outside-transaction fix. ──
export async function archiveInventoryBatch(
  restaurantId: string,
  batchId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const bRef = batchDoc(restaurantId, batchId);
  const uid = auth.currentUser.uid;

  // ✅ Pre-read OUTSIDE the transaction to find this batch's
  // inventoryId and its sibling batch IDs — Firestore transactions
  // cannot run a query, only transaction.get() on specific doc refs.
  const preSnap = await getDoc(bRef);
  if (!preSnap.exists()) throw new Error("Batch not found");
  const preData = preSnap.data() as Omit<InventoryBatch, "id">;
  const inventoryId = preData.inventoryId;

  const siblingsQuerySnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", inventoryId))
  );
  const siblingIds = siblingsQuerySnap.docs.map((d) => d.id);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(bRef);
    if (!snap.exists()) throw new Error("Batch not found");
    const existing = snap.data() as Omit<InventoryBatch, "id">;
    if (existing.isActive === false) {
      throw new Error("This batch is already archived");
    }

    // Re-read every sibling batch document INSIDE the transaction,
    // by specific reference — this is what makes the recompute
    // transactional/consistent.
    const siblingSnaps = await Promise.all(
      siblingIds.map((id) => transaction.get(batchDoc(restaurantId, id)))
    );
    const siblings: InventoryBatch[] = siblingSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...(s.data() as Omit<InventoryBatch, "id">) }));

    const now = new Date();
    const history = (existing.archiveHistory as ArchiveCycle[] | undefined) ?? [];
    const updatedHistory: ArchiveCycle[] = [...history, { archivedAt: now, restoredAt: null }];

    transaction.update(bRef, {
      isActive:       false,
      archivedAt:     serverTimestamp(),
      archiveHistory: updatedHistory,
      updatedAt:      serverTimestamp(),
      updatedBy:      uid,
    });

    // Recompute currentStock as if this batch is already archived
    // (it's excluded from isActiveBatch() once isActive is false).
    const recomputedStock = siblings
      .filter((b) => (b.id === batchId ? false : isActiveBatch(b)))
      .reduce((sum, b) => sum + b.quantity, 0);

    transaction.update(itemDoc(restaurantId, inventoryId), {
      currentStock: recomputedStock,
      updatedAt:    serverTimestamp(),
      updatedBy:    uid,
    });
  });
}

export async function restoreInventoryBatch(
  restaurantId: string,
  batchId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const bRef = batchDoc(restaurantId, batchId);
  const uid = auth.currentUser.uid;

  const preSnap = await getDoc(bRef);
  if (!preSnap.exists()) throw new Error("Batch not found");
  const preData = preSnap.data() as Omit<InventoryBatch, "id">;
  const inventoryId = preData.inventoryId;

  const siblingsQuerySnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", inventoryId))
  );
  const siblingIds = siblingsQuerySnap.docs.map((d) => d.id);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(bRef);
    if (!snap.exists()) throw new Error("Batch not found");
    const existing = snap.data() as Omit<InventoryBatch, "id">;
    if (existing.isActive !== false) {
      throw new Error("This batch is not archived");
    }

    const siblingSnaps = await Promise.all(
      siblingIds.map((id) => transaction.get(batchDoc(restaurantId, id)))
    );
    const siblings: InventoryBatch[] = siblingSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...(s.data() as Omit<InventoryBatch, "id">) }));

    const now = new Date();
    const history = (existing.archiveHistory as ArchiveCycle[] | undefined) ?? [];
    const updatedHistory = [...history];
    const openIndex = updatedHistory.map((c) => c.restoredAt).lastIndexOf(null);
    if (openIndex !== -1) {
      updatedHistory[openIndex] = { ...updatedHistory[openIndex], restoredAt: now };
    }

    transaction.update(bRef, {
      isActive:       true,
      archivedAt:     null,
      restoredAt:     serverTimestamp(),
      archiveHistory: updatedHistory,
      updatedAt:      serverTimestamp(),
      updatedBy:      uid,
    });

    // Recompute currentStock as if this batch is already restored
    // (isActiveBatch() now includes it, since isActive → true).
    const recomputedStock = siblings
      .filter((b) => (b.id === batchId ? true : isActiveBatch(b)))
      .reduce((sum, b) => sum + (b.id === batchId ? existing.quantity : b.quantity), 0);

    transaction.update(itemDoc(restaurantId, inventoryId), {
      currentStock: recomputedStock,
      updatedAt:    serverTimestamp(),
      updatedBy:    uid,
    });
  });
}