// ============================================
// SERVORA ERP — Inventory Utils
// ✅ Shared display/derivation helpers used across InventoryCard,
//    ItemDetailsDrawer, InventoryStatusBadge, and any future
//    component that needs the same stock-status/badge logic —
//    consolidated here so the priority order (Out of Stock > Low
//    Stock > Expired > Expiring Soon) is defined in exactly ONE
//    place and can never drift between components.
// ✅ resolveStockStatusLabel() — the single priority resolver.
//    Mirrors the exact badge-priority order that was previously
//    duplicated inline in InventoryCard.tsx's JSX conditionals.
// ✅ Deliberately does NOT duplicate classifyExpiry()/
//    resolveExpiryAlertDays() — those stay in types/inventory.ts as
//    the canonical expiry logic; this file only adds the STATUS
//    LABEL/COLOR/ICON layer on top of what those functions already
//    return.
// ✅ Pure functions only — no React, no hooks, no side effects.
//    Safe to import from components, hooks, or services alike.
// ✅ icon is a plain `string` (not MaterialIcons' glyphMap keyof) —
//    intentional trade-off so this utils file has zero dependency
//    on the UI icon library; components cast/use the string as
//    needed when rendering.
// ✅ STATUS_DISPLAY is Object.freeze()'d — prevents accidental
//    mutation of the shared lookup table from any importing file.
// FROZEN
// ============================================

import { InventoryItem, ExpiryStatus } from "../types/inventory";

export type StockStatusKind = "outOfStock" | "lowStock" | "expired" | "expiringSoon" | "normal";

export interface StockStatusDisplay {
  kind:  StockStatusKind;
  label: string;
  color: string;      // background color for badges
  icon:  string;       // MaterialIcons name (kept as string here to
                        // avoid importing @expo/vector-icons' type
                        // into a non-UI utils file)
}

const STATUS_DISPLAY: Record<StockStatusKind, Omit<StockStatusDisplay, "kind">> = Object.freeze({
  outOfStock:   { label: "Out of Stock",   color: "#dc2626", icon: "remove-shopping-cart" },
  lowStock:     { label: "Low Stock",      color: "#d97706", icon: "warning" },
  expired:      { label: "Expired",        color: "#991b1b", icon: "dangerous" },
  expiringSoon: { label: "Expiring Soon",  color: "#ea580c", icon: "schedule" },
  normal:       { label: "Normal",         color: "#059669", icon: "check-circle" },
});

// ── Resolve the SINGLE most important status for an item, given its
//    stock level and its already-classified expiry status. Priority
//    order (highest first): Out of Stock > Low Stock > Expired >
//    Expiring Soon > Normal. This is a single-badge resolver — use
//    this when you need ONE status to headline (e.g. a compact list
//    row). For showing ALL applicable badges at once (as
//    InventoryCard currently does), use resolveAllStockStatuses()
//    instead. ──
export function resolveStockStatus(
  item: InventoryItem,
  expiryStatus: ExpiryStatus
): StockStatusDisplay {
  const kind = resolveStockStatusKind(item, expiryStatus);
  return { kind, ...STATUS_DISPLAY[kind] };
}

function resolveStockStatusKind(item: InventoryItem, expiryStatus: ExpiryStatus): StockStatusKind {
  if (item.currentStock <= 0) return "outOfStock";
  if (item.isLowStock) return "lowStock";
  if (expiryStatus === "expired") return "expired";
  if (expiryStatus === "expiringSoon") return "expiringSoon";
  return "normal";
}

// ── Resolve ALL applicable statuses (not just the highest-priority
//    one) — matches InventoryCard's existing multi-badge display
//    (an item can be simultaneously Low Stock AND Expiring Soon,
//    and the card shows both). Out of Stock and Low Stock remain
//    mutually exclusive in the returned list (an out-of-stock item
//    is not also flagged "Low Stock" in the badge row — 0 is
//    definitionally low, showing both would be redundant in a
//    per-item badge list, unlike the aggregate InventoryStats counts
//    which intentionally count both). ──
export function resolveAllStockStatuses(
  item: InventoryItem,
  expiryStatus: ExpiryStatus
): StockStatusDisplay[] {
  const isOutOfStock = item.currentStock <= 0;
  const statuses: StockStatusKind[] = [];

  if (isOutOfStock) {
    statuses.push("outOfStock");
  } else if (item.isLowStock) {
    statuses.push("lowStock");
  }
  if (expiryStatus === "expired") statuses.push("expired");
  if (expiryStatus === "expiringSoon") statuses.push("expiringSoon");

  return statuses.map((kind) => ({ kind, ...STATUS_DISPLAY[kind] }));
}

// ── Whether an item has ANY attention-worthy status — used to
//    decide whether to render a badge row at all (avoids an empty
//    <View> when everything is normal). ──
export function hasAnyStockStatus(item: InventoryItem, expiryStatus: ExpiryStatus): boolean {
  return (
    item.currentStock <= 0 ||
    item.isLowStock ||
    expiryStatus === "expired" ||
    expiryStatus === "expiringSoon"
  );
}

// ── Format a quantity + unit for display, e.g. "12.5 kg". Centralizes
//    the "{number} {unit}" pattern repeated across InventoryCard,
//    ItemDetailsDrawer, and StockAdjustmentModal. ──
export function formatQuantity(quantity: number, unit: string): string {
  return `${quantity} ${unit}`;
}

// ── Display name for the "active" toggle — undefined/true both mean
//    active, per the type's documented contract. Centralizes this
//    so no component re-derives the undefined-means-active rule
//    independently. ──
export function isItemActive(item: InventoryItem): boolean {
  return item.isActive ?? true;
}