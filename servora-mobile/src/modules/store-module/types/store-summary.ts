// ============================================
// SERVORA ERP — Store Summary Types
// ✅ Hybrid design:
//    - Incremental fields (totalItems, totalStockValue,
//      lowStockCount, outOfStockCount) — maintained via
//      syncStoreSummaryForItemChange() whenever inventory changes
//    - Time-dependent fields (expiring/expired counts) are NEVER
//      persisted here — computed fresh on-demand (getExpiryCounts())
//      every time the UI needs them.
// ✅ lastCalculatedAt: Timestamp | null — matches the
//    dashboard-service.ts convention for read-time timestamps.
// FROZEN
// ============================================

import { Timestamp } from "firebase/firestore";

export interface StoreSummary {
  totalItems:       number;
  totalStockValue:  number;
  lowStockCount:    number;
  outOfStockCount:  number;
  lastCalculatedAt: Timestamp | null;
}

// ── Minimal snapshot of an inventory item's summary-relevant
//    fields, used by syncStoreSummaryForItemChange() to compute
//    deltas. `null` for `before` means "item didn't exist yet"
//    (create); `null` for `after` means "item no longer exists"
//    (delete). ──
export interface InventorySummarySnapshot {
  totalValue: number;
  isLowStock: boolean;
  quantity:   number;
}

export interface ExpiryCounts {
  expiringSoon: number;
  expired:      number;
}

// ── Separate interface (not merged into StoreSummary) — future
//    additions (pendingTransfers, pendingSupplierInvoices,
//    pendingStockAdjustments, pendingWasteApprovals) can extend
//    this without touching StoreSummary's schema at all. ──
export interface PendingCounts {
  pendingKitchenRequests: number;
  approvedPurchaseOrders: number;
}