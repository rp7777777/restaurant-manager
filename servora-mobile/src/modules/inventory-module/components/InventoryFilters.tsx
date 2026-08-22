// ============================================
// SERVORA ERP — InventoryFilters Component
// ✅ Category chips + sort chips. Search box MOVED OUT to be
//    rendered inline alongside Stats (see InventoryScreen.tsx) —
//    this component no longer renders its own search row, per the
//    confirmed request to compact search into the Stats row and
//    reclaim vertical space for the table.
// FROZEN
// ============================================

import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  InventoryFilters as InventoryFilterState,
  InventorySortOption,
} from "../hooks/useInventoryFilters";
import { Category } from "../types/category";

const SORT_OPTIONS: { value: InventorySortOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "name-asc",   label: "Name",  icon: "sort-by-alpha" },
  { value: "stock-asc",  label: "Stock", icon: "trending-up" },
  { value: "value-desc", label: "Value", icon: "attach-money" },
];

interface InventoryFiltersProps {
  filters:          InventoryFilterState;
  categories:       Category[];
  setCategoryId:    (categoryId: string | null) => void;
  setSort:          (sort: InventorySortOption) => void;
}

export function InventoryFilters({
  filters, categories, setCategoryId, setSort,
}: InventoryFiltersProps) {
  return (
    <>
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
  categoryScroll: { marginTop: 8, maxHeight: 30 },
  categoryScrollContent: { paddingHorizontal: 16, gap: 6, alignItems: "center" },
  categoryChip: {
    height: 22,
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  categoryChipActive: { backgroundColor: "#1e293b", borderColor: "#1e293b" },
  categoryChipText: { fontSize: 10, fontWeight: "600", color: "#475569" },
  categoryChipTextActive: { color: "#fff" },
  sortRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, marginTop: 8,
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