// ============================================
// SERVORA ERP — InventoryFilters Component
// ✅ EVOLUTIONARY EXTRACTION — search box, stock status filter
//    chips, category filter chips, and sort chips.
// ✅ Pure presentation — all filter STATE lives in
//    useInventoryFilters.ts, owned by InventoryScreen.tsx. This
//    component only renders the current `filters` values and calls
//    the setters passed in as props.
// ✅ STOCK_FILTER_OPTIONS / SORT_OPTIONS constants moved here from
//    InventoryScreen.tsx since they're this component's own
//    rendering data, not screen-level state.
// ✅ Category chip list stays conditionally rendered
//    (`categories.length > 0`).
// ✅ The hook's filter-state interface is named InventoryFilters —
//    same name as this component. Imported aliased as
//    InventoryFilterState to avoid a naming collision.
// ✅ "Expiring Soon" added to STOCK_FILTER_OPTIONS, matching the
//    "expiringSoon" InventoryStockStatus value in
//    useInventoryFilters.ts. Lets a user select this filter
//    directly from the chip row too, not only via tapping
//    InventoryStats' "Expiring Soon" card — both paths land on the
//    exact same filter state.
// ✅ FIX — filterScrollContent no longer sets flexDirection: "row"
//    (a horizontal ScrollView's content is already laid out as a
//    row; the explicit value was redundant). Spacing between chips
//    now comes from `gap` alone — the per-chip `marginRight: 8` was
//    removed to avoid double-spacing when both were present
//    together.
// FROZEN
// ============================================

import React from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  InventoryFilters as InventoryFilterState,
  InventoryStockStatus,
  InventorySortOption,
} from "../hooks/useInventoryFilters";
import { Category } from "../types/category";

const STOCK_FILTER_OPTIONS: { value: InventoryStockStatus; label: string }[] = [
  { value: "all",          label: "All" },
  { value: "lowStock",     label: "Low Stock" },
  { value: "outOfStock",   label: "Out of Stock" },
  { value: "expiringSoon", label: "Expiring Soon" },
];

const SORT_OPTIONS: { value: InventorySortOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "name-asc",   label: "Name",  icon: "sort-by-alpha" },
  { value: "stock-asc",  label: "Stock", icon: "trending-up" },
  { value: "value-desc", label: "Value", icon: "attach-money" },
];

interface InventoryFiltersProps {
  filters:          InventoryFilterState;
  categories:       Category[];
  setSearchQuery:   (query: string) => void;
  setCategoryId:    (categoryId: string | null) => void;
  setStockStatus:   (status: InventoryStockStatus) => void;
  setSort:          (sort: InventorySortOption) => void;
}

export function InventoryFilters({
  filters, categories, setSearchQuery, setCategoryId, setStockStatus, setSort,
}: InventoryFiltersProps) {
  return (
    <>
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={filters.searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items..."
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {STOCK_FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.filterChip,
              filters.stockStatus === opt.value && styles.filterChipActive,
            ]}
            onPress={() => setStockStatus(opt.value)}
          >
            <Text style={[
              styles.filterChipText,
              filters.stockStatus === opt.value && styles.filterChipTextActive,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              filters.categoryId === null && styles.categoryChipActive,
            ]}
            onPress={() => setCategoryId(null)}
          >
            <Text style={[
              styles.categoryChipText,
              filters.categoryId === null && styles.categoryChipTextActive,
            ]}>
              All Categories
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                filters.categoryId === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[
                styles.categoryChipText,
                filters.categoryId === cat.id && styles.categoryChipTextActive,
              ]}>
                {cat.icon} {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.sortChip,
              filters.sort === opt.value && styles.sortChipActive,
            ]}
            onPress={() => setSort(opt.value)}
          >
            <MaterialIcons
              name={opt.icon}
              size={13}
              color={filters.sort === opt.value ? "#fff" : "#64748b"}
            />
            <Text style={[
              styles.sortChipText,
              filters.sort === opt.value && styles.sortChipTextActive,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },
  filterScroll: { marginTop: 10 },
  filterScrollContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#e2e8f0",
  },
  filterChipActive: { backgroundColor: "#0369a1" },
  filterChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  filterChipTextActive: { color: "#fff" },
  categoryScroll: { marginTop: 10 },
  categoryScrollContent: { paddingHorizontal: 16, gap: 8 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  categoryChipActive: { backgroundColor: "#1e293b", borderColor: "#1e293b" },
  categoryChipText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  categoryChipTextActive: { color: "#fff" },
  sortRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, marginTop: 10,
  },
  sortLabel: { fontSize: 12, fontWeight: "700", color: "#94a3b8", marginRight: 2 },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  sortChipActive: { backgroundColor: "#0369a1" },
  sortChipText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  sortChipTextActive: { color: "#fff" },
});