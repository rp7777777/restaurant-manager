// ============================================
// SERVORA ERP — InventoryScreen
// ✅ COMPOSITION ONLY — data-fetching hooks, filtering logic,
//    permissions, business-logic handlers, top-level JSX wiring.
// ✅ Migration Step 5 (FINAL) — Today and Historical now share ONE
//    table component: HistoricalInventoryTableView. The old
//    isHistorical ? <HistoricalInventoryTableView/> :
//    <InventoryTableView/> branch, InventoryFilters.tsx, and
//    InventoryTableView.tsx usage are REMOVED from this screen.
//    stockStatus (from useInventoryFilters, driven by InventoryStats'
//    card clicks) is wired directly into HistoricalInventoryTableView,
//    which applies it ONLY in Today mode (isHistorical === false).
// ✅ UI/modal state → useInventoryScreenState.
// ✅ Date navigation → useInventoryDateNavigation.
// ✅ "New Supplier" detour timing/return → useSupplierDetourNavigation.
// ✅ showFullScreenTable state + InventoryFullScreenTableModal.
// ✅ All other modal/drawer rendering → InventoryModalsGroup.
// ✅ handleSubmit branches on InventoryFormSubmitPayload's
//    discriminated union: newItem/existingItem/edit — UNCHANGED.
// ✅ ARCHITECTURE NOTE — purchaseDate is currently set equal to
//    receivedDate for the "existingItem" (Receive Batch) path.
// FROZEN
// ============================================

import React, { useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Platform, Alert, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useApp } from "../../../context/AppContext";
import { auth } from "../../../firebase";
import { usePermission } from "../../../hooks/usePermission";
import { useInventory } from "../hooks/useInventory";
import { useInventoryFilters } from "../hooks/useInventoryFilters";
import { useCategoriesForPicker } from "../hooks/useCategoriesForPicker";
import { useSuppliers } from "../../supplier-module/hooks/useSuppliers";
import { useInventoryDateNavigation } from "../hooks/useInventoryDateNavigation";
import { useInventoryScreenState } from "../hooks/useInventoryScreenState";
import { useSupplierDetourNavigation } from "../hooks/useSupplierDetourNavigation";
import { useInventoryFormDraft } from "../context/InventoryFormDraftContext";
import { useHistoricalInventory } from "../hooks/useHistoricalInventory";
import { useHistoricalInventoryStats } from "../hooks/useHistoricalInventoryStats";
import {
  updateInventoryItem, deleteInventoryItem,
} from "../repository/inventory-repository";
import { createInventoryItemWithInitialBatch, receiveBatch } from "../services/inventory-receive-service";
import { InventoryItem } from "../types/inventory";
import { InventoryFormSubmitPayload } from "../hooks/useInventoryForm";
import { seedDefaultStoreTaxonomy } from "../../store-module/services/seed-store-defaults-service";
import { todayISO } from "../../../utils/date-utils";
import { InventoryToolbar } from "../components/InventoryToolbar";
import { InventoryStats } from "../components/InventoryStats";
import { HistoricalInventoryTableView } from "../components/HistoricalInventoryTableView";
import { InventoryModalsGroup } from "../components/InventoryModalsGroup";
import { InventoryFullScreenTableModal } from "../components/InventoryFullScreenTableModal";

const isWeb = Platform.OS === "web";

