// ============================================
// SERVORA ERP — Kitchen Request Service
// ✅ Kitchen creates the request (PENDING); Store approves/rejects/
//    issues it — ALL workflow logic lives here, not split into
//    app/store-module/index.tsx. StoreScreen is a pure UI layer:
//    button press → call one of these functions → show loading/
//    success/error → let the live subscription refresh.
// ✅ Strict status transitions, enforced here:
//      PENDING  → APPROVED (approveKitchenRequest)
//      PENDING  → REJECTED (rejectKitchenRequest)
//      APPROVED → ISSUED   (issueKitchenRequest)
//    Any other transition throws.
// ✅ approveKitchenRequest() / rejectKitchenRequest() NEVER touch
//    inventory. Only issueKitchenRequest() causes a real stock
//    movement.
// ✅ issueKitchenRequest() is FULLY TRANSACTIONAL and FEFO-aware:
//    read request (verify APPROVED) → read item (verify active) →
//    read item's batches (pre-discovered IDs, same documented
//    pre-transaction-query pattern batch-allocation-service.ts
//    uses) → FEFO allocation via the SAME pure helpers
//    (sortBatchesByFEFO/isEligibleForFEFO) inventory-service.ts's
//    deductStockBatch() uses — no duplicated FEFO logic, same
//    source of truth → write batch quantities → write item
//    currentStock + isLowStock (same computeIsLowStock() formula as
//    every other stock-changing path) → write a StockMovement
//    (movementType: "KITCHEN_ISSUE", referenceType:
//    "KITCHEN_REQUEST", referenceId: the request's own id,
//    batchAllocations populated) → write request status → "ISSUED".
//    All writes commit together or none do.
// ✅ deductStockBatch() itself is DELIBERATELY NOT called/modified —
//    its transaction can't be composed with this file's kitchen-
//    request-status write. Duplicating the ORCHESTRATION (a
//    transaction that also writes to kitchenRequests) while reusing
//    the pure FEFO CALCULATION functions keeps Inventory module
//    generic and Kitchen module's own workflow transaction separate.
// ✅ FIX — request.inventoryId vs the inventoryId this call is
//    issuing against are now cross-checked BEFORE any read of the
//    inventory item. Previously, if a request already had an
//    inventoryId recorded and the caller passed a DIFFERENT one,
//    the function would silently deduct stock from the WRONG item
//    while leaving the request's own inventoryId field untouched —
//    a serious cross-item data-integrity risk. Now this mismatch
//    throws immediately.
// ✅ FIX — quantity is now validated against the request's own
//    orderQuantity (the amount that was actually approved) BEFORE
//    any inventory read. Previously a caller could pass ANY
//    quantity at issue time regardless of what was requested/
//    approved — e.g. issuing 25kg against a 10kg approved request,
//    as long as enough stock existed. Now issuing more than
//    orderQuantity throws.
// ⚠️ DOCUMENTED, ACCEPTED LIMITATIONS (not fixed here — matches
//    existing, already-frozen Inventory architecture exactly, not
//    new Kitchen-specific gaps):
//    - currentStock (item-level) vs. the ELIGIBLE (ACTIVE, quantity
//      > 0) batch total are two different numbers by design — a
//      batch that's quantity > 0 but has a non-ACTIVE status (e.g.
//      QUARANTINED) counts toward currentStock but is NOT FEFO-
//      eligible. This is the exact same behavior deductStockBatch()
//      itself has (see its own FROZEN header) — Kitchen Issue is
//      not introducing a new inconsistency, it's correctly matching
//      the existing one. The error message below distinguishes
//      "total stock" from "eligible batch stock" so this doesn't
//      read as a bug to whoever handles the error.
//    - Pre-transaction batch-ID discovery has the same documented
//      race-window as batch-allocation-service.ts/
//      deductStockBatch(): a batch created by a truly concurrent
//      receiveBatch() between the ID query and this transaction's
//      commit isn't considered as an FEFO candidate by THIS issue.
//      currentStock itself remains correct (read fresh inside the
//      transaction) — only FEFO's choice of which batch to draw
//      from in that narrow window is affected, never the resulting
//      stock quantity's correctness.
//    - Quantity/unit precision (floating-point arithmetic on
//      decimal quantities; whether integer-only units like "pcs"
//      should reject fractional amounts) is a cross-cutting
//      Inventory-architecture concern shared by deductStockBatch()
//      itself, receiveBatch(), and correctBatchDetails() — not
//      something to solve ad-hoc inside Kitchen. Deferred to a
//      future centralized quantity-normalization utility.
//    - closingStock/minimumLevel captured on a kitchen request are
//      a REQUEST-TIME SNAPSHOT for context/audit only — never
//      treated as authoritative current inventory state anywhere in
//      this file.
// ============================================

