// ============================================
// SERVORA ERP — Inventory Batch Types
// ✅ NEW SYSTEM (major feature) — batch-level stock tracking.
//    Each InventoryItem can now have MULTIPLE active batches
//    (e.g. Avocado purchased 02/08 with one expiry, then again
//    05/08 with a different batch number and expiry). Batches are
//    NEVER merged into each other — every purchase/stock-in creates
//    a new batch row, matching the Excel-style report where each
//    purchase date/batch number/expiry appears as its own line.
// ✅ InventoryItem.currentStock becomes a DERIVED total — the sum
//    of all active batches for that item. Still stored on the
//    InventoryItem document for fast reads, but always recomputed
//    from batches whenever a batch is created or its quantity
//    changes.
// ✅ FEFO (First-Expiry-First-Out) — the confirmed deduction order
//    for WASTE/KITCHEN_ISSUE/TRANSFER_OUT: consume from the batch
//    with the NEAREST expiryDate first. Batches without an
//    expiryDate sort last. TIE-BREAKER: when two batches share the
//    same expiryDate, the one received EARLIER (purchaseDate ASC)
//    is consumed first — standard ERP convention.
// ✅ status — a batch is not just "has quantity or doesn't":
//    ACTIVE       → normal, available for FEFO deduction
//    CLOSED       → manually closed out
//    EXPIRED      → past its expiryDate, excluded from FEFO
//    QUARANTINED  → held pending review, excluded from FEFO
//    RECALLED     → subject to a supplier/regulatory recall,
//                   excluded from FEFO
//    Only ACTIVE batches with quantity > 0 are eligible for FEFO
//    deduction — see isEligibleForFEFO().
// ✅ receivedDate vs purchaseDate — these can differ (a Purchase
//    Order may be placed on one date but goods physically arrive
//    later). receivedDate is what expiry/aging tracking and the
//    Excel-style batch table's "Date" column use.
// ✅ locationId — optional, forward-looking for multi-location
//    stock tracking. No location picker UI exists at this phase.
// ✅ notes — free-text batch-level context (e.g. "Package damaged").
// ✅ Depleted batches (quantity === 0) are RETAINED in Firestore for
//    audit history but EXCLUDED from "active batch" queries/UI —
//    see isActiveBatch(). This is orthogonal to status — a batch
//    can have quantity === 0 AND status "ACTIVE" (fully consumed
//    normally) or quantity > 0 AND status "RECALLED" (pulled before
//    consumption).
// ✅ unitCost is stored PER BATCH — different purchases of the same
//    item can have different costs.
// ✅ createdBy/updatedBy — every batch is attributable to the user
//    who created it AND, separately, to whoever last modified it
//    (quantity or status change). updatedBy is set by
//    inventory-batch-repository.ts's updateBatchQuantity()/
//    updateBatchStatus() — never by createInventoryBatch() (a fresh
//    batch has no "update" yet).
// FROZEN
// ============================================

export type InventoryBatchStatus =
  | "ACTIVE"
  | "CLOSED"
  | "EXPIRED"
  | "QUARANTINED"
  | "RECALLED";

export interface InventoryBatch {
  id:               string;
  inventoryId:      string;   // parent InventoryItem this batch belongs to
  itemName:         string;   // denormalized snapshot
  batchNo:          string;
  quantity:         number;   // remaining quantity in THIS batch
  originalQuantity: number;   // quantity when the batch was first created —
                               // never changes
  unit:             string;   // denormalized from the parent item at
                               // creation time
  unitCost:         number;   // this batch's purchase cost per unit
  purchaseDate:     string;   // YYYY-MM-DD — when the PO/order was placed
  receivedDate:     string;   // YYYY-MM-DD — when goods physically arrived
  expiryDate?:      string;   // YYYY-MM-DD — batch-level
  status:           InventoryBatchStatus;
  supplierId?:      string;
  locationId?:      string;   // forward-looking — no location picker UI yet
  notes?:           string;
  restaurantId:     string;
  createdBy?:        string;
  updatedBy?:        string;  // set on every quantity/status change after
                               // creation — see repository FROZEN header
  createdAt?:        unknown;
  updatedAt?:         unknown;
}

export interface CreateInventoryBatchInput {
  inventoryId:   string;
  itemName:      string;
  batchNo:       string;
  quantity:      number;
  unit:          string;
  unitCost:      number;
  purchaseDate:  string;
  receivedDate:  string;
  expiryDate?:   string;
  status?:       InventoryBatchStatus; // defaults to "ACTIVE" if omitted
  supplierId?:   string;
  locationId?:   string;
  notes?:        string;
}

// ── A batch is "active" (has remaining quantity, counts toward the
//    item's total stock) regardless of status. Depleted batches (0)
//    stay in Firestore for audit but are filtered out here. ──
export function isActiveBatch(batch: InventoryBatch): boolean {
  return batch.quantity > 0;
}

// ── A batch is eligible to be drawn from during FEFO deduction only
//    if it has remaining quantity AND its status is ACTIVE. ──
export function isEligibleForFEFO(batch: InventoryBatch): boolean {
  return batch.quantity > 0 && batch.status === "ACTIVE";
}

// ── Sum of all batches with remaining quantity for one item — this
//    is what InventoryItem.currentStock is kept in sync with. ──
export function calculateTotalFromBatches(batches: InventoryBatch[]): number {
  return batches
    .filter(isActiveBatch)
    .reduce((sum, batch) => sum + batch.quantity, 0);
}

// ── FEFO ordering — batches sorted with the nearest expiry first.
//    Batches with NO expiryDate sort LAST. TIE-BREAKER: batches
//    sharing the same expiryDate are ordered by receivedDate
//    ASCENDING. ──
export function sortBatchesByFEFO(batches: InventoryBatch[]): InventoryBatch[] {
  return [...batches].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) {
      return a.receivedDate.localeCompare(b.receivedDate);
    }
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;

    const expiryCompare = a.expiryDate.localeCompare(b.expiryDate);
    if (expiryCompare !== 0) return expiryCompare;

    return a.receivedDate.localeCompare(b.receivedDate);
  });
}