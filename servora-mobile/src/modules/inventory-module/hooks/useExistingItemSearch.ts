// ============================================
// SERVORA ERP — useExistingItemSearch Hook
// ✅ NEW — powers the "Add Item" form's Supplier → Category →
//    Search-Existing-Item flow. Mirrors kitchen-module's
//    useItemSearch.ts pattern (debounced text search, category-
//    scoped), but purpose-built for THIS form's confirmed
//    requirement: search is ONLY active once a category has been
//    selected, and only searches items WITHIN that category —
//    matching the confirmed design ("Category select नभएसम्म
//    existing-item search/list देखाउँदैनौँ").
// ✅ Does NOT exclude archived/zero-stock items (unlike Kitchen's
//    useItemSearch.ts) — this form's purpose is finding an existing
//    item to RECEIVE MORE STOCK into, so an archived or currently-
//    empty item is a perfectly valid, expected match (that's often
//    exactly why someone is receiving a new batch for it).
// FROZEN
// ============================================

import { useState, useEffect, useMemo } from "react";
import { InventoryItem } from "../types/inventory";

export interface UseExistingItemSearchResult {
  searchQuery:          string;
  setSearchQuery:       (q: string) => void;
  matches:              InventoryItem[];
}

export function useExistingItemSearch(
  items: InventoryItem[],
  categoryId: string | null
): UseExistingItemSearchResult {
  const [searchQuery, setSearchQueryRaw] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const setSearchQuery = (q: string) => setSearchQueryRaw(q);

  const matches = useMemo(() => {
    if (!categoryId) return [];
    const categoryItems = items.filter((it) => it.categoryId === categoryId);
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return categoryItems.slice(0, 20);
    return categoryItems
      .filter((it) => it.itemName.toLowerCase().includes(q))
      .slice(0, 20);
  }, [items, categoryId, debouncedQuery]);

  return { searchQuery, setSearchQuery, matches };
}