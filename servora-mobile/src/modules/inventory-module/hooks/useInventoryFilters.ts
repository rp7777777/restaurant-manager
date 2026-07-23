// ============================================
// SERVORA ERP — useInventoryFilters Hook
// ✅ ALL search/filter/sort/grouping logic lives here — kept
//    separate from useInventory.ts (raw data only).
// ✅ stockStatus is a single enum ("all" | "lowStock" |
//    "outOfStock") instead of two independent booleans — this
//    makes the contradictory "both Low Stock AND Out of Stock"
//    combination structurally impossible, rather than relying on
//    the UI to avoid selecting both.
// ✅ All setters wrapped in useCallback — safe to pass down to
//    child components without causing unnecessary re-renders.
// ✅ Search — case-insensitive match on itemName.
// ✅ Sort — by name (A-Z), by stock level (low→high), by value
//    (high→low). Sorts a COPY, never mutates the original array.
// FROZEN
// ============================================

import { useState, useMemo, useCallback } from "react";
import { InventoryItem } from "../types/inventory";

export type InventorySortOption =
  | "name-asc" | "stock-asc" | "value-desc";

export type InventoryStockStatus = "all" | "lowStock" | "outOfStock";

export interface InventoryFilters {
  searchQuery:  string;
  categoryId:   string | null; // null = all categories
  stockStatus:  InventoryStockStatus;
  sort:         InventorySortOption;
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
  items: InventoryItem[]
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
  }, [items, filters]);

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