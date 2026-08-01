// ============================================
// SERVORA ERP — Kitchen Request Service
// ✅ Kept for architectural consistency with the rest of Servora's
//    module pattern, even though it's currently a thin wrapper
//    around the repository — Kitchen request creation today only
//    writes to ONE collection (kitchenRequests), so there's no
//    cross-module orchestration yet (unlike purchase-order-service.ts,
//    which coordinates PurchaseOrder + Inventory + StockMovement
//    together during Receive).
// ✅ Reserved for FUTURE orchestration as the Kitchen ↔ Store ↔
//    Inventory workflow grows: multi-item submission already lives
//    here; later candidates include notifications, audit logging,
//    auto-Purchase-Order suggestions on low stock, and approval-
//    workflow logic — all things a repository (Firestore CRUD only)
//    shouldn't own.
// ✅ "At least one item" validation lives here rather than in the
//    repository, since it's a rule about the REQUEST AS A WHOLE
//    (the Chef's full submission), not about any single Firestore
//    write — matches how createPurchaseOrder's own per-item
//    validation sits at the boundary of what's being validated.
// ============================================

import {
  createKitchenRequest, CreateKitchenRequestInput,
} from "../repository/kitchen-repository";

export interface SendKitchenRequestItem {
  itemName: string;
  inventoryId?: string | null;
  categoryId?: string | null;
  closingStock: number;
  minimumLevel: number;
  orderQuantity: number;
  unit: string;
}

export interface SendKitchenRequestInput {
  items: SendKitchenRequestItem[];
  requiredDate: string;
  requestedBy: string;
  note: string;
  restaurantId: string;
  userId: string;
}

// ✅ Sends each item in the Chef's submission as its OWN separate
// kitchenRequest document — same one-request-per-item design the
// old index.tsx's for-loop already used (Store approves/rejects/
// issues each item independently, so they can't share one document).
export async function sendKitchenRequest(
  input: SendKitchenRequestInput
): Promise<string[]> {
  if (input.items.length === 0) {
    throw new Error("Add at least one item");
  }
  if (!input.restaurantId) {
    throw new Error("Restaurant not configured");
  }

  const createdIds: string[] = [];
  for (const item of input.items) {
    const createInput: CreateKitchenRequestInput = {
      itemName: item.itemName,
      inventoryId: item.inventoryId ?? null,
      categoryId: item.categoryId ?? null,
      closingStock: item.closingStock,
      minimumLevel: item.minimumLevel,
      orderQuantity: item.orderQuantity,
      unit: item.unit,
      requiredDate: input.requiredDate,
      requestedBy: input.requestedBy,
      note: input.note,
      restaurantId: input.restaurantId,
      userId: input.userId,
    };
    const id = await createKitchenRequest(createInput);
    createdIds.push(id);
  }
  return createdIds;
}