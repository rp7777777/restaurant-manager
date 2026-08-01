// ============================================
// SERVORA ERP — Kitchen Repository
// ✅ Pure Firestore access — no business logic, no validation (that
//    lives in kitchen-request-service.ts per the Phase 2 module
//    restructuring plan, matching how purchase-order-service.ts and
//    inventory-repository.ts already split these concerns).
// ✅ Moved verbatim (same collection path, same query, same field
//    writes) from the old kitchen-module/index.tsx — now using the
//    existing RCOL.KITCHEN_REQUESTS constant instead of the
//    hardcoded "kitchenRequests" string the old file used.
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

// ✅ Live subscription — same onSnapshot pattern the old index.tsx
// used directly; moved here so hooks/useKitchenRequests.ts can wrap
// it with React state instead of the screen doing so itself.
// ✅ onError signature matches the established real pattern already
// used in purchase-order-repository.ts's own subscription function —
// passes Firestore's actual Error through instead of discarding it.
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
  minimumLevel: number;
  orderQuantity: number;
  unit: string;
  requiredDate: string;
  requestedBy: string;
  note: string;
  restaurantId: string;
  userId: string;
}

// ✅ Single-item create — same field writes as the old index.tsx's
// addDoc() call, including the `?? null` (never undefined) handling
// for inventoryId/categoryId. Looping over multiple items to send a
// multi-item request stays the caller's job (kitchen-request-service.ts),
// same as the old code's own for-loop did.
// ✅ Returns the created document's id, matching the established
// convention in both purchase-order-repository.ts and
// inventory-repository.ts's own create functions (neither returns
// Promise<void> — both hand back the new id).
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