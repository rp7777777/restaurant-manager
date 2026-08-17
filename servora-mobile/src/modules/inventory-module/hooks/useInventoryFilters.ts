// ============================================
// SERVORA ERP — useInventoryFilters Hook
// ✅ ALL search/filter/sort/grouping logic lives here — kept
//    separate from useInventory.ts (raw data only).
// ✅ stockStatus is a single enum ("all" | "lowStock" |
//    "outOfStock" | "expiringSoon") instead of independent
//    booleans — this makes contradictory combinations structurally
//    impossible, rather than relying on the UI to avoid selecting
//    conflicting ones.
// ✅ All setters wrapped in useCallback — safe to pass down to
//    child components without causing unnecessary re-renders.
// ✅ Search — case-insensitive match on itemName.
// ✅ Sort — by name (A-Z), by stock level (low→high), by value
//    (high→low). Sorts a COPY, never mutates the original array.
// ✅ "expiringSoon" stock status option — supports InventoryStats'
//    tap-to-filter behavior. Requires expiryContext (today's date +
//    category lookup + restaurant default alert days); optional —
//    if the caller doesn't pass it, items simply can't match
//    "expiringSoon" rather than throwing.
// ✅ "expiringSoon" here matches ONLY classifyExpiry's
//    "expiringSoon" status — NOT "expired". Matches standard ERP
//    practice (SAP/Odoo separate "Expiring Soon" from "Expired") and
//    stays consistent with InventoryStats' card label.
// ✅ FIX — lowStock/outOfStock predicates now EXACTLY match
//    InventoryStats.tsx's mutually-exclusive classification rule:
//      currentStock <= 0              → Out of Stock (only)
//      currentStock > 0 && isLowStock → Low Stock (only)
//    Previously: lowStock matched isLowStock alone (an item with
//    currentStock === 0 AND isLowStock === true could appear in the
//    "Low Stock" filtered list even though the stats card's own
//    count excluded it under Out of Stock — tapping the card could
//    surface more items than its own displayed number); outOfStock
//    matched currentStock === 0 exactly rather than <= 0 (defensive
//    inconsistency — even though deductStockBatch()'s negative-
//    stock guard makes negative currentStock unreachable in normal
//    flow, using the same <= 0 comparison as InventoryStats.tsx
//    keeps both places expressing the identical rule, rather than
//    two subtly different ones that happen to agree only because of
//    an invariant enforced elsewhere). Now the stats card COUNT and
//    the filtered LIST always agree exactly, for both Low Stock and
//    Out of Stock.
// ✅ expiryContext fields destructured individually in the useMemo
//    dependency array (not the whole object) — avoids an
//    unnecessary recompute if the caller passes a fresh object
//    reference with unchanged underlying values on every render.
// FROZEN
// ============================================

import { useState, useMemo, useCallback } from "react";
import { InventoryItem, classifyExpiry, resolveExpiryAlertDays } from "../types/inventory";
import { Category } from "../types/category";

export type InventorySortOption =
  | "name-asc" | "stock-asc" | "value-desc";

export type InventoryStockStatus = "all" | "lowStock" | "outOfStock" | "expiringSoon";

export interface InventoryFilters {
  searchQuery:  string;
  categoryId:   string | null; // null = all categories
  stockStatus:  InventoryStockStatus;
  sort:         InventorySortOption;
}

export interface InventoryExpiryContext {
  todayISO:                          string;
  categoryMap:                       Map<string, Category>;
  restaurantDefaultExpiryAlertDays?: number;
}

const DEFAULT_FILTERS: InventoryFilters = {
  searchQuery: "",
  categoryId:  null,
  stockStatus: "all",
  sort:        "name-asc",
};

export interface UseInventoryFiltersResult {
  filters:        InventoryFilters;
  filteredItems:  InventoryItem[];
  setSearchQuery: (q: string) => void;
  setCategoryId:  (id: string | null) => void;
  setStockStatus: (s: InventoryStockStatus) => void;
  setSort:        (s: InventorySortOption) => void;
  resetFilters:   () => void;
}

export function useInventoryFilters(
  items: InventoryItem[],
  expiryContext?: InventoryExpiryContext
): UseInventoryFiltersResult {
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);

  const setSearchQuery = useCallback((q: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: q }));
  }, []);

  const setCategoryId = useCallback((id: string | null) => {
    setFilters((prev) => ({ ...prev, categoryId: id }));
  }, []);

  const setStockStatus = useCallback((s: InventoryStockStatus) => {
    setFilters((prev) => ({ ...prev, stockStatus: s }));
  }, []);

  const setSort = useCallback((s: InventorySortOption) => {
    setFilters((prev) => ({ ...prev, sort: s }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const filteredItems = useMemo(() => {
    let result = items;

    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      result = result.filter((item) =>
        item.itemName.toLowerCase().includes(q)
      );
    }

    if (filters.categoryId) {
      result = result.filter((item) => item.categoryId === filters.categoryId);
    }

    if (filters.stockStatus === "lowStock") {
      // ✅ FIX — matches InventoryStats.tsx exactly: > 0 AND
      // isLowStock, so Out of Stock items never appear here.
      result = result.filter((item) => item.currentStock > 0 && item.isLowStock);
    } else if (filters.stockStatus === "outOfStock") {
      // ✅ FIX — <= 0, not === 0, for defensive consistency with
      // InventoryStats.tsx's identical comparison.
      result = result.filter((item) => item.currentStock <= 0);
    } else if (filters.stockStatus === "expiringSoon") {
      if (expiryContext) {
        const { todayISO, categoryMap, restaurantDefaultExpiryAlertDays } = expiryContext;
        result = result.filter((item) => {
          const category = categoryMap.get(item.categoryId);
          const resolvedDays = resolveExpiryAlertDays(
            item.expiryAlertDaysOverride,
            category?.expiryAlertDays,
            restaurantDefaultExpiryAlertDays
          );
          const status = classifyExpiry(item.expiryDate, todayISO, resolvedDays);
          return status === "expiringSoon";
        });
      } else {
        // No expiry context supplied — nothing can match; avoids
        // silently showing the unfiltered list under an "Expiring
        // Soon" label.
        result = [];
      }
    }

    const sorted = [...result];
    switch (filters.sort) {
      case "name-asc":
        sorted.sort((a, b) => a.itemName.localeCompare(b.itemName));
        break;
      case "stock-asc":
        sorted.sort((a, b) => a.currentStock - b.currentStock);
        break;
      case "value-desc":
        sorted.sort((a, b) => b.totalValue - a.totalValue);
        break;
    }

    return sorted;
  }, [
    items,
    filters,
    expiryContext?.todayISO,
    expiryContext?.categoryMap,
    expiryContext?.restaurantDefaultExpiryAlertDays,
  ]);

  return {
    filters,
    filteredItems,
    setSearchQuery,
    setCategoryId,
    setStockStatus,
    setSort,
    resetFilters,
  };
}