import {
  createKitchenRequest, CreateKitchenRequestInput,
} from "../repository/kitchen-repository";
import { db, auth } from "../../../firebase";
import {
  doc, collection, runTransaction, query, where, getDocs, serverTimestamp,
} from "firebase/firestore";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  InventoryBatch,
  isEligibleForFEFO,
  sortBatchesByFEFO,
} from "../../../modules/inventory-module/types/inventory-batch";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";

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

// ⚠️ NOT atomic across multiple items (documented, not fixed here —
// see review): each item becomes its own kitchenRequests document
// via a separate createKitchenRequest() call. A failure partway
// through leaves earlier items created and later ones missing. This
// is acceptable for now because request CREATION never mutates
// inventory (unlike issueKitchenRequest()) — the risk is a
// confusing partial request list, not a data-integrity/stock issue.
// A future redesign (one request document containing multiple line
// items) would remove this gap entirely; out of scope for this pass.
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

function kitchenRequestDoc(restaurantId: string, requestId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.KITCHEN_REQUESTS, requestId);
}

function inventoryDoc(restaurantId: string, itemId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY, itemId);
}

function batchDoc(restaurantId: string, batchId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES, batchId);
}

function batchesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_BATCHES);
}

function stockMovementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

// Same formula as inventory-repository.ts / inventory-service.ts /
// stock-movement-service.ts.
function computeIsLowStock(currentStock: number, minStock: number): boolean {
  return currentStock > 0 && currentStock <= minStock;
}

