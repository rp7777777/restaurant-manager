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
// ✅ NEW — "expiringSoon" stock status option, added to support
//    InventoryStats' tap-to-filter behavior (tapping the "Expiring
//    Soon" stat card). Requires expiryContext (today's date +
//    category lookup + restaurant default alert days) since expiry
//    classification needs the same 3-tier priority logic used
//    everywhere else in this module (classifyExpiry/
//    resolveExpiryAlertDays from types/inventory.ts). expiryContext
//    is optional — if the caller doesn't pass it, items simply
//    can't match "expiringSoon" rather than throwing.
// ✅ "expiringSoon" here matches ONLY classifyExpiry's
//    "expiringSoon" status — NOT "expired". This matches standard
//    ERP practice (SAP/Odoo separate "Expiring Soon" from
//    "Expired" as distinct filters/reports) and stays consistent
//    with InventoryStats' card being explicitly labeled "Expiring
//    Soon" (not a broader "Needs Attention" grouping). An "Expired"
//    filter option is a natural future addition, not folded into
//    this one.
// ✅ expiryContext fields destructured individually in the useMemo
//    dependency array (not the whole object) — a fresh
//    expiryContext object from the caller on every render (even
//    with unchanged underlying values) would otherwise force a
//    recompute every time; depending on the primitive fields plus
//    the categoryMap reference is stable unless something actually
//    changed.
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
      result = result.filter((item) => item.isLowStock);
    } else if (filters.stockStatus === "outOfStock") {
      result = result.filter((item) => item.currentStock === 0);
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