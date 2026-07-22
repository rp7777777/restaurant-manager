// ============================================
// SERVORA ERP — Stock Movement Service
// ✅ THE ONLY function anywhere in Servora that changes an
//    inventory item's quantity.
// ✅ Fully transaction-safe — reads current quantity + writes new
//    quantity + writes the movement audit log ATOMICALLY.
// ✅ Validation enforced here:
//    PURCHASE/RETURN/TRANSFER_IN/KITCHEN_ISSUE/WASTE/TRANSFER_OUT
//    → quantity must be > 0
//    ADJUSTMENT → quantity (new absolute value) must be >= 0
//    reasonCategory === "OTHER" → reason (free text) is required
// ✅ Decreasing movements rejected outright if they'd push stock
//    below 0.
// ✅ unitCostAtTime is snapshotted from the item's CURRENT unitCost
//    at the moment of the transaction — never re-derived later.
// ✅ movementValue is pre-computed and stored (|quantityChanged| ×
//    unitCostAtTime), so future valuation-method changes never
//    retroactively alter historical movement values.
// ✅ totalValue/isLowStock on the inventory item are recomputed
//    here too, so they never drift out of sync with quantity.
// ✅ syncStoreSummaryForItemChange() is called after every
//    successful movement, using the SAME unitCostAtTime for both
//    the before and after totalValue (cost doesn't change during a
//    movement — only quantity does), keeping the Store Summary's
//    totalStockValue/lowStockCount/outOfStockCount in sync.
//    See inventory-repository.ts's header comment for the
//    architecture boundary: quantity ADJUSTMENTS always come
//    through here, never through updateInventoryItem().
// FROZEN
// ============================================

import {
  collection, doc, runTransaction, serverTimestamp,
  getDocs, onSnapshot, query, orderBy, where, limit,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  StockMovement,
  StockMovementType,
  RecordStockMovementInput,
} from "../types/stock-movement";
import { calculateInventoryTotalValue } from "../../inventory-module/types/inventory";
import { syncStoreSummaryForItemChange } from "../../store-module/services/store-summary-service";
import { InventorySummarySnapshot } from "../../store-module/types/store-summary";

function inventoryDoc(restaurantId: string, inventoryId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, inventoryId);
}

function stockMovementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

const INCREASING_TYPES: StockMovementType[] = ["PURCHASE", "RETURN", "TRANSFER_IN"];