export default function InventoryScreen() {
  const { restaurant, restaurantId, fmt, userProfile } = useApp();
  const actorName = userProfile?.name?.trim() || auth.currentUser?.email || "Inventory";

  const canEditInventory = usePermission("edit_inventory");
  const { consumeAutoOpenInventoryForm } = useInventoryFormDraft();

  const { items, loading: itemsLoading, error: itemsError } = useInventory(restaurantId);
  const { groups: categoryGroups, categories, loading: categoriesLoading } = useCategoriesForPicker(restaurantId);
  const { suppliers } = useSuppliers(restaurantId);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const today = useMemo(() => todayISO(), []);

  const {
    selectedDate, isHistorical, dateLabel,
    goToPreviousDay, goToNextDay, isNextDisabled,
  } = useInventoryDateNavigation(today);

  const [tableSearchQuery, setTableSearchQuery] = React.useState("");
  const [tableCategoryId, setTableCategoryId] = React.useState<string | null>(null);
  const [tableSort, setTableSort] = React.useState<"name-asc" | "stock-asc">("name-asc");
  const [showFullScreenTable, setShowFullScreenTable] = React.useState(false);

  const { itemsWithHistoricalStock } = useHistoricalInventory(restaurantId, selectedDate, items);
  const historicalStats = useHistoricalInventoryStats(
    itemsWithHistoricalStock,
    items,
    categoryMap,
    selectedDate,
    restaurant?.defaultExpiryAlertDays
  );

  const {
    filters, setStockStatus,
  } = useInventoryFilters(items, {
    todayISO: today,
    categoryMap,
    restaurantDefaultExpiryAlertDays: restaurant?.defaultExpiryAlertDays,
  });

  const handleStatusPress = useCallback((status: Parameters<typeof setStockStatus>[0]) => {
    setStockStatus(status);
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

  const screenState = useInventoryScreenState();
  const {
    showForm, editingItem, saving, setSaving, seeding, setSeeding,
    adjustingItem, drawerItem, showBatchReport, receiveBatchItem,
    showArchivedItems, showMovementHistory,
    openCreate, openEdit, closeForm,
    openAdjustStock, closeAdjustStock,
    openDrawer, closeDrawer,
    openBatchReport, closeBatchReport,
    openReceiveBatch, closeReceiveBatch,
    openArchivedItems, closeArchivedItems,
    openMovementHistory, closeMovementHistory,
  } = screenState;

  const { triggerSupplierDetour, checkForReturnAndReopen } = useSupplierDetourNavigation({
    showForm,
    closeForm,
    onReopen: openCreate,
  });

  useFocusEffect(
    useCallback(() => {
      if (consumeAutoOpenInventoryForm()) {
        openCreate();
        return;
      }
      checkForReturnAndReopen();
    }, [consumeAutoOpenInventoryForm, checkForReturnAndReopen, openCreate])
  );

  const safeRestaurantId = restaurantId ?? "";

  const handleSubmit = useCallback(async (payload: InventoryFormSubmitPayload) => {
    if (!restaurantId || saving) return;
    setSaving(true);
    try {
      if (payload.mode === "edit") {
        if (!editingItem) throw new Error("No item selected for editing");
        await updateInventoryItem(restaurantId, editingItem.id, editingItem, payload.input);
      } else if (payload.mode === "existingItem") {
        await receiveBatch(restaurantId, payload.existingItem, {
          inventoryId:  payload.existingItem.id,
          itemName:     payload.existingItem.itemName,
          batchNo:      payload.batch.batchNo,
          quantity:     payload.batch.quantity,
          unit:         payload.batch.unit,
          unitCost:     payload.batch.unitCost,
          purchaseDate: payload.batch.receivedDate ?? today,
          receivedDate: payload.batch.receivedDate ?? today,
          expiryDate:   payload.batch.expiryDate,
          supplierId:   payload.batch.supplierId,
        });
      } else {
        await createInventoryItemWithInitialBatch(restaurantId, {
          itemInput: payload.input,
          batchNo: payload.input.batchNo,
          receivedDate: payload.receivedDate,
        });
      }
      closeForm();
    } catch (err: any) {
      const msg = err?.message ?? "Failed to save item";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  }, [restaurantId, saving, editingItem, closeForm, today, setSaving]);

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
  }, [restaurantId, seeding, setSeeding]);

  const loading = itemsLoading || categoriesLoading;
  const shouldShowSeedBanner = !categoriesLoading && categories.length === 0 && canEditInventory;

  return (
    <View style={styles.container}>
      <InventoryToolbar
        canEditInventory={canEditInventory}
        onAddItem={openCreate}
        onOpenBatchReport={openBatchReport}
        onOpenArchivedItems={openArchivedItems}
        onOpenMovementHistory={openMovementHistory}
        shouldShowSeedBanner={shouldShowSeedBanner}
        seeding={seeding}
        onSeedStoreDefaults={handleSeedDefaults}
      />

      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateNavArrow}>
          <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.dateNavLabel}>{dateLabel}</Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.dateNavArrow} disabled={isNextDisabled}>
          <MaterialIcons name="chevron-right" size={22} color={isNextDisabled ? "#cbd5e1" : "#1e293b"} />
        </TouchableOpacity>
      </View>

      {!loading && (
        <View style={styles.statsSearchRow}>
          <InventoryStats
            items={items}
            categoryMap={categoryMap}
            todayISO={today}
            restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
            fmt={fmt}
            activeStockStatus={filters.stockStatus}
            onStatusPress={handleStatusPress}
            statsOverride={isHistorical ? historicalStats : undefined}
          />
        </View>
      )}

      {itemsError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{itemsError}</Text>
        </View>
      )}

      <HistoricalInventoryTableView
        restaurantId={safeRestaurantId}
        selectedDate={selectedDate}
        categories={categories}
        inventoryItems={items}
        searchQuery={tableSearchQuery}
        setSearchQuery={setTableSearchQuery}
        categoryId={tableCategoryId}
        setCategoryId={setTableCategoryId}
        onItemPress={openDrawer}
        sort={tableSort}
        setSort={setTableSort}
        isHistorical={isHistorical}
        onOpenFullScreen={() => setShowFullScreenTable(true)}
        stockStatus={filters.stockStatus}
        todayISO={today}
        categoryMapForExpiry={categoryMap}
        restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
      />

      <InventoryModalsGroup
        drawerItem={drawerItem}
        categoryMap={categoryMap}
        restaurantId={safeRestaurantId}
        todayISO={today}
        restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
        fmt={fmt}
        canEditInventory={canEditInventory}
        actorName={actorName}
        onCloseDrawer={closeDrawer}
        onEditItem={openEdit}
        onAdjustStock={openAdjustStock}
        onReceiveBatch={openReceiveBatch}
        showForm={showForm}
        editingItem={editingItem}
        categoryGroups={categoryGroups}
        suppliers={suppliers}
        allItems={items}
        onSubmit={handleSubmit}
        onCancelForm={closeForm}
        onDeleteItem={handleDelete}
        onAddSupplier={triggerSupplierDetour}
        adjustingItem={adjustingItem}
        onCloseAdjustStock={closeAdjustStock}
        showBatchReport={showBatchReport}
        onCloseBatchReport={closeBatchReport}
        receiveBatchItem={receiveBatchItem}
        onCloseReceiveBatch={closeReceiveBatch}
        items={items}
        showArchivedItems={showArchivedItems}
        onCloseArchivedItems={closeArchivedItems}
        categories={categories}
        showMovementHistory={showMovementHistory}
        onCloseMovementHistory={closeMovementHistory}
      />
      <InventoryFullScreenTableModal
        visible={showFullScreenTable}
        onClose={() => setShowFullScreenTable(false)}
        restaurantId={safeRestaurantId}
        items={items}
        categories={categories}
        initialDate={selectedDate}
        today={today}
        onItemPress={openDrawer}
        restaurantDefaultExpiryAlertDays={restaurant?.defaultExpiryAlertDays}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 14, fontWeight: "800", color: "#1e293b", minWidth: 160, textAlign: "center" },
  statsSearchRow: { paddingHorizontal: 16, marginTop: 8, gap: 6 },
  errorBanner: {
    backgroundColor: "#fef2f2", margin: 16, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
});