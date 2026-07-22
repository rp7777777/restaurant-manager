// ============================================
// SERVORA ERP — Inventory Types
// ✅ Backward compatible — same core fields as the existing
//    src/app/inventory-module/index.tsx screen
// ✅ expiryAlertDaysOverride — item-level override (HIGHEST
//    priority in the expiry-alert hierarchy)
// ✅ resolveExpiryAlertDays() — 3-tier priority: Item Override →
//    Category Setting → Restaurant Default → hardcoded 7-day
//    fallback. Consistent 0-means-disabled semantics at every tier.
// ✅ classifyExpiry() — compares Date OBJECTS (not raw date
//    strings) for both the "is expired" check and the day-count
//    difference, using the SAME two Date instances for both — a
//    malformed/non-zero-padded date string (e.g. "2026-7-3") would
//    silently break a raw string comparison, but Date parsing
//    handles it correctly either way, and reusing one comparison
//    method avoids any inconsistency between the two checks.
// ✅ Math.round (not floor/ceil) for the day-count — both dates are
//    normalized to local T00:00:00, so a normal day is exactly
//    86400000ms and round is a no-op. On a DST-transition day
//    (23 or 25 real hours), floor could round DOWN and undercount
//    by one day; round gives the correct nearest whole calendar day.
// FROZEN
// ============================================

export type InventoryCategory =
  | "Meat" | "Vegetables" | "Dairy" | "Dry Goods"
  | "Beverages" | "Sauces" | "Spices" | "Oils" | "Other";

export type InventoryUnit =
  | "kg" | "g" | "L" | "ml" | "pcs" | "box" | "bag" | "bottle" | "pac";

export interface InventoryItem {
  id:                       string;
  itemName:                 string;
  category:                 InventoryCategory;
  quantity:                 number;
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
  category:                 InventoryCategory;
  quantity:                 number;
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

// ── Expiry classification ──────────────────────
export type ExpiryStatus = "expired" | "expiringSoon" | "ok" | "none" | "disabled";

// ── Resolve the EFFECTIVE alert threshold for one item, following
//    the 3-tier priority. Consistent 0-means-disabled semantics at
//    every tier — a 0 at ANY tier stops the resolution immediately,
//    it never falls through to a lower tier. ──
export function resolveExpiryAlertDays(
  itemOverride: number | undefined,
  categoryDefault: number | undefined | null,
  restaurantDefault: number | undefined | null,
): number {
  const HARDCODED_FALLBACK = 7;

  if (itemOverride !== undefined && itemOverride !== null) {
    return itemOverride;
  }
  if (categoryDefault !== undefined && categoryDefault !== null) {
    return categoryDefault;
  }
  if (restaurantDefault !== undefined && restaurantDefault !== null) {
    return restaurantDefault;
  }
  return HARDCODED_FALLBACK;
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

  // ✅ Guard against malformed date strings (e.g. "abc",
  // "2026-13-40") producing Invalid Date — silently treat as
  // "no usable expiry data" rather than misclassifying or crashing.
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(today.getTime())) {
    return "none";
  }

  if (expiry < today) return "expired";

  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86400000);

  if (diffDays <= resolvedAlertDays) return "expiringSoon";
  return "ok";
}

// ── Shared inventory valuation helper — used by both
//    inventory-repository.ts and stock-movement-service.ts so
//    rounding rules (currently 2 decimals) live in exactly ONE
//    place. If this ever needs to change (e.g. 3 decimals, or
//    banker's rounding), both callers update automatically. ──
export function calculateInventoryTotalValue(
  quantity: number,
  unitCost: number
): number {
  return Math.round(quantity * unitCost * 100) / 100;
}