// ============================================
// SERVORA ERP — Inventory Types
// ✅ MIGRATION 1: quantity → currentStock — canonical field name
//    across ALL Store Module files.
// ✅ MIGRATION 2: category (hardcoded string union) → categoryId
//    (reference to the real Category collection from Phase 2 —
//    inventory-module/types/category.ts). InventoryCategory union
//    type REMOVED entirely — superseded by real Category documents
//    (id, name, departmentId, expiryAlertDays, isSystem).
// ✅ Both migrations need the one-time data migration script
//    (separate file — migrate-inventory-schema.ts) run once against
//    existing Firestore documents. Idempotent (safe to re-run).
// ✅ DEFAULT_EXPIRY_ALERT_DAYS — exported shared constant, replacing
//    the magic number that was local to resolveExpiryAlertDays().
// ✅ expiryAlertDaysOverride — item-level override (HIGHEST
//    priority in the expiry-alert hierarchy)
// ✅ resolveExpiryAlertDays() — 3-tier priority: Item Override →
//    Category Setting → Restaurant Default → DEFAULT_EXPIRY_ALERT_DAYS.
// ✅ classifyExpiry() — Date-object comparison, NaN guard.
// ✅ calculateInventoryTotalValue() — shared rounding helper.
// FROZEN
// ============================================

export type InventoryUnit =
  | "kg" | "g" | "L" | "ml" | "pcs" | "box" | "bag" | "bottle" | "pac";

export interface InventoryItem {
  id:                       string;
  itemName:                 string;
  categoryId:               string;  // reference to Category document
  currentStock:             number;
  unit:                     InventoryUnit;
  unitCost:                 number;
  totalValue:               number;
  minStock:                 number;
  isLowStock:               boolean;
  expiryDate?:              string;  // YYYY-MM-DD
  expiryAlertDaysOverride?: number;  // item-level override — highest priority
  batchNo?:                 string;
  storageLocation?:         string;
  supplierId?:              string;
  restaurantId:             string;
  userId?:                  string;
  createdAt?:               unknown;
  updatedAt?:               unknown;
}

export interface CreateInventoryItemInput {
  itemName:                 string;
  categoryId:               string;
  currentStock:             number;
  unit:                     InventoryUnit;
  unitCost:                 number;
  minStock:                 number;
  expiryDate?:              string;
  expiryAlertDaysOverride?: number;
  batchNo?:                 string;
  storageLocation?:         string;
  supplierId?:              string;
}

export type UpdateInventoryItemInput = Partial<CreateInventoryItemInput>;

// ── Shared inventory valuation helper — used by both
//    inventory-repository.ts and stock-movement-service.ts so
//    rounding rules live in exactly ONE place. ──
export function calculateInventoryTotalValue(
  currentStock: number,
  unitCost: number
): number {
  return Math.round(currentStock * unitCost * 100) / 100;
}

// ── Expiry classification ──────────────────────
export type ExpiryStatus = "expired" | "expiringSoon" | "ok" | "none" | "disabled";

// ── Shared fallback constant — replaces the magic number that was
//    previously local to resolveExpiryAlertDays(). ──
export const DEFAULT_EXPIRY_ALERT_DAYS = 7;

// ── Resolve the EFFECTIVE alert threshold for one item, following
//    the 3-tier priority. Consistent 0-means-disabled semantics at
//    every tier — a 0 at ANY tier stops the resolution immediately,
//    it never falls through to a lower tier. ──
export function resolveExpiryAlertDays(
  itemOverride: number | undefined,
  categoryDefault: number | undefined | null,
  restaurantDefault: number | undefined | null,
): number {
  if (itemOverride !== undefined && itemOverride !== null) {
    return itemOverride;
  }
  if (categoryDefault !== undefined && categoryDefault !== null) {
    return categoryDefault;
  }
  if (restaurantDefault !== undefined && restaurantDefault !== null) {
    return restaurantDefault;
  }
  return DEFAULT_EXPIRY_ALERT_DAYS;
}

// ── Classify an item's expiry status using its resolved threshold.
//    Returns "disabled" if the resolved threshold is 0. Both the
//    "is expired" check and the day-count difference use the SAME
//    two Date objects (built once), never a raw string comparison. ──
export function classifyExpiry(
  expiryDate: string | undefined,
  todayISO: string,
  resolvedAlertDays: number,
): ExpiryStatus {
  if (!expiryDate) return "none";
  if (resolvedAlertDays === 0) return "disabled";

  const today  = new Date(`${todayISO}T00:00:00`);
  const expiry = new Date(`${expiryDate}T00:00:00`);

  if (Number.isNaN(expiry.getTime()) || Number.isNaN(today.getTime())) {
    return "none";
  }

  if (expiry < today) return "expired";

  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86400000);

  if (diffDays <= resolvedAlertDays) return "expiringSoon";
  return "ok";
}