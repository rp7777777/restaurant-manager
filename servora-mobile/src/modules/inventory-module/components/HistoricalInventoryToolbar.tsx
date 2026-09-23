// ============================================
// SERVORA ERP — HistoricalInventoryToolbar Component
// ✅ PURE PRESENTATION — the controls row + date navigator shown above
//    the inventory table. Owns ONLY its own UI state
//    (showCategoryDropdown). Search/category/sort values and all date
//    navigation logic stay with the parent — this component just
//    renders them and calls the given handlers.
// ✅ Controls order: Category dropdown | Search | Name | Stock |
//    Full Screen. Wraps gracefully on narrow widths (flexWrap).
// ✅ Category dropdown: high zIndex/elevation so it renders ABOVE the
//    table, kept as a ScrollView (nestedScrollEnabled) so a long
//    category list scrolls WITHIN the dropdown, opens from the left.
// ✅ Date navigator: compact pill "<  [calendar] Today  Wed, 23 Sep 2026  >"
//    centered over the table (same maxWidth as the table). The full
//    date sub-label shows on Today only (past dates already show the
//    full date as their main label).
// ✅ Rendered by the parent OUTSIDE the table's vertical ScrollView,
//    so the controls row and the date pill stay fixed while the table
//    scrolls.
// ============================================

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Category } from "../types/category";

export type HistoricalSortOption = "name-asc" | "stock-asc";

interface HistoricalInventoryToolbarProps {
  maxWidth:          number;
  isHistorical:      boolean;
  categories:        Category[];
  categoryId:        string | null;
  setCategoryId:     (id: string | null) => void;
  searchQuery:       string;
  setSearchQuery:    (q: string) => void;
  sort:              HistoricalSortOption;
  setSort:           (s: HistoricalSortOption) => void;
  onOpenFullScreen?: () => void;
  dateLabel:         string;
  reportDateLabel:   string;
  onPreviousDay:     () => void;
  onNextDay:         () => void;
  isNextDayDisabled: boolean;
}

export function HistoricalInventoryToolbar({
  maxWidth, isHistorical, categories, categoryId, setCategoryId,
  searchQuery, setSearchQuery, sort, setSort, onOpenFullScreen,
  dateLabel, reportDateLabel, onPreviousDay, onNextDay, isNextDayDisabled,
}: HistoricalInventoryToolbarProps) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const theme = isHistorical
    ? { accent: "#1e3a5f", chipActive: "#1e3a5f" }
    : { accent: "#059669", chipActive: "#1e293b" };

  const selectedCategoryName = categoryId
    ? categories.find((c) => c.id === categoryId)?.name ?? "All Categories"
    : "All Categories";

  const selectCategory = (id: string | null) => {
    setCategoryId(id);
    setShowCategoryDropdown(false);
  };

  return (
    <>
      <View style={[styles.controlsRow, { maxWidth }]}>
        {categories.length > 0 && (
          <View style={styles.dropdownWrap}>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowCategoryDropdown((v) => !v)}>
              <Text style={styles.dropdownButtonText} numberOfLines={1}>{selectedCategoryName}</Text>
              <MaterialIcons name={showCategoryDropdown ? "expand-less" : "expand-more"} size={18} color="#059669" />
            </TouchableOpacity>
            {showCategoryDropdown && (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => selectCategory(null)}>
                  <Text style={styles.dropdownItemText}>All Categories</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity key={cat.id} style={styles.dropdownItem} onPress={() => selectCategory(cat.id)}>
                    <Text style={styles.dropdownItemText}>{cat.icon} {cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color="#059669" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search items..."
            placeholderTextColor="#94a3b8"
          />
        </View>

        <TouchableOpacity
          style={[styles.sortChip, sort === "name-asc" && { backgroundColor: theme.chipActive, borderColor: theme.chipActive }]}
          onPress={() => setSort("name-asc")}
        >
          <MaterialIcons name="sort-by-alpha" size={13} color={sort === "name-asc" ? "#fff" : "#64748b"} />
          <Text style={[styles.sortChipText, sort === "name-asc" && styles.sortChipTextActive]}>Name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sort === "stock-asc" && { backgroundColor: theme.chipActive, borderColor: theme.chipActive }]}
          onPress={() => setSort("stock-asc")}
        >
          <MaterialIcons name="trending-up" size={13} color={sort === "stock-asc" ? "#fff" : "#64748b"} />
          <Text style={[styles.sortChipText, sort === "stock-asc" && styles.sortChipTextActive]}>Stock</Text>
        </TouchableOpacity>

        {onOpenFullScreen && (
          <TouchableOpacity style={styles.fullScreenBtn} onPress={onOpenFullScreen}>
            <MaterialIcons name="fullscreen" size={14} color="#fff" />
            <Text style={styles.fullScreenBtnText}>Full Screen</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.dateNavWrap, { maxWidth }]}>
        <View style={styles.dateNavPill}>
          <TouchableOpacity
            onPress={onPreviousDay}
            style={styles.dateNavArrow}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcons name="chevron-left" size={18} color="#1e293b" />
          </TouchableOpacity>
          <MaterialIcons name="calendar-today" size={13} color={theme.accent} />
          <Text style={styles.dateNavLabel}>{dateLabel}</Text>
          {!isHistorical && <Text style={styles.dateNavSubLabel}>{reportDateLabel}</Text>}
          <TouchableOpacity
            onPress={onNextDay}
            style={styles.dateNavArrow}
            disabled={isNextDayDisabled}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcons name="chevron-right" size={18} color={isNextDayDisabled ? "#cbd5e1" : "#1e293b"} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
    width: "100%", marginBottom: 8, zIndex: 1000,
  },
  dropdownWrap: { width: 180, position: "relative", zIndex: 1000, elevation: 20 },
  dropdownButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1.5, borderColor: "#059669", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#fff",
  },
  dropdownButtonText: { fontSize: 12, color: "#1e293b", fontWeight: "600", flex: 1 },
  dropdownList: {
    position: "absolute", top: "100%", left: 0,
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 220, backgroundColor: "#ffffff",
    width: 180, zIndex: 1000, elevation: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropdownItemText: { fontSize: 13, color: "#1e293b" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", flex: 1, minWidth: 160, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1.5, borderColor: "#059669",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 4,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1",
  },
  sortChipText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  sortChipTextActive: { color: "#fff" },
  fullScreenBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 4,
    backgroundColor: "#0369a1",
  },
  fullScreenBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  dateNavWrap: { width: "100%", alignItems: "center", marginBottom: 8 },
  dateNavPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 3, paddingHorizontal: 6,
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#cbd5e1",
  },
  dateNavArrow: { padding: 2 },
  dateNavLabel: { fontSize: 13, fontWeight: "800", color: "#1e293b" },
  dateNavSubLabel: { fontSize: 11, fontWeight: "600", color: "#64748b" },
});