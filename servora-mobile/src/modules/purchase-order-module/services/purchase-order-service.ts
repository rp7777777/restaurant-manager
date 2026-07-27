// ============================================
// SERVORA ERP — Purchase Order Service
// ✅ Cross-module orchestration layer — same role as
//    store-module/services/*.ts. Kept OUT of
//    purchase-order-repository.ts (which is FROZEN and Firestore-
//    only for the PurchaseOrder document itself) because Receiving
//    goods touches THREE modules' data (PurchaseOrder, Inventory,
//    StockMovement), not just one.
// ✅ NOT a single Firestore transaction across all three modules —
//    Inventory writes (createInventoryItem/updateInventoryItem) and
//    Stock Movement writes (recordStockMovement) already have their
//    OWN internal transaction-safety (see those files' FROZEN
//    headers). Wrapping a third-party transaction around
//    already-transactional operations doesn't add safety, and
//    Firestore transactions can't span this many reads/writes
//    reliably anyway. This is an orchestrated multi-step flow
//    instead: each step is safe on its own, and receivePurchaseOrder
//    validates status LAST-known-good before starting so a stale
//    read can't silently corrupt things.
// ✅ Order of operations per item matters:
//    1. If linked to an existing Inventory item (itemId set):
//       update its unitCost/expiryDate/batchNo FIRST (never touch
//       currentStock here — see inventory-repository.ts's own
//       header: quantity changes MUST go through
//       recordStockMovement, never updateInventoryItem).
//       Then call recordStockMovement — it reads the item's
//       CURRENT unitCost as unitCostAtTime, so the price must
//       already be updated by the time this runs, or the movement
//       would snapshot the OLD price.
//    2. If NOT linked (free-text item, no itemId): create a brand
//       new Inventory item via createInventoryItem with
//       currentStock = receivedQty directly (its initial stock),
//       then STILL record a stock movement for audit consistency
//       — every unit that enters Inventory should have a
//       corresponding movement record, whether the item already
//       existed or not.
// ✅ referenceType "PURCHASE_ORDER" + referenceId = the PO's id on
//    every movement this creates, so a StockMovement can always be
//    traced back to the PO that caused it.
// ✅ Finally, the PO itself is updated: items[] gets receivedQty/
//    lotNumber/expiryDate merged in per lineId, status → RECEIVED,
//    receivedDate set. This write happens LAST — if any Inventory/
//    Stock Movement step above fails, the PO is left exactly as it
//    was (still APPROVED), so the receive can simply be retried
//    rather than leaving a half-received PO with no way to redo it.
// ✅ Approve/Cancel are also routed through here (thin wrappers
//    around the FROZEN repository's updatePurchaseOrderStatus) —
//    a single stable place to later add an approvedBy/approvedAt
//    stamp, notifications, or audit logging without touching the
//    FROZEN repository or any screen that calls it.
// ============================================

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { getPurchaseOrderById, updatePurchaseOrderStatus } from "../repository/purchase-order-repository";
import {
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
} from "../../inventory-module/repository/inventory-repository";
import { recordStockMovement } from "../../stock-movement-module/services/stock-movement-service";
import { InventoryUnit } from "../../inventory-module/types/inventory";

function purchaseOrderDoc(restaurantId: string, poId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.PURCHASE_ORDERS, poId);
}

export interface ReceivePurchaseOrderLineOptions {
  lineId:      string;
  receivedQty: number;
  lotNumber?:  string;
  expiryDate?: string;
  // The price now known from the supplier's bill — often unknown at
  // order time (order-time unitCost may have been 0/estimate).
  // Omit to keep whatever unitCost was already on the PO line.
  unitCost?:   number;
  // Only required when this PO line has no itemId (free-text item
  // being received for the first time) — the category the new
  // Inventory item should be filed under, and the minimum stock
  // threshold to give it. Ignored (and unnecessary) for lines that
  // already have an itemId.
  newItemCategoryId?: string;
  newItemMinStock?:   number;
}

export interface ReceivePurchaseOrderOptions {
  lines: ReceivePurchaseOrderLineOptions[];
}