// ── Validation — enforced here, not left to the caller ──
function validateInput(input: RecordStockMovementInput): void {
  if (!input.inventoryId) throw new Error("Inventory item is required");

  if (input.movementType === "ADJUSTMENT") {
    if (input.quantity < 0) {
      throw new Error("Adjusted quantity cannot be negative");
    }
  } else {
    if (input.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
  }

  // ✅ "OTHER" reason category requires a free-text explanation —
  // otherwise the record is unreportable/uninvestigable later.
  if (input.reasonCategory === "OTHER" && !input.reason?.trim()) {
    throw new Error("Please enter a reason.");
  }
}

// ── Defensive wrapper — never let a summary-sync error propagate
//    out and fail the actual stock movement that already committed. ──
async function safeSyncSummary(
  restaurantId: string,
  before: InventorySummarySnapshot | null,
  after: InventorySummarySnapshot | null,
): Promise<void> {
  try {
    await syncStoreSummaryForItemChange(restaurantId, before, after);
  } catch (error) {
    console.warn("Stock movement service: store summary sync failed:", error);
  }
}

// ── Record a stock movement — THE single entry point for changing
//    an inventory item's quantity. ──
export async function recordStockMovement(
  restaurantId: string,
  input: RecordStockMovementInput
): Promise<{ movementId: string; beforeQuantity: number; afterQuantity: number; movementValue: number }> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  validateInput(input);

  const itemRef     = inventoryDoc(restaurantId, input.inventoryId);
  const movementRef = doc(stockMovementsCollection(restaurantId));

  const result = await runTransaction(db, async (transaction) => {
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) {
      throw new Error("Inventory item not found");
    }

    const itemData       = itemSnap.data();
    const beforeQuantity  = Number(itemData.quantity  ?? 0);
    const unitCostAtTime  = Number(itemData.unitCost  ?? 0);
    const minStock        = Number(itemData.minStock  ?? 0);
    const unit            = itemData.unit             as string;
    const itemName        = itemData.itemName         as string;

    let afterQuantity: number;
    let quantityChanged: number;

    if (input.movementType === "ADJUSTMENT") {
      afterQuantity   = input.quantity;
      quantityChanged = afterQuantity - beforeQuantity;
    } else if (INCREASING_TYPES.includes(input.movementType)) {
      quantityChanged = input.quantity;
      afterQuantity   = beforeQuantity + input.quantity;
    } else {
      quantityChanged = -input.quantity;
      afterQuantity   = beforeQuantity - input.quantity;

      if (afterQuantity < 0) {
        throw new Error(
          `Cannot record this movement — only ${beforeQuantity}${unit} in stock, ` +
          `but ${input.quantity}${unit} was requested`
        );
      }
    }

    // ── Before/after values — SAME unitCostAtTime for both, since
    //    cost doesn't change during a movement, only quantity does. ──
    const beforeTotalValue = calculateInventoryTotalValue(beforeQuantity, unitCostAtTime);
    const beforeIsLowStock = beforeQuantity <= minStock;

    const totalValue        = calculateInventoryTotalValue(afterQuantity, unitCostAtTime);
    const isLowStock     = afterQuantity <= minStock;
    const movementValue = Math.round(Math.abs(quantityChanged) * unitCostAtTime * 100) / 100;

    transaction.update(itemRef, {
      quantity:   afterQuantity,
      totalValue,
      isLowStock,
      updatedAt:  serverTimestamp(),
    });

    transaction.set(movementRef, {
      inventoryId:     input.inventoryId,
      itemName,
      movementType:    input.movementType,
      quantityChanged,
      beforeQuantity,
      afterQuantity,
      unit,
      unitCostAtTime,
      movementValue,
      reasonCategory:  input.reasonCategory ?? null,
      referenceType:   input.referenceType  ?? null,
      referenceId:     input.referenceId    ?? null,
      reason:          input.reason?.trim() || null,
      restaurantId,
      createdBy:       auth.currentUser!.uid,
      createdByName:   input.createdByName ?? null,
      createdByRole:   input.createdByRole ?? null,
      createdAt:       serverTimestamp(),
    });

    return {
      beforeQuantity, afterQuantity, movementValue,
      beforeTotalValue, beforeIsLowStock,
      totalValue, isLowStock,
    };
  });

  // ✅ Sync Store Summary — outside the transaction (summary sync
  // has its own internal transaction), best-effort.
  await safeSyncSummary(
    restaurantId,
    { totalValue: result.beforeTotalValue, isLowStock: result.beforeIsLowStock, quantity: result.beforeQuantity },
    { totalValue: result.totalValue, isLowStock: result.isLowStock, quantity: result.afterQuantity }
  );

  return {
    movementId:     movementRef.id,
    beforeQuantity: result.beforeQuantity,
    afterQuantity:  result.afterQuantity,
    movementValue:  result.movementValue,
  };
}

// ── Movement history for one item ──
export async function getMovementsForItem(
  restaurantId: string,
  inventoryId: string,
  limitCount: number = 50
): Promise<StockMovement[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(
    query(
      stockMovementsCollection(restaurantId),
      where("inventoryId", "==", inventoryId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, "id">) }));
}

// ── Live recent movements across ALL items ──
export function subscribeRecentMovements(
  restaurantId: string,
  callback: (movements: StockMovement[]) => void,
  limitCount: number = 20,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(
      stockMovementsCollection(restaurantId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    ),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<StockMovement, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}