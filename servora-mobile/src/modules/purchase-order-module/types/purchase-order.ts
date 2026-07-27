// ============================================
// SERVORA ERP — Purchase Order Types
// ✅ status transitions strictly validated at the repository layer
//    (DRAFT → PENDING → APPROVED → RECEIVED / CANCELLED) — a PO can
//    never be "received" twice or skip a valid step
// ✅ totalAmount/lineTotal always server-computed from
//    quantity × unitCost — never trusted from the caller
// ✅ quantity = ORDERED quantity (set at creation, before goods
//    arrive). receivedQty/lotNumber/expiryDate are populated ONLY
//    at receive time (APPROVED→RECEIVED transition) — actual
//    delivered amount often differs from what was ordered (e.g.
//    ordered 20kg, received 18.6kg), and Inventory must reflect
//    receivedQty, never the original ordered quantity.
// ✅ lineId — stable per-line identifier, server-generated at
//    creation (never client-supplied, never derived from array
//    position). Rows can be added/removed on the Create form, and
//    a plain array index would silently shift and mismatch once a
//    row is removed — lineId survives that. The Receive step
//    matches items by lineId, not by index.
// ✅ Kept receivedQty/lotNumber/expiryDate as optional fields on
//    the same PurchaseOrderItem rather than a separate ReceiveItem
//    type — avoids a parallel type to keep in sync; "empty until
//    received" is enforced at the service layer, not the type shape.
// PHASE 8.2b — added lineId, lotNumber, expiryDate, receivedQty
// FROZEN
// ============================================

export type PurchaseOrderStatus =
  | "DRAFT" | "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrderItem {
  lineId:       string;  // stable identifier — server-generated, survives add/remove/reorder
  itemId?:      string | null;  // optional link to an existing inventory item — null when free-text (Firestore rejects undefined)  // optional link to an existing inventory item
  itemName:     string;
  quantity:     number;  // ORDERED quantity, set at creation
  unit:         string;
  unitCost:     number;
  lineTotal:    number;  // server-computed
  // ── Populated ONLY at receive time (APPROVED → RECEIVED) ──
  receivedQty?: number;  // ACTUAL quantity delivered — may differ from quantity
  lotNumber?:   string;
  expiryDate?:  string;  // YYYY-MM-DD
}

export interface PurchaseOrder {
  id:                    string;
  poNumber:              string;  // e.g. "PO-0001", auto-generated
  supplierId:            string;
  items:                 PurchaseOrderItem[];
  totalAmount:           number;  // server-computed
  status:                PurchaseOrderStatus;
  expectedDeliveryDate?: string;  // YYYY-MM-DD
  receivedDate?:         string;  // YYYY-MM-DD
  restaurantId:          string;
  createdBy:             string;
  createdAt?:            unknown;
  updatedAt?:            unknown;
}

export interface CreatePurchaseOrderItemInput {
  itemId?:   string;
  itemName:  string;
  quantity:  number;
  unit:      string;
  unitCost:  number;
  // NOTE: no lineId here — the repository generates it at creation.
}

export interface CreatePurchaseOrderInput {
  supplierId:            string;
  items:                 CreatePurchaseOrderItemInput[];
  expectedDeliveryDate?: string;
}

// ── Receive Goods input — used at APPROVED→RECEIVED transition.
//    Keyed by lineId (not array index) so it stays correct even if
//    lines were removed/reordered after the PO was created. ──
export interface ReceivePurchaseOrderItemInput {
  lineId:      string;  // matches PurchaseOrderItem.lineId
  receivedQty: number;
  lotNumber?:  string;
  expiryDate?: string;  // YYYY-MM-DD
}

export interface ReceivePurchaseOrderInput {
  items: ReceivePurchaseOrderItemInput[];
}