// ============================================
// SERVORA ERP — Firestore Collection Constants
// ✅ All collection names in one place
// ✅ No magic strings anywhere
// ✅ KITCHEN_REQUESTS/PURCHASE_ORDERS/SUPPLIERS/STOCK_MOVEMENTS
//    added for the Store Module rebuild
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
  SALES:              "sales",
  EXPENSES:            "expenses",
  EXPENSE_CATEGORIES:  "expense-categories",
  ATTENDANCE:          "attendance",
  PAYROLL:             "payroll",
  EMPLOYEES:           "employees",
  SCHEDULES:           "schedules",
  INVENTORY:           "inventory",
  KITCHEN:             "kitchen",
  KITCHEN_REQUESTS:    "kitchenRequests",
  PURCHASE_ORDERS:     "purchaseOrders",
  SUPPLIERS:           "suppliers",
  STOCK_MOVEMENTS:     "stockMovements",
  STORE:               "store",
  ACTIVITY_LOGS:       "activityLogs",
  HACCP:               "haccp",
  DOCUMENTS:           "documents",
  CONTRACTS:           "contracts",
  LICENSES:            "licenses",
  CERTIFICATES:        "certificates",
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