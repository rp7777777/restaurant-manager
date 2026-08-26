// ============================================
// SERVORA ERP — InventoryFullScreenTableModal Component
// ✅ A full-screen Modal wrapping the SAME InventoryTableView
//    component (reused, not duplicated) with its own independent
//    search/category filter state.
// ✅ FIX — category dropdown moved OUTSIDE the header row, as its
//    own top-level overlay (with a semi-transparent backdrop +
//    high zIndex/elevation), so touch/scroll events are never
//    intercepted by other header elements or the ScrollView beneath
//    it. Root cause of the previous "can't click/scroll" bug:
//    position: absolute nested inside the header row's own layout
//    context, competing with the underlying table's ScrollView for
//    touch handling on web. Tapping outside the dropdown (the
//    backdrop) closes it.
// ✅ Reuses InventoryTableView.tsx verbatim — no changes to that
//    FROZEN component.
// ✅ Independent search/category state — deliberately NOT shared
//    with the main screen's own InventoryFilters state.
// ✅ handleItemPress closes THIS modal before delegating to the
//    parent's onItemPress — avoids nested-Modal layering risk.
// FROZEN
// ============================================

import React, { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch } from "../types/inventory-batch";
import { Category } from "../types/category";
import { InventoryTableView } from "./InventoryTableView";

interface InventoryFullScreenTableModalProps {
  visible:        boolean;
  onClose:        () => void;
  items:          InventoryItem[];
  categories:     Category[];
  batches:        InventoryBatch[];
  onItemPress:    (item: InventoryItem) => void;
}

export function InventoryFullScreenTableModal({
  visible, onClose, items, categories, batches, onItemPress,
}: InventoryFullScreenTableModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const filteredItems = useMemo(() => {
    let result = items;
    if (categoryId) {
      result = result.filter((it) => it.categoryId === categoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((it) => it.itemName.toLowerCase().includes(q));
    }
    return result;
  }, [items, categoryId, searchQuery]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleItemPress = (item: InventoryItem) => {
    onClose();
    onItemPress(item);
  };

  const handleClose = () => {
    setShowCategoryDropdown(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Inventory — Full View</Text>

          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search..."
            />
          </View>

          <TouchableOpacity
            style={styles.categoryDropdownBtn}
            onPress={() => setShowCategoryDropdown((v) => !v)}
          >
            <Text style={styles.categoryDropdownBtnText} numberOfLines={1}>
              {selectedCategory ? `${selectedCategory.icon ?? ""} ${selectedCategory.name}` : "All Categories"}
            </Text>
            <MaterialIcons name={showCategoryDropdown ? "expand-less" : "expand-more"} size={16} color="#475569" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color="#1e293b" />
          </TouchableOpacity>
        </View>

        {showCategoryDropdown && (
          <View style={styles.categoryDropdownOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              onPress={() => setShowCategoryDropdown(false)}
            />
            <View style={styles.categoryDropdownList}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                <TouchableOpacity
                  style={styles.categoryDropdownItem}
                  onPress={() => { setCategoryId(null); setShowCategoryDropdown(false); }}
                >
                  <Text style={styles.categoryDropdownItemText}>All Categories</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryDropdownItem}
                    onPress={() => { setCategoryId(cat.id); setShowCategoryDropdown(false); }}
                  >
                    <Text style={styles.categoryDropdownItemText}>{cat.icon} {cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        <InventoryTableView
          filteredItems={filteredItems}
          allItemsCount={items.length}
          categories={categories}
          batches={batches}
          loading={false}
          onItemPress={handleItemPress}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  headerRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, paddingTop: Platform.OS === "web" ? 16 : 44,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 13, fontWeight: "800", color: "#1e293b" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 6, flex: 1,
    backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#1e293b" },
  categoryDropdownBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, width: 150,
    backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
  },
  categoryDropdownBtnText: { fontSize: 12, fontWeight: "600", color: "#475569", flex: 1 },
  closeBtn: { padding: 4 },
  // ✅ FIX — top-level overlay (sibling of headerRow, not nested
  // inside it), full-screen backdrop + centered/positioned list.
  categoryDropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 20,
  },
  categoryDropdownList: {
    position: "absolute",
    top: Platform.OS === "web" ? 70 : 100,
    right: 60,
    width: 220,
    maxHeight: 280,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10,
    elevation: 20,
  },
  categoryDropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  categoryDropdownItemText: { fontSize: 13, color: "#1e293b" },
});