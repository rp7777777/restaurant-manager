// ============================================
// SERVORA ERP — Firestore Collection Constants
// ✅ All collection names in one place
// ✅ No magic strings anywhere
// ✅ INVENTORY_CATEGORIES added for the Store Module rebuild
//    (separate from EXPENSE_CATEGORIES, which is unrelated)
// ✅ INVENTORY_BATCHES added for the batch-level stock tracking
//    system (FEFO). Separate collection from INVENTORY — batches
//    are children of inventory items but modeled as a flat
//    restaurant-level subcollection (queried by inventoryId field,
//    not nested under each item) for simpler cross-item queries.
// ✅ NEW — BATCH_KEYS added for concurrency-safe duplicate-batchNo
//    prevention. A deterministic-ID lock document
//    (`{inventoryId}_{normalizedBatchNo}`) is created inside the
//    same transaction as the batch itself, in this SEPARATE
//    collection — never the batch document's own ID. This lets
//    Firestore transactions detect two concurrent "receive the same
//    batch number for the same item" attempts (the second
//    transaction's `transaction.get()` on the lock document sees
//    the first one's write and aborts) WITHOUT ever tying the
//    actual InventoryBatch document's own ID to its batchNo value —
//    so correcting a typo'd batchNo later (correctBatchDetails())
//    never requires moving/recreating the batch document itself,
//    only swapping which batch_keys lock document points at it.
// FROZEN
// ============================================

// ── Top-level collections ─────────────────────
export const COL = {
  RESTAURANTS: "restaurants",
  STATS:       "stats",
  USERS:       "users",
} as const;

// ── Restaurant subcollections ─────────────────
export const RCOL = {
  SALES:               "sales",
  EXPENSES:             "expenses",
  EXPENSE_CATEGORIES:   "expense-categories",
  ATTENDANCE:           "attendance",
  PAYROLL:              "payroll",
  EMPLOYEES:            "employees",
  SCHEDULES:            "schedules",
  INVENTORY:            "inventory",
  INVENTORY_BATCHES:    "inventoryBatches",
  BATCH_KEYS:           "batchKeys",
  DEPARTMENTS:          "departments",
  INVENTORY_CATEGORIES: "categories",
  KITCHEN:              "kitchen",
  KITCHEN_REQUESTS:     "kitchenRequests",
  PURCHASE_ORDERS:      "purchaseOrders",
  SUPPLIERS:            "suppliers",
  STOCK_MOVEMENTS:      "stockMovements",
  STORE:                "store",
  ACTIVITY_LOGS:        "activityLogs",
  HACCP:                "haccp",
  DOCUMENTS:            "documents",
  CONTRACTS:            "contracts",
  LICENSES:             "licenses",
  CERTIFICATES:         "certificates",
} as const;

// ── Stats subcollections ──────────────────────
export const SCOL = {
  YEARLY:  "yearly",
  MONTHLY: "monthly",
  DAILY:   "daily",
} as const;

// ── Activity log subcollections ───────────────
export const ACOL = {
  ENTRIES: "entries",
} as const;