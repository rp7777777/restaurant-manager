// ============================================
// SERVORA ERP — Inventory Permanent Delete Service (Phase 3)
// ✅ PURPOSE — let an OWNER/MANAGER permanently remove an item or a
//    batch that was created BY MISTAKE, from the Archived list only.
//    Anything with real stock history must stay ARCHIVED (it keeps
//    showing in history up to its archive date, and every report
//    stays correct) — this service refuses those.
// ✅ ELIGIBILITY (checked by checkItemPermanentDelete /
//    checkBatchPermanentDelete, and checked AGAIN right before deleting):
//    - it is archived (item: isActive false; batch: isActive false)
//    - no stock left (every batch quantity is 0)
//    - its movements are ONLY "PURCHASE" (manual receive) and batch
//      corrections ("ADJUSTMENT" + "DATA_CORRECTION") — i.e. it was
//      never issued to the kitchen, wasted, transferred or sold
//    - nothing links to it from a Purchase Order (no PURCHASE_ORDER
//      movement, no non-cancelled PO line with its itemId)
//    - (item only) no PENDING/APPROVED kitchen request points at it
//    - (batch only) each of its movements touches ONLY this batch, so
//      deleting those records never removes another batch's history
// ✅ WHAT IS DELETED — atomically in ONE Firestore write batch:
//    item → its movements, all its batch docs, their batchKey docs,
//    and the item doc. Batch → its own movements, the batch doc and
//    its batchKey doc (the item and its stock are untouched — the
//    batch is archived with 0 quantity, so the item's stock does not
//    change). Nothing is left pointing at a deleted record.
// ✅ Item delete also reverses the item in the store summary exactly
//    like the existing deleteInventoryItem() does (best-effort, logged
//    on failure — same pattern as the repository).
// ⚠️ Pre-reads (movements, batches, requests, POs) use getDocs() BEFORE
//    the write, the same accepted pattern as the other inventory
//    services. An archived item/batch cannot receive new deductions
//    (deduct rejects archived items; FEFO skips archived batches), so
//    the window is not a real risk; the archive + 0-stock state is
//    re-verified just before deleting.
// ============================================

import {
  getDocs, getDoc, query, where, writeBatch, doc, collection,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch } from "../types/inventory-batch";
import { StockMovement } from "../../stock-movement-module/types/stock-movement";
import {
  inventoryDoc, batchDoc, batchesCollection, stockMovementsCollection, batchKeyDoc, normalizeBatchKey,
} from "./inventory-service-helpers";
import { syncStoreSummaryForItemChange } from "../../store-module/services/store-summary-service";

export interface PermanentDeleteCheck {
  eligible: boolean;
  reasons:  string[]; // plain-language reasons it is NOT allowed (empty when eligible)
}

const MAX_WRITES_PER_BATCH = 450; // Firestore limit is 500 — keep headroom

function isAllowedMovementForDelete(m: StockMovement): boolean {
  if (m.referenceType === "PURCHASE_ORDER") return false;
  if (m.movementType === "PURCHASE") return true;
  if (m.movementType === "ADJUSTMENT" && m.reasonCategory === "DATA_CORRECTION") return true;
  return false;
}

async function getItemMovements(restaurantId: string, inventoryId: string): Promise<StockMovement[]> {
  const snap = await getDocs(query(stockMovementsCollection(restaurantId), where("inventoryId", "==", inventoryId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, "id">) }));
}

async function getItemBatches(restaurantId: string, inventoryId: string): Promise<InventoryBatch[]> {
  const snap = await getDocs(query(batchesCollection(restaurantId), where("inventoryId", "==", inventoryId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryBatch, "id">) }));
}

async function hasOpenKitchenRequest(restaurantId: string, inventoryId: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, COL.RESTAURANTS, restaurantId, RCOL.KITCHEN_REQUESTS),
      where("inventoryId", "==", inventoryId)
    )
  );
  return snap.docs.some((d) => {
    const status = d.data().status;
    return status === "PENDING" || status === "APPROVED";
  });
}

async function isLinkedToPurchaseOrder(restaurantId: string, inventoryId: string): Promise<boolean> {
  const snap = await getDocs(collection(db, COL.RESTAURANTS, restaurantId, RCOL.PURCHASE_ORDERS));
  return snap.docs.some((d) => {
    const data = d.data();
    if (data.status === "CANCELLED") return false;
    const lines: Array<{ itemId?: string | null }> = Array.isArray(data.items) ? data.items : [];
    return lines.some((line) => line?.itemId === inventoryId);
  });
}

function describeBlockingMovements(movements: StockMovement[]): string | null {
  const blocking = movements.filter((m) => !isAllowedMovementForDelete(m));
  if (blocking.length === 0) return null;
  const types = Array.from(new Set(blocking.map((m) =>
    m.referenceType === "PURCHASE_ORDER" ? "Purchase Order receive" : m.movementType
  )));
  return `It has stock history (${types.join(", ")}). Keep it archived so reports stay correct.`;
}

// ── Item ─────────────────────────────────────────

