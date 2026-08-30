// ============================================
// SERVORA ERP — DEV-ONLY: Fix Inactive/Stale-Stock Items
// ⚠️ TEMPORARY — delete after the one-time repair is confirmed
//    successful.
//
// ✅ Reconciliation script, NOT a manual data patch.
// ✅ currentStock is rebuilt from actual inventoryBatches.
// ✅ Uses the existing isActiveBatch() invariant:
//    batch.quantity > 0.
//    IMPORTANT: batch.status === "ACTIVE" is NOT used because
//    status represents FEFO issuability, not stock existence.
//
// ✅ Fix A:
//    If an item is inactive but has remaining stock (> 0),
//    restore isActive = true.
//
// ✅ Fix B:
//    Recompute currentStock and isLowStock for ALL inventory items,
//    so stale currentStock values are repaired globally.
//
// ✅ Does NOT modify batches, batchKeys, duplicate "(Copy)" items,
//    or movement history.
//
// ✅ Batches pre-grouped by inventoryId ONCE (not re-scanned per
//    item) — this is a one-time repair, but at restaurant scale
//    (many items × many batches) grouping once avoids unnecessary
//    quadratic scanning.
// ✅ batch.quantity parsed via Number() + Number.isFinite() guard —
//    a malformed/non-numeric quantity is skipped rather than
//    silently producing NaN and corrupting the recomputed total.
//
// FROZEN — temporary DEV repair
// ============================================

import { collection, getDocs, doc, writeBatch, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { isActiveBatch } from "../types/inventory-batch";

function inventoryCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY);
}

function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
}

export async function fixInactiveAndStaleStockItems(
  restaurantId: string
): Promise<string[]> {
  const log: string[] = [];

  if (!restaurantId) {
    return ["❌ No restaurantId provided"];
  }

  // --------------------------------------------
  // 1. Load inventory items
  // --------------------------------------------
  const itemsSnap = await getDocs(query(inventoryCollection(restaurantId)));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  log.push(`Loaded ${items.length} inventory items.`);

  // --------------------------------------------
  // 2. Load all inventory batches once
  // --------------------------------------------
  const batchesSnap = await getDocs(query(batchesCollection(restaurantId)));
  const allBatches = batchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  log.push(`Loaded ${allBatches.length} batches.`);

  // --------------------------------------------
  // 3. Group batches by inventoryId once
  // --------------------------------------------
  const batchesByInventoryId = new Map<string, any[]>();
  for (const batch of allBatches) {
    if (!batch.inventoryId) continue;
    const list = batchesByInventoryId.get(batch.inventoryId) ?? [];
    list.push(batch);
    batchesByInventoryId.set(batch.inventoryId, list);
  }

  let fixedCount = 0;

  // --------------------------------------------
  // 4. Reconcile every inventory item
  // --------------------------------------------
  for (const item of items) {
    const itemBatches = batchesByInventoryId.get(item.id) ?? [];

    // Existing Servora invariant: only batches with quantity > 0
    // contribute to currentStock.
    const activeBatches = itemBatches.filter(isActiveBatch);

    const recomputedStock = activeBatches.reduce((sum, batch) => {
      const quantity = Number(batch.quantity);
      return Number.isFinite(quantity) ? sum + quantity : sum;
    }, 0);

    const minStock = Number(item.minStock ?? 0);
    const recomputedIsLowStock = recomputedStock > 0 && recomputedStock <= minStock;

    // Fix A — restore accidentally inactive item.
    const wasIncorrectlyInactive = item.isActive === false && recomputedStock > 0;

    // Fix B — repair stale stock flags.
    const stockChanged = Number(item.currentStock ?? 0) !== recomputedStock;
    const lowStockChanged = Boolean(item.isLowStock) !== recomputedIsLowStock;

    if (!wasIncorrectlyInactive && !stockChanged && !lowStockChanged) continue;

    const updates: Record<string, any> = {
      currentStock: recomputedStock,
      isLowStock:   recomputedIsLowStock,
    };
    if (wasIncorrectlyInactive) {
      updates.isActive = true;
    }

    const writer = writeBatch(db);
    writer.update(doc(inventoryCollection(restaurantId), item.id), updates);
    await writer.commit();

    fixedCount++;
    log.push(
      `✅ ${item.itemName} (${item.id}): ` +
      `${wasIncorrectlyInactive ? "isActive false→true, " : ""}` +
      `currentStock ${item.currentStock ?? 0}→${recomputedStock}, ` +
      `isLowStock ${item.isLowStock ?? false}→${recomputedIsLowStock}`
    );
  }

  log.push(
    `\n✅ Reconciliation complete. ${fixedCount} item(s) updated, ${items.length - fixedCount} already consistent.`
  );

  return log;
}