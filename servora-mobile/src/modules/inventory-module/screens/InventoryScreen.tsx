// ============================================
// SERVORA ERP — InventoryScreen
// ✅ COMPOSITION ONLY — this screen now owns state and data-fetching
//    (hooks) and wiring; ALL rendering is delegated to
//    InventoryToolbar, InventoryStats, InventoryFilters,
//    InventoryList, InventoryModal, and StockAdjustmentModal.
// ✅ Delete uses the Platform-safe confirm pattern.
// ✅ Category lookup built once (useMemo).
// ✅ Deep-link support — Dashboard's "Low Stock" row can open this
//    screen pre-filtered via ?stockStatus=lowStock, applied once on
//    mount so it doesn't fight the user if they change the filter
//    chips afterward.
// ✅ InventoryStats inserted between the toolbar and the filters —
//    the on-demand useMemo() aggregation confirmed earlier in this
//    restructuring (no Dashboard-style hybrid summary).
// ✅ itemsError banner stays inline here (not extracted into a
//    child component) — it's screen-level connection/subscription
//    error state from useInventory(), not something InventoryList
//    or any other child owns.
// ✅ NEW — Stock Adjustment wiring: `adjustingItem` state tracks
//    which item the StockAdjustmentModal is open for. Opened via
//    InventoryList → InventoryCard's own "Adjust Stock" icon
//    button, completely separate from the Edit modal (`showForm` /
//    `editingItem`) — a user can adjust stock without going through
//    Edit at all. The modal itself performs the write via
//    useStockAdjustment() → inventory-service.ts's adjustStock() →
//    recordStockMovement(); this screen only owns the "which item,
//    is it open" state.
// FROZEN
// ============================================

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Platform, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useApp } from "../../../context/AppContext";
import { usePermission } from "../../../hooks/usePermission";
import { useInventory } from "../hooks/useInventory";
import { useInventoryFilters } from "../hooks/useInventoryFilters";
import { useCategoriesForPicker } from "../hooks/useCategoriesForPicker";
import { useSuppliers } from "../../supplier-module/hooks/useSuppliers";
import {
  createInventoryItem, updateInventoryItem, deleteInventoryItem,
} from "../repository/inventory-repository";
import {
  InventoryItem, CreateInventoryItemInput, UpdateInventoryItemInput,
} from "../types/inventory";
import { seedDefaultStoreTaxonomy } from "../../store-module/services/seed-store-defaults-service";
import { todayISO } from "../../../utils/date-utils";
import { InventoryToolbar } from "../components/InventoryToolbar";
import { InventoryStats } from "../components/InventoryStats";
import { InventoryFilters } from "../components/InventoryFilters";
import { InventoryList } from "../components/InventoryList";
import { InventoryModal } from "../components/InventoryModal";
import { StockAdjustmentModal } from "../components/StockAdjustmentModal";

const isWeb = Platform.OS === "web";

export default function InventoryScreen() {
  const { restaurant, restaurantId, fmt } = useApp();
  // ✅ RBAC Phase 1 — replaces the old inline
  // `["MANAGER","OWNER"].includes(role)` check (duplicated across
  // ~14 screens) with the shared static permission engine.
  const canEditInventory = usePermission("edit_inventory");

  const { items, loading: itemsLoading, error: itemsError } = useInventory(restaurantId);
  const {
    filters, filteredItems,
    setSearchQuery, setCategoryId, setStockStatus, setSort,
  } = useInventoryFilters(items);

  // ✅ Deep-link support — Dashboard's "Low Stock" row navigates to
  // /inventory-module?stockStatus=lowStock. Applied once on mount
  // (empty dep array) so it sets the initial filter without fighting
  // the user if they change it afterward via the filter chips.
  const params = useLocalSearchParams<{ stockStatus?: string }>();
  useEffect(() => {
    if (params.stockStatus === "lowStock" || params.stockStatus === "outOfStock") {
      setStockStatus(params.stockStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { groups: categoryGroups, categories, loading: categoriesLoading } =
    useCategoriesForPicker(restaurantId);
  const { suppliers } = useSuppliers(restaurantId);

  const [showForm,      setShowForm]      = useState(false);
  const [editingItem,   setEditingItem]   = useState<InventoryItem | undefined>(undefined);
  const [saving,        setSaving]        = useState(false);
  const [seeding,       setSeeding]       = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | undefined>(undefined);

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

  const openAdjustStock = useCallback((item: InventoryItem) => {
    setAdjustingItem(item);
  }, []);

  const closeAdjustStock = useCallback(() => {
    setAdjustingItem(undefined);
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

  // ✅ Seed default Department + Category taxonomy — shown only
  // when no categories exist yet.
  const handleSeedDefaults = useCallback(async () => {
    if (!restaurantId || seeding) return;
    setSeeding(true);
    try {
      const result = await seedDefaultStoreTaxonomy(restaurantId);
      const msg = `✅ Created ${result.departmentsCreated} departments, ${result.categoriesCreated} categories.`;
      if (isWeb) window.alert(msg);
      else Alert.alert("Defaults Seeded", msg);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to seed defaults";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setSeeding(false);
    }
  }, [restaurantId, seeding]);

  const loading = itemsLoading || categoriesLoading;
  const shouldShowSeedBanner = !categoriesLoading && categories.length === 0 && canEditInventory;

  return (
    <View style={styles.container}>
      <InventoryToolbar
        canEditInventory={canEditInventory}
        onAddItem={openCreate}
        shouldShowSeedBanner={shouldShowSeedBanner}
        seeding={seeding}
        onSeedStoreDefaults={handleSeedDefaults}
      />

      {!loading && (
        <InventoryStats
          items={items}
          categoryMap={categoryMap}
          todayISO={today}
          restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
          fmt={fmt}
        />
      )}

      <InventoryFilters
        filters={filters}
        categories={categories}
        setSearchQuery={setSearchQuery}
        setCategoryId={setCategoryId}
        setStockStatus={setStockStatus}
        setSort={setSort}
      />

      {itemsError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{itemsError}</Text>
        </View>
      )}

      <InventoryList
        items={items}
        filteredItems={filteredItems}
        loading={loading}
        categoryMap={categoryMap}
        todayISO={today}
        restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
        fmt={fmt}
        onItemPress={openEdit}
        onAdjustStock={openAdjustStock}
      />

      <InventoryModal
        visible={showForm}
        editingItem={editingItem}
        canEditInventory={canEditInventory}
        categoryGroups={categoryGroups}
        suppliers={suppliers}
        onSubmit={handleSubmit}
        onCancel={closeForm}
        onDelete={handleDelete}
      />

      <StockAdjustmentModal
        visible={!!adjustingItem}
        item={adjustingItem}
        restaurantId={restaurantId ?? ""}
        onClose={closeAdjustStock}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  errorBanner: {
    backgroundColor: "#fef2f2", margin: 16, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
});