export async function checkItemPermanentDelete(
  restaurantId: string,
  item: InventoryItem
): Promise<PermanentDeleteCheck> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  const reasons: string[] = [];

  if (item.isActive !== false) reasons.push("Archive the item first.");

  const [movements, batches, openRequest, poLinked] = await Promise.all([
    getItemMovements(restaurantId, item.id),
    getItemBatches(restaurantId, item.id),
    hasOpenKitchenRequest(restaurantId, item.id),
    isLinkedToPurchaseOrder(restaurantId, item.id),
  ]);

  if (batches.some((b) => Number(b.quantity) !== 0)) {
    reasons.push("Some batches still have stock. Stock must be 0.");
  }
  const movementReason = describeBlockingMovements(movements);
  if (movementReason) reasons.push(movementReason);
  if (openRequest) reasons.push("A pending/approved kitchen request uses this item.");
  if (poLinked) reasons.push("A Purchase Order uses this item.");

  return { eligible: reasons.length === 0, reasons };
}

export async function permanentlyDeleteItem(
  restaurantId: string,
  item: InventoryItem
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const check = await checkItemPermanentDelete(restaurantId, item);
  if (!check.eligible) throw new Error(check.reasons.join(" "));

  // Re-verify the live item state right before deleting.
  const itemSnap = await getDoc(inventoryDoc(restaurantId, item.id));
  if (!itemSnap.exists()) throw new Error("Item not found — it may already be deleted");
  const liveItem = itemSnap.data();
  if (liveItem.isActive !== false) throw new Error("Item is no longer archived — nothing deleted");

  const [movements, batches] = await Promise.all([
    getItemMovements(restaurantId, item.id),
    getItemBatches(restaurantId, item.id),
  ]);
  if (batches.some((b) => Number(b.quantity) !== 0)) {
    throw new Error("A batch now has stock — nothing deleted");
  }

  const refs = [
    ...movements.map((m) => doc(stockMovementsCollection(restaurantId), m.id)),
    ...batches.map((b) => batchKeyDoc(restaurantId, normalizeBatchKey(item.id, b.batchNo))),
    ...batches.map((b) => batchDoc(restaurantId, b.id)),
    inventoryDoc(restaurantId, item.id),
  ];
  if (refs.length > MAX_WRITES_PER_BATCH) {
    throw new Error("This item has too many records to delete in one step — keep it archived");
  }

  const writes = writeBatch(db);
  for (const ref of refs) writes.delete(ref);
  await writes.commit();

  try {
    await syncStoreSummaryForItemChange(
      restaurantId,
      {
        totalValue: Number(liveItem.totalValue ?? 0),
        isLowStock: Boolean(liveItem.isLowStock),
        quantity:   Number(liveItem.currentStock ?? 0),
      },
      null
    );
  } catch (error) {
    console.warn("Permanent delete: store summary sync failed:", error);
  }
}

// ── Batch ────────────────────────────────────────

async function getBatchMovements(
  restaurantId: string,
  batch: InventoryBatch
): Promise<StockMovement[]> {
  const itemMovements = await getItemMovements(restaurantId, batch.inventoryId);
  return itemMovements.filter((m) => (m.batchAllocations ?? []).some((a) => a.batchId === batch.id));
}

export async function checkBatchPermanentDelete(
  restaurantId: string,
  batch: InventoryBatch
): Promise<PermanentDeleteCheck> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  const reasons: string[] = [];

  if (batch.isActive !== false) reasons.push("Archive the batch first.");
  if (Number(batch.quantity) !== 0) reasons.push("The batch still has stock. Stock must be 0.");

  const movements = await getBatchMovements(restaurantId, batch);
  const movementReason = describeBlockingMovements(movements);
  if (movementReason) reasons.push(movementReason);

  if (movements.some((m) => (m.batchAllocations ?? []).some((a) => a.batchId !== batch.id))) {
    reasons.push("One of its records also belongs to another batch.");
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function permanentlyDeleteBatch(
  restaurantId: string,
  batch: InventoryBatch
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const check = await checkBatchPermanentDelete(restaurantId, batch);
  if (!check.eligible) throw new Error(check.reasons.join(" "));

  // Re-verify the live batch state right before deleting.
  const batchSnap = await getDoc(batchDoc(restaurantId, batch.id));
  if (!batchSnap.exists()) throw new Error("Batch not found — it may already be deleted");
  const liveBatch = batchSnap.data();
  if (liveBatch.isActive !== false) throw new Error("Batch is no longer archived — nothing deleted");
  if (Number(liveBatch.quantity) !== 0) throw new Error("The batch now has stock — nothing deleted");

  const movements = await getBatchMovements(restaurantId, batch);

  const writes = writeBatch(db);
  for (const m of movements) writes.delete(doc(stockMovementsCollection(restaurantId), m.id));
  writes.delete(batchKeyDoc(restaurantId, normalizeBatchKey(batch.inventoryId, batch.batchNo)));
  writes.delete(batchDoc(restaurantId, batch.id));
  await writes.commit();
}