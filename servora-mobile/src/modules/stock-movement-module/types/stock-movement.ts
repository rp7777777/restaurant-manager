// ============================================
// SERVORA ERP — Stock Movement Types
// ✅ This is the ONLY intended entry point for changing an
//    inventory item's quantity going forward (once Phase 8 wires
//    the UI to use it).
// ✅ movementType — granular and report-friendly:
//    PURCHASE     → increases stock (from a received PO)
//    KITCHEN_ISSUE → decreases stock (issued to kitchen)
//    RETURN       → increases stock (returned back, unused)
//    WASTE        → decreases stock (spoilage/breakage)
//    ADJUSTMENT   → sets stock to an ABSOLUTE new value
//    TRANSFER_IN  → increases stock (from another location)
//    TRANSFER_OUT → decreases stock (to another location)
//    NOTE: "SALE" intentionally NOT included — requires a Recipe/
//    Menu Costing module that doesn't exist yet.
// ✅ unitCostAtTime — MANDATORY snapshot of the item's unitCost at
//    the moment of this movement. Never recomputed later.
// ✅ movementValue — server-computed = |quantityChanged| ×
//    unitCostAtTime, PRE-COMPUTED and stored — future valuation-
//    method changes never retroactively alter historical values.
// ✅ reasonCategory — named StockMovementReasonCategory (not
//    WasteReasonCategory) since structured reasons may apply to
//    ADJUSTMENT/RETURN/TRANSFER in the future too, not just WASTE.
//    Currently only WASTE's UI would populate this (enforced at the
//    service layer — see stock-movement-service.ts), but the type
//    itself stays generic so no rename is needed later.
// ✅ beforeQuantity/afterQuantity — always server-computed inside
//    the transaction, never trusted from the caller.
// ✅ createdByName/createdByRole — snapshot of who made the change,
//    readable even if the user account is later deleted.
// FROZEN
// ============================================

export type StockMovementType =
  | "PURCHASE"
  | "KITCHEN_ISSUE"
  | "RETURN"
  | "WASTE"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export type StockMovementReferenceType =
  | "PURCHASE_ORDER" | "KITCHEN_REQUEST" | "MANUAL";

// ── Structured reason category — generic name so it can extend
//    beyond WASTE to other movement types later without renaming. ──
export type StockMovementReasonCategory =
  | "EXPIRED"
  | "SPOILED"
  | "BROKEN"
  | "BURNT"
  | "PREPARATION_ERROR"
  | "CUSTOMER_RETURN"
  | "OTHER";

export interface StockMovement {
  id:               string;
  inventoryId:      string;
  itemName:         string;  // denormalized snapshot
  movementType:     StockMovementType;
  quantityChanged:  number;  // SIGNED — server-computed
  beforeQuantity:   number;  // server-computed, never trusted from caller
  afterQuantity:    number;  // server-computed, never trusted from caller
  unit:             string;
  unitCostAtTime:   number;  // MANDATORY snapshot — never re-derived later
  movementValue:    number;  // server-computed = |quantityChanged| × unitCostAtTime
  reasonCategory?:  StockMovementReasonCategory;
  referenceType?:   StockMovementReferenceType;
  referenceId?:     string;
  reason?:          string;  // free-text detail — REQUIRED when
                              // reasonCategory === "OTHER" (enforced
                              // in stock-movement-service.ts)
  restaurantId:     string;
  createdBy:        string;
  createdByName?:   string;
  createdByRole?:   string;
  createdAt?:       unknown;
}

export interface RecordStockMovementInput {
  inventoryId:      string;
  movementType:     StockMovementType;
  // For PURCHASE/KITCHEN_ISSUE/WASTE/RETURN/TRANSFER_IN/
  // TRANSFER_OUT: the amount to add/subtract (always positive).
  // For ADJUSTMENT: the new ABSOLUTE quantity (not a delta).
  quantity:         number;
  reasonCategory?:  StockMovementReasonCategory;
  referenceType?:   StockMovementReferenceType;
  referenceId?:     string;
  reason?:          string;
  createdByName?:   string;
  createdByRole?:   string;
}