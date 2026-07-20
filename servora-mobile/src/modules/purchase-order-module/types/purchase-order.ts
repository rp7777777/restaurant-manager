// ============================================
// SERVORA ERP — Purchase Order Types
// ✅ status transitions strictly validated at the repository layer
//    (DRAFT → PENDING → APPROVED → RECEIVED / CANCELLED) — a PO can
//    never be "received" twice or skip a valid step
// ✅ totalAmount/lineTotal always server-computed from
//    quantity × unitCost — never trusted from the caller
// FROZEN
// ============================================

export type PurchaseOrderStatus =
  | "DRAFT" | "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrderItem {
  itemId?:    string;  // optional link to an existing inventory item
  itemName:   string;
  quantity:   number;
  unit:       string;
  unitCost:   number;
  lineTotal:  number;  // server-computed
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
}

export interface CreatePurchaseOrderInput {
  supplierId:            string;
  items:                 CreatePurchaseOrderItemInput[];
  expectedDeliveryDate?: string;
}