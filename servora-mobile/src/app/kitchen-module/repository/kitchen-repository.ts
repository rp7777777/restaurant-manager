// ============================================
// SERVORA ERP — Kitchen Repository
// ✅ Pure Firestore access — no business logic, no validation (that
//    lives in kitchen-request-service.ts).
// ✅ NEW — inventoryStockAtRequest added to CreateKitchenRequestInput
//    and the addDoc() write: a reference-only snapshot of
//    Inventory's currentStock at request time (when the item was
//    linked), stored SEPARATELY from closingStock (Kitchen's own
//    manually-entered physical count) — never used to override it.
// ============================================

import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, Unsubscribe,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { IngredientRequest } from "../types/kitchen-types";

function kitchenRequestsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.KITCHEN_REQUESTS);
}

export function subscribeKitchenRequests(
  restaurantId: string,
  onData: (requests: IngredientRequest[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    kitchenRequestsCollection(restaurantId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<IngredientRequest, "id">) })));
    },
    (err) => onError?.(err)
  );
}

export interface CreateKitchenRequestInput {
  itemName: string;
  inventoryId?: string | null;
  categoryId?: string | null;
  closingStock: number;
  inventoryStockAtRequest?: number | null;
  minimumLevel: number;
  orderQuantity: number;
  unit: string;
  requiredDate: string;
  requestedBy: string;
  note: string;
  restaurantId: string;
  userId: string;
}

export async function createKitchenRequest(
  input: CreateKitchenRequestInput
): Promise<string> {
  const ref = await addDoc(
    kitchenRequestsCollection(input.restaurantId),
    {
      itemName: input.itemName,
      inventoryId: input.inventoryId ?? null,
      categoryId: input.categoryId ?? null,
      closingStock: input.closingStock,
      inventoryStockAtRequest: input.inventoryStockAtRequest ?? null,
      minimumLevel: input.minimumLevel,
      orderQuantity: input.orderQuantity,
      unit: input.unit,
      requiredDate: input.requiredDate,
      requestedBy: input.requestedBy,
      note: input.note,
      status: "PENDING",
      restaurantId: input.restaurantId,
      userId: input.userId,
      createdAt: serverTimestamp(),
    }
  );
  return ref.id;
}