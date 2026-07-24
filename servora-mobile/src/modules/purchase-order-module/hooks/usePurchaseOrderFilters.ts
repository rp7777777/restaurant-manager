// ============================================
// SERVORA ERP — usePurchaseOrderFilters Hook
// ✅ ALL search/filter/sort logic lives here — kept separate from
//    usePurchaseOrders.ts (raw data only). Mirrors
//    useInventoryFilters.ts's structure exactly.
// ✅ Search — case-insensitive match on poNumber (e.g. "PO-0012").
// ✅ Status filter — single enum ("all" | PurchaseOrderStatus)
//    rather than independent booleans, so contradictory combos are
//    structurally impossible.
// ✅ Sort — by date (newest first), by total (high→low), by
//    poNumber (A-Z). Sorts a COPY, never mutates the original array.
// ✅ Date sort reads the actual createdAt Firestore Timestamp
//    (not poNumber) — stays correct even if the numbering scheme
//    ever changes, resets, or orders get data-migrated/imported
//    out of sequence. Docs with a still-pending serverTimestamp
//    (no .seconds yet) sort last rather than crashing.
// ✅ All setters wrapped in useCallback — safe to pass down to
//    child components without causing unnecessary re-renders.
// PHASE 8.2
// ============================================

import { useState, useMemo, useCallback } from "react";
import { PurchaseOrder, PurchaseOrderStatus } from "../types/purchase-order";

// createdAt is typed `unknown` (see purchase-order.ts) because the
// repository writes it via serverTimestamp(). At runtime it's a
// Firestore Timestamp once the write is confirmed — this narrows
// just enough to read `.seconds` without trusting the shape blindly.
function toMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  // Pending write (serverTimestamp not yet resolved locally) or
  // missing data — treat as oldest so it sorts to the bottom
  // instead of throwing or landing at the top.
  return 0;
}

export type PurchaseOrderSortOption =
  | "date-desc" | "total-desc" | "poNumber-asc";

export type PurchaseOrderStatusFilter = "all" | PurchaseOrderStatus;

export interface PurchaseOrderFilters {
  searchQuery: string;
  status:      PurchaseOrderStatusFilter;
  sort:        PurchaseOrderSortOption;
}

const DEFAULT_FILTERS: PurchaseOrderFilters = {
  searchQuery: "",
  status:      "all",
  sort:        "date-desc",
};

export interface UsePurchaseOrderFiltersResult {
  filters:         PurchaseOrderFilters;
  filteredOrders:  PurchaseOrder[];
  setSearchQuery:  (q: string) => void;
  setStatus:       (s: PurchaseOrderStatusFilter) => void;
  setSort:         (s: PurchaseOrderSortOption) => void;
  resetFilters:    () => void;
}

export function usePurchaseOrderFilters(
  orders: PurchaseOrder[]
): UsePurchaseOrderFiltersResult {
  const [filters, setFilters] = useState<PurchaseOrderFilters>(DEFAULT_FILTERS);

  const setSearchQuery = useCallback((q: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: q }));
  }, []);

  const setStatus = useCallback((s: PurchaseOrderStatusFilter) => {
    setFilters((prev) => ({ ...prev, status: s }));
  }, []);

  const setSort = useCallback((s: PurchaseOrderSortOption) => {
    setFilters((prev) => ({ ...prev, sort: s }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      result = result.filter((po) =>
        po.poNumber.toLowerCase().includes(q)
      );
    }

    if (filters.status !== "all") {
      result = result.filter((po) => po.status === filters.status);
    }

    const sorted = [...result];
    switch (filters.sort) {
      case "date-desc":
        sorted.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        break;
      case "total-desc":
        sorted.sort((a, b) => b.totalAmount - a.totalAmount);
        break;
      case "poNumber-asc":
        sorted.sort((a, b) => a.poNumber.localeCompare(b.poNumber));
        break;
    }

    return sorted;
  }, [orders, filters]);

  return {
    filters,
    filteredOrders,
    setSearchQuery,
    setStatus,
    setSort,
    resetFilters,
  };
}