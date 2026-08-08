// ============================================
// SERVORA ERP — InventoryScreen
// [... all previous FROZEN header content unchanged — composition
//    only, deep-link support, stats tap-to-filter wiring, Batch
//    Report wiring ...]
// ✅ NEW — Receive Batch wiring: `receiveBatchItem` state, owned
//    here (consistent with every other modal in this screen).
//    ItemDetailsDrawer's onReceiveBatch → openReceiveBatch(item),
//    which closes the drawer first (setDrawerItem(undefined)) then
//    sets receiveBatchItem — matching the confirmed pattern where
//    the drawer never opens the next modal itself, it only reports
//    intent upward. ReceiveBatchModal's onClose → closeReceiveBatch.
// FROZEN
// ============================================

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform, Alert, FlatList } from "react-native";
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
import { ItemDetailsDrawer } from "../components/ItemDetailsDrawer";
import { InventoryBatchReport } from "../components/InventoryBatchReport";
import { ReceiveBatchModal } from "../components/ReceiveBatchModal";

const isWeb = Platform.OS === "web";

export default function InventoryScreen() {
  const { restaurant, restaurantId, fmt } = useApp();
  const canEditInventory = usePermission("edit_inventory");

  const { items, loading: itemsLoading, error: itemsError } = useInventory(restaurantId);

  const { groups: categoryGroups, categories, loading: categoriesLoading } =
    useCategoriesForPicker(restaurantId);
  const { suppliers } = useSuppliers(restaurantId);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const today = useMemo(() => todayISO(), []);

  const {
    filters, filteredItems,
    setSearchQuery, setCategoryId, setStockStatus, setSort,
  } = useInventoryFilters(items, {
    todayISO: today,
    categoryMap,
    restaurantDefaultExpiryAlertDays: restaurant?.defaultExpiryAlertDays,
  });

  const listRef = useRef<FlatList>(null);

  const handleStatusPress = useCallback((status: Parameters<typeof setStockStatus>[0]) => {
    setStockStatus(status);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [setStockStatus]);

  const params = useLocalSearchParams<{ stockStatus?: string }>();
  useEffect(() => {
    if (
      params.stockStatus === "lowStock" ||
      params.stockStatus === "outOfStock" ||
      params.stockStatus === "expiringSoon"
    ) {
      setStockStatus(params.stockStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showForm,          setShowForm]          = useState(false);
  const [editingItem,       setEditingItem]       = useState<InventoryItem | undefined>(undefined);
  const [saving,            setSaving]            = useState(false);
  const [seeding,           setSeeding]           = useState(false);
  const [adjustingItem,     setAdjustingItem]     = useState<InventoryItem | undefined>(undefined);
  const [drawerItem,        setDrawerItem]        = useState<InventoryItem | undefined>(undefined);
  const [showBatchReport,   setShowBatchReport]   = useState(false);
  const [receiveBatchItem,  setReceiveBatchItem]  = useState<InventoryItem | undefined>(undefined);

  const safeRestaurantId = restaurantId ?? "";

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

  const openDrawer = useCallback((item: InventoryItem) => {
    setDrawerItem(item);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerItem(undefined);
  }, []);

  const openBatchReport = useCallback(() => {
    setShowBatchReport(true);
  }, []);

  const closeBatchReport = useCallback(() => {
    setShowBatchReport(false);
  }, []);

  const openReceiveBatch = useCallback((item: InventoryItem) => {
    setDrawerItem(undefined);
    setReceiveBatchItem(item);
  }, []);

  const closeReceiveBatch = useCallback(() => {
    setReceiveBatchItem(undefined);
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
        onOpenBatchReport={openBatchReport}
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
          onStatusPress={handleStatusPress}
        />
      )}

      <InventoryFilters
        filters={filters}
        categories={categories}
        setSearchQuery={setSearchQuery}
        setCategoryId={setCategoryId}
        setSort={setSort}
      />

      {itemsError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{itemsError}</Text>
        </View>
      )}

      <InventoryList
        ref={listRef}
        items={items}
        filteredItems={filteredItems}
        loading={loading}
        categoryMap={categoryMap}
        todayISO={today}
        restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
        fmt={fmt}
        onItemPress={openDrawer}
        onAdjustStock={openAdjustStock}
      />

      <ItemDetailsDrawer
        visible={!!drawerItem}
        item={drawerItem}
        category={drawerItem ? categoryMap.get(drawerItem.categoryId) : undefined}
        restaurantId={safeRestaurantId}
        todayISO={today}
        restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
        fmt={fmt}
        canEditInventory={canEditInventory}
        onClose={closeDrawer}
        onEdit={openEdit}
        onAdjustStock={openAdjustStock}
        onReceiveBatch={openReceiveBatch}
        duplicateNameSuffix="(Copy)"
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
        restaurantId={safeRestaurantId}
        onClose={closeAdjustStock}
      />

      <InventoryBatchReport
        visible={showBatchReport}
        restaurantId={safeRestaurantId}
        onClose={closeBatchReport}
      />

      <ReceiveBatchModal
        visible={!!receiveBatchItem}
        item={receiveBatchItem}
        restaurantId={safeRestaurantId}
        suppliers={suppliers}
        onClose={closeReceiveBatch}
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