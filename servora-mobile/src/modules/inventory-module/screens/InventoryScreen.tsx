// ============================================
// SERVORA ERP — InventoryScreen
// ✅ Composition only — hooks provide data, components render.
// ✅ Search + Category filter (horizontal chips) + Stock status
//    filter + Sort selector — all via useInventoryFilters.
// ✅ Add/Edit via a modal wrapping InventoryForm.
// ✅ Delete uses the Platform-safe confirm pattern.
// ✅ Category lookup built once (useMemo).
// FROZEN
// ============================================

import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, FlatList, Modal, ScrollView,
  TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useInventory } from "../hooks/useInventory";
import { useInventoryFilters, InventoryStockStatus, InventorySortOption } from "../hooks/useInventoryFilters";
import { useCategoriesForPicker } from "../hooks/useCategoriesForPicker";
import { useSuppliers } from "../../supplier-module/hooks/useSuppliers";
import {
  createInventoryItem, updateInventoryItem, deleteInventoryItem,
} from "../repository/inventory-repository";
import {
  InventoryItem, CreateInventoryItemInput, UpdateInventoryItemInput,
} from "../types/inventory";
import InventoryCard from "../../../components/inventory/InventoryCard";
import { InventoryForm } from "../../../components/inventory/InventoryForm";
import { todayISO } from "../../../utils/date-utils";

const isWeb = Platform.OS === "web";

const STOCK_FILTER_OPTIONS: { value: InventoryStockStatus; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "lowStock",    label: "Low Stock" },
  { value: "outOfStock",  label: "Out of Stock" },
];

const SORT_OPTIONS: { value: InventorySortOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "name-asc",   label: "Name",  icon: "sort-by-alpha" },
  { value: "stock-asc",  label: "Stock", icon: "trending-up" },
  { value: "value-desc", label: "Value", icon: "attach-money" },
];

export default function InventoryScreen() {
  const { restaurant, restaurantId, fmt, userProfile } = useApp();
  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  const { items, loading: itemsLoading, error: itemsError } = useInventory(restaurantId);
  const {
    filters, filteredItems,
    setSearchQuery, setCategoryId, setStockStatus, setSort,
  } = useInventoryFilters(items);
  const { groups: categoryGroups, categories, loading: categoriesLoading } =
    useCategoriesForPicker(restaurantId);
  const { suppliers } = useSuppliers(restaurantId);

  const [showForm,   setShowForm]   = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);
  const [saving,      setSaving]      = useState(false);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const today = useMemo(() => todayISO(), []);

  const openCreate = useCallback(() => {
    setEditingItem(undefined);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingItem(undefined);
  }, []);

  const handleSubmit = useCallback(async (
    input: CreateInventoryItemInput | UpdateInventoryItemInput
  ) => {
    if (!restaurantId || saving) return;
    setSaving(true);
    try {
      if (editingItem) {
        await updateInventoryItem(restaurantId, editingItem.id, editingItem, input);
      } else {
        await createInventoryItem(restaurantId, input as CreateInventoryItemInput);
      }
      closeForm();
    } catch (err: any) {
      const msg = err?.message ?? "Failed to save item";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  }, [restaurantId, saving, editingItem, closeForm]);

  const handleDelete = useCallback((item: InventoryItem) => {
    if (!restaurantId) return;

    const doDelete = async () => {
      try {
        await deleteInventoryItem(restaurantId, item.id, item);
        closeForm();
      } catch (err: any) {
        const msg = err?.message ?? "Failed to delete item";
        if (isWeb) window.alert(`Error: ${msg}`);
        else Alert.alert("Error", msg);
      }
    };

    if (isWeb) {
      if (window.confirm(`Delete "${item.itemName}"?`)) doDelete();
    } else {
      Alert.alert("Delete Item", `Delete "${item.itemName}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  }, [restaurantId, closeForm]);

  const loading = itemsLoading || categoriesLoading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        {isManager && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={filters.searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items..."
        />
      </View>

      <View style={styles.filterRow}>
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
      </View>

      {/* ✅ Category filter — horizontal scrollable chips */}
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

      {/* ✅ Sort selector */}
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

      {itemsError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{itemsError}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0369a1" style={{ marginTop: 40 }} />
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="inventory-2" size={40} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>
            {items.length === 0 ? "No inventory items yet" : "No items match your filters"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          windowSize={7}
          renderItem={({ item }) => (
            <InventoryCard
              item={item}
              category={categoryMap.get(item.categoryId)}
              todayISO={today}
              restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
              fmt={fmt}
              onPress={() => openEdit(item)}
            />
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" onRequestClose={closeForm}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeForm}>
              <MaterialIcons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
            {editingItem && isManager && (
              <TouchableOpacity onPress={() => handleDelete(editingItem)}>
                <MaterialIcons name="delete" size={22} color="#dc2626" />
              </TouchableOpacity>
            )}
          </View>
          <InventoryForm
            mode={editingItem ? "edit" : "create"}
            initial={editingItem}
            categoryGroups={categoryGroups}
            suppliers={suppliers}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0369a1", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10 },
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
    backgroundColor: "#f1f5f9", marginRight: 8,
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
  errorBanner: {
    backgroundColor: "#fef2f2", margin: 16, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  list: { padding: 16 },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "web" ? 16 : 48, paddingBottom: 8,
  },
});