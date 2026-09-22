// ============================================
// SERVORA ERP — Inventory Item Service
// ✅ EXTRACTED from inventory-service.ts — pure structural refactor,
//    byte-for-byte identical logic, just relocated.
// ✅ adjustStock() — thin delegate to stock-movement-service.ts's
//    recordStockMovement() (the ORIGINAL non-batch path). Untouched.
//    ⚠️ KNOWN ARCHITECTURE RISK (documented, not fixed here) — for a
//    batch-tracked item, recordStockMovement() changes currentStock
//    WITHOUT touching batch documents, which can desynchronize
//    currentStock from the actual batch sum. A guard to reject
//    Increase/Decrease/Correction on batch-tracked items is PENDING.
// ✅ archiveInventoryItem() — sets currentStock: 0 while archived
//    (matches batch-level archive's own behavior). Batch documents
//    themselves are left completely untouched.
// ✅ restoreInventoryItem() — reuses the EXACT SAME transaction-safe
//    pattern as inventory-batch-repository.ts's own archive/restore:
//    1) pre-read the item (to know it exists) and the sibling batch
//       ID list (via a normal, non-transactional query — Firestore
//       transactions cannot run queries internally),
//    2) inside the transaction, re-read the item AND every one of
//       those specific batch documents fresh via transaction.get(),
//    3) compute currentStock from those FRESH batch reads (via
//       calculateTotalFromBatches()), not from the pre-read query
//       result — this eliminates the stale-value race a plain
//       pre-transaction getBatchesForItem() + separate transaction
//       would have (a batch changing between the query and the
//       transaction is picked up correctly, since the transaction
//       re-reads it). The batch ID LIST itself is still a pre-read,
//       same acceptable-by-design assumption as the batch repository
//       (batches are never deleted, only archived — see that file's
//       own FROZEN header for the fuller explanation).
// ✅ archiveHistory read-modify-write — UNCHANGED: archive() appends
//    a new open cycle, restore() closes the last open one (only when
//    one exists — legacy items with no archiveHistory array simply
//    get none added, matching the actual historical logic in
//    useHistoricalInventory.ts's isArchivedDuring(), which itself
//    falls back to the plain archivedAt/isActive check when
//    archiveHistory is empty).
// ✅ duplicateInventoryItem() — creates a new item with currentStock
//    always 0. Does not carry over archiveHistory.
// ✅ syncItemStockFromBatches(): UNCHANGED — recomputes
//    InventoryItem.currentStock from its batches' actual sum, for
//    other callers unrelated to archive/restore.
// FROZEN
// ============================================

import { updateDoc, serverTimestamp, runTransaction, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import { calculateTotalFromBatches, InventoryBatch } from "../types/inventory-batch";
import { RecordStockMovementInput } from "../../stock-movement-module/types/stock-movement";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import { createInventoryItem as repoCreateInventoryItem } from "../repository/inventory-repository";
import { getBatchesForItem, batchesCollection, batchDoc } from "../repository/inventory-batch-repository";
import { inventoryDoc } from "./inventory-service-helpers";

type ArchiveCycle = { archivedAt: unknown; restoredAt: unknown | null };

// ── Stock Adjustment (non-batch path) ────────────
export async function adjustStock(
  restaurantId: string,
  input: RecordStockMovementInput
): Promise<{ movementId: string; beforeQuantity: number; afterQuantity: number; movementValue: number }> {
  return recordStockMovement(restaurantId, input);
}

// ── Archive ──────────────────────────────────────
export async function archiveInventoryItem(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!itemId) throw new Error("Inventory item is required");

  const ref = inventoryDoc(restaurantId, itemId);
  const uid = auth.currentUser.uid;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Item not found");

    const existing = (snap.data().archiveHistory as ArchiveCycle[] | undefined) ?? [];
    const now = new Date();
    const updatedHistory: ArchiveCycle[] = [...existing, { archivedAt: now, restoredAt: null }];

    transaction.update(ref, {
      isActive:       false,
      archivedAt:     serverTimestamp(),
      currentStock:   0,
      archiveHistory: updatedHistory,
      updatedAt:      serverTimestamp(),
      updatedBy:      uid,
    });
  });
}

// ── Restore ──────────────────────────────────────
export async function restoreInventoryItem(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!itemId) throw new Error("Inventory item is required");

  const ref = inventoryDoc(restaurantId, itemId);
  const uid = auth.currentUser.uid;

  // ✅ Pre-read ONLY the batch ID list (non-transactional query —
  // Firestore transactions cannot run queries internally). The
  // ACTUAL batch values are re-read fresh inside the transaction
  // below via transaction.get(), eliminating the stale-value race.
  const batchesQuerySnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", itemId))
  );
  const batchIds = batchesQuerySnap.docs.map((d) => d.id);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Item not found");

    const batchSnaps = await Promise.all(
      batchIds.map((id) => transaction.get(batchDoc(restaurantId, id)))
    );
    const freshBatches: InventoryBatch[] = batchSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...(s.data() as Omit<InventoryBatch, "id">) }));

    const recomputedStock = calculateTotalFromBatches(freshBatches);

    const existing = (snap.data().archiveHistory as ArchiveCycle[] | undefined) ?? [];
    const now = new Date();
    const updatedHistory = [...existing];

    // Close the currently-open cycle (the last entry with
    // restoredAt === null), if any. Legacy items with no
    // archiveHistory yet simply get none added — matches
    // isArchivedDuring()'s own fallback-to-archivedAt logic when the
    // array is empty.
    const openIndex = updatedHistory.map((c) => c.restoredAt).lastIndexOf(null);
    if (openIndex !== -1) {
      updatedHistory[openIndex] = { ...updatedHistory[openIndex], restoredAt: now };
    }

    transaction.update(ref, {
      isActive:       true,
      archivedAt:     null,
      currentStock:   recomputedStock,
      restoredAt:     serverTimestamp(),
      archiveHistory: updatedHistory,
      updatedAt:      serverTimestamp(),
      updatedBy:      uid,
    });
  });
}

// ── Duplicate ────────────────────────────────────
export async function duplicateInventoryItem(
  restaurantId: string,
  source: InventoryItem,
  duplicatedName: string
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const input: CreateInventoryItemInput = {
    itemName:                 duplicatedName,
    categoryId:                source.categoryId,
    currentStock:              0,
    unit:                      source.unit,
    unitCost:                  source.unitCost,
    minStock:                  source.minStock,
    storageLocation:           source.storageLocation,
    supplierId:                source.supplierId,
    expiryAlertDaysOverride:   source.expiryAlertDaysOverride,
    notes:                     source.notes,
    isActive:                  true,
  };

  return repoCreateInventoryItem(restaurantId, input);
}

// ── Sync currentStock from batches (see FROZEN header) ──
export async function syncItemStockFromBatches(
  restaurantId: string,
  itemId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!itemId) throw new Error("Inventory item is required");

  const batches = await getBatchesForItem(restaurantId, itemId);
  const recomputedStock = calculateTotalFromBatches(batches);

  await updateDoc(inventoryDoc(restaurantId, itemId), {
    currentStock: recomputedStock,
    updatedAt:    serverTimestamp(),
    updatedBy:    auth.currentUser.uid,
  });
}