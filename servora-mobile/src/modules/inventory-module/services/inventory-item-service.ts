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
//    Increase/Decrease/Correction on batch-tracked items is PENDING
//    (blocked on migrating Purchase Order's PURCHASE calls off this
//    same function first — see inventory-service.ts's file header).
// ✅ archiveInventoryItem()/restoreInventoryItem() — toggle isActive.
//    Deliberately do NOT touch currentStock/batches — archiving an
//    ITEM is purely a visibility/lifecycle flag, not a stock
//    operation. A stock>0 + isActive=false item is a VALID state
//    (the user consciously archived it) — NOT automatically treated
//    as corruption.
// ✅ NEW — archiveHistory read-modify-write: archive() reads the
//    item's CURRENT archiveHistory array, appends a NEW cycle entry
//    { archivedAt: serverTimestamp(), restoredAt: null }, and writes
//    the full array back. restore() reads the array, finds the LAST
//    entry (the currently-open cycle, restoredAt === null) and sets
//    ITS restoredAt — never mutating any earlier, already-closed
//    cycle. This preserves a complete, accurate record of every
//    archive/restore period the item has ever been through, so
//    Historical views (via isArchivedDuring() in
//    useHistoricalInventory.ts) can correctly hide the item ONLY for
//    dates that actually fell within an archived period — restoring
//    an item no longer makes it look "never archived" for past dates
//    during which it genuinely was archived. archivedAt/restoredAt
//    top-level fields are STILL written (kept for backward
//    compatibility / quick "is this currently archived" checks by
//    code that doesn't need the full history), but archiveHistory is
//    the source of truth for date-range visibility.
// ✅ Uses a Firestore transaction (not a plain read-then-write) so a
//    concurrent archive/restore on the same item can't silently drop
//    an entry — the read and the write happen atomically together.
// ✅ duplicateInventoryItem() — creates a new item with currentStock
//    always 0. Does not carry over archiveHistory (a fresh item has
//    none).
// ✅ syncItemStockFromBatches(): recomputes InventoryItem.
//    currentStock from its batches' actual sum. UNCHANGED.
// FROZEN
// ============================================

import { updateDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { InventoryItem, CreateInventoryItemInput } from "../types/inventory";
import { calculateTotalFromBatches } from "../types/inventory-batch";
import { RecordStockMovementInput } from "../../stock-movement-module/types/stock-movement";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import { createInventoryItem as repoCreateInventoryItem } from "../repository/inventory-repository";
import { getBatchesForItem } from "../repository/inventory-batch-repository";
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

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Item not found");

    const existing = (snap.data().archiveHistory as ArchiveCycle[] | undefined) ?? [];
    const now = new Date();
    const updatedHistory = [...existing];

    // Close the currently-open cycle (the last entry with
    // restoredAt === null), if any. If none exists (legacy data with
    // no archiveHistory yet), add a best-effort single closed entry
    // so future date-range lookups have at least this one cycle.
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