// ── Approve — PENDING → APPROVED. Never touches inventory. ──
export async function approveKitchenRequest(
  restaurantId: string,
  requestId: string,
  approverName: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const requestRef = kitchenRequestDoc(restaurantId, requestId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(requestRef);
    if (!snap.exists()) throw new Error("Request not found");

    const status = snap.data().status;
    if (status !== "PENDING") {
      throw new Error(`Cannot approve — request is already ${status}`);
    }

    transaction.update(requestRef, {
      status: "APPROVED",
      approvedBy: approverName,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// ── Reject — PENDING → REJECTED. Never touches inventory. ──
export async function rejectKitchenRequest(
  restaurantId: string,
  requestId: string,
  rejecterName: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const requestRef = kitchenRequestDoc(restaurantId, requestId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(requestRef);
    if (!snap.exists()) throw new Error("Request not found");

    const status = snap.data().status;
    if (status !== "PENDING") {
      throw new Error(`Cannot reject — request is already ${status}`);
    }

    transaction.update(requestRef, {
      status: "REJECTED",
      rejectedBy: rejecterName,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// ── Issue — APPROVED → ISSUED. THE ONLY function that deducts
//    inventory. Fully transactional, FEFO-aware. ──
export interface IssueKitchenRequestInput {
  restaurantId: string;
  requestId: string;
  inventoryId: string;
  quantity: number;
  issuerName: string;
  issueNote?: string;
}

export interface IssueKitchenRequestResult {
  movementId: string;
  newCurrentStock: number;
}

export async function issueKitchenRequest(
  input: IssueKitchenRequestInput
): Promise<IssueKitchenRequestResult> {
  const { restaurantId, requestId, inventoryId, quantity, issuerName, issueNote } = input;

  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  const actorUid = auth.currentUser.uid;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Issue quantity must be a valid positive number");
  }

  const requestRef = kitchenRequestDoc(restaurantId, requestId);
  const itemRef = inventoryDoc(restaurantId, inventoryId);
  const movementRef = doc(stockMovementsCollection(restaurantId));

  const idQuerySnap = await getDocs(
    query(batchesCollection(restaurantId), where("inventoryId", "==", inventoryId))
  );
  const batchIds = idQuerySnap.docs.map((d) => d.id);

  const result = await runTransaction(db, async (transaction) => {
    // ── ALL READS FIRST ──
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) throw new Error("Request not found");

    const requestData = requestSnap.data();
    if (requestData.status !== "APPROVED") {
      throw new Error(`Cannot issue — request is ${requestData.status}, not APPROVED`);
    }

    // ✅ FIX — inventoryId cross-check, BEFORE reading the
    // inventory item. If the request already has an inventoryId
    // recorded, the caller must be issuing against that SAME item —
    // a mismatch here would otherwise silently deduct the wrong
    // item's stock while leaving the request pointed at a different
    // one.
    if (requestData.inventoryId && requestData.inventoryId !== inventoryId) {
      throw new Error("Cannot issue — selected inventory item does not match the request");
    }

    // ✅ FIX — cannot issue more than what was actually requested/
    // approved.
    const requestedQuantity = Number(requestData.orderQuantity ?? 0);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      throw new Error("Request has an invalid requested quantity");
    }
    if (quantity > requestedQuantity) {
      throw new Error(`Cannot issue ${quantity} — request quantity is only ${requestedQuantity}`);
    }

    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error("Inventory item not found");

    const itemData = itemSnap.data();
    if ((itemData.isActive ?? true) === false) {
      throw new Error("Cannot issue — this inventory item is archived");
    }

    const beforeQuantity: number = itemData.currentStock ?? 0;
    if (beforeQuantity < quantity) {
      throw new Error(`Cannot issue ${quantity} — only ${beforeQuantity} in stock`);
    }

    const batchRefs = batchIds.map((id) => batchDoc(restaurantId, id));
    const batchSnaps = await Promise.all(batchRefs.map((ref) => transaction.get(ref)));
    const allBatches: InventoryBatch[] = batchSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...(s.data() as Omit<InventoryBatch, "id">) }));

    const eligibleBatches = sortBatchesByFEFO(allBatches.filter(isEligibleForFEFO));
    const eligibleTotal = eligibleBatches.reduce((sum, b) => sum + b.quantity, 0);

    if (eligibleTotal < quantity) {
      // ✅ Clarified message — distinguishes "total stock" from
      // "eligible batch stock," since these are legitimately
      // different numbers by design (see FROZEN header).
      throw new Error(
        `Cannot issue ${quantity} — only ${eligibleTotal} available from eligible batches (total recorded stock is ${beforeQuantity})`
      );
    }

    let remainingToDeduct = quantity;
    const allocations: { batchId: string; batchNo: string; deducted: number; remaining: number }[] = [];
    for (const batch of eligibleBatches) {
      if (remainingToDeduct <= 0) break;
      const deductFromThisBatch = Math.min(batch.quantity, remainingToDeduct);
      allocations.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        deducted: deductFromThisBatch,
        remaining: batch.quantity - deductFromThisBatch,
      });
      remainingToDeduct -= deductFromThisBatch;
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.deducted, 0);
    if (totalAllocated !== quantity) {
      throw new Error(
        `Allocation mismatch — requested ${quantity} but allocated ${totalAllocated}. Issue aborted.`
      );
    }

    // ── ALL WRITES AFTER ALL READS ──
    for (const allocation of allocations) {
      transaction.update(batchDoc(restaurantId, allocation.batchId), {
        quantity: allocation.remaining,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid,
      });
    }

    const afterQuantity = beforeQuantity - quantity;
    const minStock: number = Number(itemData.minStock ?? 0);
    const isLowStock = computeIsLowStock(afterQuantity, minStock);

    transaction.update(itemRef, {
      currentStock: afterQuantity,
      isLowStock,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });

    const batchAllocations: BatchAllocationRecord[] = allocations.map((a) => ({
      batchId: a.batchId,
      batchNo: a.batchNo,
      quantity: a.deducted,
    }));

    const unitCost: number = Number(itemData.unitCost ?? 0);
    transaction.set(movementRef, {
      inventoryId,
      itemName: itemData.itemName,
      movementType: "KITCHEN_ISSUE",
      quantityChanged: -quantity,
      beforeQuantity,
      afterQuantity,
      unit: itemData.unit,
      unitCostAtTime: unitCost,
      movementValue: Math.round(quantity * unitCost * 100) / 100,
      reasonCategory: null,
      referenceType: "KITCHEN_REQUEST",
      referenceId: requestId,
      reason: issueNote?.trim() || null,
      batchAllocations,
      restaurantId,
      createdBy: actorUid,
      createdByName: issuerName,
      createdByRole: null,
      createdAt: serverTimestamp(),
    });

    transaction.update(requestRef, {
      status: "ISSUED",
      issuedQuantity: quantity,
      issuedBy: issuerName,
      issuedAt: serverTimestamp(),
      issueNote: issueNote?.trim() || null,
      updatedAt: serverTimestamp(),
      ...(requestData.inventoryId ? {} : { inventoryId }),
    });

    return { newCurrentStock: afterQuantity };
  });

  return { movementId: movementRef.id, newCurrentStock: result.newCurrentStock };
}