export async function receivePurchaseOrder(
  restaurantId: string,
  poId: string,
  options: ReceivePurchaseOrderOptions
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const po = await getPurchaseOrderById(restaurantId, poId);
  if (!po) throw new Error("Purchase order not found");
  if (po.status !== "APPROVED") {
    throw new Error(
      `Cannot receive goods — purchase order is ${po.status}, not APPROVED`
    );
  }

  const lineByLineId = new Map(options.lines.map((l) => [l.lineId, l]));

  // ── Validate every PO line has a matching receive input before
  //    writing anything — fail fast rather than partially process. ──
  for (const item of po.items) {
    const line = lineByLineId.get(item.lineId);
    if (!line) {
      throw new Error(`Missing receive data for item "${item.itemName}"`);
    }
    if (!Number.isFinite(line.receivedQty) || line.receivedQty <= 0) {
      throw new Error(`"${item.itemName}": received quantity must be a positive number`);
    }
    if (!item.itemId && !line.newItemCategoryId) {
      throw new Error(
        `"${item.itemName}" isn't linked to an existing Inventory item — ` +
        `choose a category to add it as a new item`
      );
    }
  }

  // ── Step 1: for each line, update/create the Inventory item and
  //    record the stock movement. Sequential (not parallel) so a
  //    failure partway through stops cleanly rather than racing. ──
  for (const item of po.items) {
    const line = lineByLineId.get(item.lineId)!;

    if (item.itemId) {
      // ── Existing item — update cost/expiry/batch FIRST, then
      //    record the movement (which snapshots the NOW-current
      //    unitCost). ──
      const existing = await getInventoryItemById(restaurantId, item.itemId);
      if (!existing) {
        throw new Error(
          `"${item.itemName}" was linked to an Inventory item that no longer exists`
        );
      }

      await updateInventoryItem(restaurantId, item.itemId, existing, {
        unitCost:   (line.unitCost !== undefined && line.unitCost > 0) ? line.unitCost : existing.unitCost,
        expiryDate: line.expiryDate,
        batchNo:    line.lotNumber,
      });

      await recordStockMovement(restaurantId, {
        inventoryId:   item.itemId,
        movementType:  "PURCHASE",
        quantity:      line.receivedQty,
        referenceType: "PURCHASE_ORDER",
        referenceId:   poId,
      });
    } else {
      // ── New item — create it with the received quantity as its
      //    starting stock, then still log a movement for audit
      //    consistency (every unit in Inventory traces to a
      //    movement, whether the item is brand-new or not). ──
      const newItemId = await createInventoryItem(restaurantId, {
        itemName:     item.itemName,
        categoryId:   line.newItemCategoryId!,
        currentStock: line.receivedQty,
        unit:         item.unit as InventoryUnit,
        unitCost:     (line.unitCost !== undefined && line.unitCost > 0) ? line.unitCost : item.unitCost,
        minStock:     line.newItemMinStock ?? 0,
        expiryDate:   line.expiryDate,
        batchNo:      line.lotNumber,
      });

      await recordStockMovement(restaurantId, {
        inventoryId:   newItemId,
        movementType:  "PURCHASE",
        quantity:      line.receivedQty,
        referenceType: "PURCHASE_ORDER",
        referenceId:   poId,
      });
    }
  }

  // ── Step 2: only after every Inventory/Stock Movement write has
  //    succeeded, mark the PO itself as RECEIVED with the per-item
  //    receive data merged in — including any price now known from
  //    the supplier's bill, so the PO's own record reflects reality
  //    rather than the original order-time estimate. ──
  const updatedItems = po.items.map((item) => {
    const line = lineByLineId.get(item.lineId)!;
    const finalUnitCost = (line.unitCost !== undefined && line.unitCost > 0)
      ? line.unitCost
      : item.unitCost;
    return {
      ...item,
      unitCost:    finalUnitCost,
      lineTotal:   Math.round(line.receivedQty * finalUnitCost * 100) / 100,
      receivedQty: line.receivedQty,
      lotNumber:   line.lotNumber ?? null,
      expiryDate:  line.expiryDate ?? null,
    };
  });
  const updatedTotalAmount = Math.round(
    updatedItems.reduce((sum, i) => sum + i.lineTotal, 0) * 100
  ) / 100;

  await updateDoc(purchaseOrderDoc(restaurantId, poId), {
    items:        updatedItems,
    totalAmount:  updatedTotalAmount,
    status:       "RECEIVED",
    receivedDate: new Date().toISOString().slice(0, 10),
    updatedAt:    serverTimestamp(),
  });
}

// ── Approve / Cancel — thin wrappers around the FROZEN repository's
//    generic updatePurchaseOrderStatus(). Routing these through the
//    service (rather than the UI calling the repository directly)
//    gives a single, stable place to later add things Approve/Cancel
//    will likely need — an approvedBy/approvedAt stamp, a
//    notification, an audit-log entry, or a role/permission check —
//    without touching the FROZEN repository or every screen that
//    calls it. Today they do nothing extra beyond the status change
//    itself; that's expected to change here first. ──
export async function approvePurchaseOrder(
  restaurantId: string,
  poId: string
): Promise<void> {
  await updatePurchaseOrderStatus(restaurantId, poId, "APPROVED");
}

export async function cancelPurchaseOrder(
  restaurantId: string,
  poId: string
): Promise<void> {
  await updatePurchaseOrderStatus(restaurantId, poId, "CANCELLED");
}