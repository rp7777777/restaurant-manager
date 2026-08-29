// ============================================
// SERVORA ERP — DEV-ONLY: Duplicate Item Merge Service
// ⚠️ TEMPORARY — delete alongside dev-merge-duplicate-items.tsx
//    after the one-time repair is confirmed successful.
// ✅ Groups InventoryItem documents by (itemName.trim().toLowerCase()
//    + "|" + unit) — items must match BOTH name AND unit to be
//    considered duplicates of each other. This deliberately does
//    NOT attempt to merge across unit mismatches (e.g. a "beer"
//    batch that was incorrectly received onto a "pac"-unit item) —
//    those are reported for manual correction via the existing
//    "Move Batch to Correct Item" feature (moveBatchToItem()),
//    which already has the unit-compatibility guard and proper
//    transactional currentStock adjustment this script deliberately
//    does NOT duplicate.
// ✅ For each group with more than one item:
//    - The OLDEST item (by createdAt) is chosen as the "primary" —
//      all other items in the group are "duplicates" to merge INTO
//      it.
//    - Every duplicate's batches have their inventoryId/itemName
//      updated to point at the primary item (mirrors
//      moveBatchToItem()'s own batch-document update, but done in
//      bulk here since this is a one-time repair across potentially
//      many batches, not a single-batch user action).
//    - The primary item's currentStock is recomputed as the SUM of
//      all its now-consolidated ACTIVE batches' quantities (not
//      simply added from the duplicates' stated currentStock values,
//      since those may themselves be stale/incorrect — recomputing
//      from actual batch data is the authoritative approach).
//    - Duplicate items are DELETED once their batches are moved
//      (this is a one-time REPAIR of known-bad test data, explicitly
//      confirmed safe to delete — NOT the general behavior of any
//      user-facing feature).
// ✅ batchKeys (uniqueness-lock documents) are moved alongside their
//    batches, mirroring moveBatchToItem()'s own batchKey handling —
//    stale keys pointing at a deleted duplicate item would otherwise
//    permanently block that batchNo from ever being used again under
//    the primary item.
// ✅ Returns a detailed log array (not just a summary) — this is a
//    one-time repair script, so complete visibility into what
//    happened to each item/batch is more valuable than compactness.
// FROZEN (temporary)
// ============================================

import {
  collection, getDocs, doc, writeBatch, query,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";

function inventoryCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY);
}
function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
}
function batchKeysCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.BATCH_KEYS);
}

function normalizeBatchKey(inventoryId: string, batchNo: string): string {
  return `${inventoryId}__${batchNo.trim().toLowerCase()}`;
}

interface InventoryItemRow {
  id: string;
  itemName: string;
  unit: string;
  createdAt: any;
}

export async function mergeDuplicateInventoryItems(restaurantId: string): Promise<string[]> {
  const log: string[] = [];

  if (!restaurantId) {
    return ["❌ No restaurantId provided"];
  }

  // ── Load all items ──
  const itemsSnap = await getDocs(query(inventoryCollection(restaurantId)));
  const items: InventoryItemRow[] = itemsSnap.docs.map((d) => ({
    id: d.id,
    itemName: d.data().itemName ?? "",
    unit: d.data().unit ?? "",
    createdAt: d.data().createdAt ?? null,
  }));
  log.push(`Loaded ${items.length} inventory items.`);

  // ── Load all batches ──
  const batchesSnap = await getDocs(query(batchesCollection(restaurantId)));
  const allBatches = batchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  log.push(`Loaded ${allBatches.length} batches.`);

  // ── Group items by name+unit ──
  const groups = new Map<string, InventoryItemRow[]>();
  for (const item of items) {
    const key = `${item.itemName.trim().toLowerCase()}|${item.unit}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const duplicateGroups = Array.from(groups.entries()).filter(([, list]) => list.length > 1);
  log.push(`Found ${duplicateGroups.length} groups with duplicates.`);

  if (duplicateGroups.length === 0) {
    log.push("✅ No duplicates found — nothing to merge.");
    return log;
  }

  for (const [key, groupItems] of duplicateGroups) {
    // Oldest item = primary.
    const sorted = [...groupItems].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return aTime - bTime;
    });
    const primary = sorted[0];
    const duplicates = sorted.slice(1);

    log.push(`\n── Group "${key}" — primary: ${primary.itemName} (${primary.id}) ──`);

    for (const dup of duplicates) {
      const dupBatches = allBatches.filter((b) => b.inventoryId === dup.id);
      log.push(`  Duplicate ${dup.id}: ${dupBatches.length} batch(es) to move.`);

      const writer = writeBatch(db);

      for (const b of dupBatches) {
        const batchRef = doc(batchesCollection(restaurantId), b.id);
        writer.update(batchRef, {
          inventoryId: primary.id,
          itemName:    primary.itemName,
        });

        // Move batchKey lock document (old key → new key).
        if (b.batchNo) {
          const oldKeyId = normalizeBatchKey(dup.id, b.batchNo);
          const newKeyId = normalizeBatchKey(primary.id, b.batchNo);
          const oldKeyRef = doc(batchKeysCollection(restaurantId), oldKeyId);
          const newKeyRef = doc(batchKeysCollection(restaurantId), newKeyId);
          writer.delete(oldKeyRef);
          writer.set(newKeyRef, {
            inventoryId: primary.id,
            batchNo:     b.batchNo,
            batchId:     b.id,
            restaurantId,
          });
        }
      }

      // Delete the now-empty duplicate item.
      const dupItemRef = doc(inventoryCollection(restaurantId), dup.id);
      writer.delete(dupItemRef);

      await writer.commit();
      log.push(`  ✅ Moved ${dupBatches.length} batch(es) from ${dup.id} → ${primary.id}, deleted ${dup.id}.`);
    }

    // Recompute primary item's currentStock from ALL its (now
    // consolidated) ACTIVE batches.
    const primaryBatches = allBatches.filter(
      (b) => (b.inventoryId === primary.id || duplicates.some((d) => d.id === b.inventoryId)) && b.status === "ACTIVE"
    );
    const recomputedStock = primaryBatches.reduce((sum, b) => sum + (b.quantity ?? 0), 0);

    const primaryRef = doc(inventoryCollection(restaurantId), primary.id);
    const finalWriter = writeBatch(db);
    finalWriter.update(primaryRef, { currentStock: recomputedStock });
    await finalWriter.commit();

    log.push(`  ✅ Recomputed ${primary.itemName} currentStock = ${recomputedStock}`);
  }

  log.push(`\n✅ Merge complete.`);
  return log;
}