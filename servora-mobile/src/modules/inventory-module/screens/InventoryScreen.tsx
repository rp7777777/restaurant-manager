// ============================================
// SERVORA ERP — InventoryScreen
// ✅ COMPOSITION ONLY — this screen owns state and data-fetching
//    (hooks) and wiring.
// ✅ Date navigator — "< Today >" — selectedDate === today → live
//    stats/filters/InventoryTableView. Past date → 
//    HistoricalInventoryTableView (own independent search/category
//    state).
// ✅ FIX — Search box moved OUT of InventoryFilters and rendered
//    compactly inline alongside InventoryStats (same row), reclaiming
//    vertical space for the table per confirmed request.
// ✅ FIX — activeStockStatus wired through to InventoryStats so the
//    currently-selected stat card (Low Stock/Out of Stock/Expiring
//    Soon) is visually highlighted, not just applying the filter
//    silently.
// ✅ InventoryTableView, useInventory, useAllInventoryBatches are
//    NOT modified beyond InventoryTableView's own separately-
//    reviewed width/chevron changes.
// FROZEN
// ============================================

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Platform, Alert, TouchableOpacity, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useApp } from "../../../context/AppContext";
import { usePermission } from "../../../hooks/usePermission";
import { useInventory } from "../hooks/useInventory";
import { useInventoryFilters } from "../hooks/useInventoryFilters";
import { useCategoriesForPicker } from "../hooks/useCategoriesForPicker";
import { useSuppliers } from "../../supplier-module/hooks/useSuppliers";
import { useAllInventoryBatches } from "../hooks/useAllInventoryBatches";
import {
  updateInventoryItem, deleteInventoryItem,
} from "../repository/inventory-repository";
import { createInventoryItemWithInitialBatch } from "../services/inventory-service";
import {
  InventoryItem, CreateInventoryItemInput, UpdateInventoryItemInput,
} from "../types/inventory";
import { seedDefaultStoreTaxonomy } from "../../store-module/services/seed-store-defaults-service";
import { todayISO } from "../../../utils/date-utils";
import { InventoryToolbar } from "../components/InventoryToolbar";
import { InventoryStats } from "../components/InventoryStats";
import { InventoryFilters } from "../components/InventoryFilters";
import { InventoryTableView } from "../components/InventoryTableView";
import { HistoricalInventoryTableView } from "../components/HistoricalInventoryTableView";
import { InventoryModal } from "../components/InventoryModal";
import { StockAdjustmentModal } from "../components/StockAdjustmentModal";
import { ItemDetailsDrawer } from "../components/ItemDetailsDrawer";
import { InventoryBatchReport } from "../components/InventoryBatchReport";
import { ReceiveBatchModal } from "../components/ReceiveBatchModal";
import { ArchivedItemsModal } from "../components/ArchivedItemsModal";
import { MovementHistoryModal } from "../components/MovementHistoryModal";

const isWeb = Platform.OS === "web";

function shiftDate(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export default function InventoryScreen() {
  const { restaurant, restaurantId, fmt } = useApp();
  const canEditInventory = usePermission("edit_inventory");

  const { items, loading: itemsLoading, error: itemsError } = useInventory(restaurantId);

  const { groups: categoryGroups, categories, loading: categoriesLoading } =
    useCategoriesForPicker(restaurantId);
  const { suppliers } = useSuppliers(restaurantId);

  const { batches: allBatches, loading: batchesLoading } = useAllInventoryBatches(restaurantId);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const today = useMemo(() => todayISO(), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const isHistorical = selectedDate !== today;

  const [historicalSearchQuery, setHistoricalSearchQuery] = useState("");
  const [historicalCategoryId, setHistoricalCategoryId] = useState<string | null>(null);

  const {
    filters, filteredItems,
    setSearchQuery, setCategoryId, setStockStatus, setSort,
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

  const [showForm,             setShowForm]             = useState(false);
  const [editingItem,          setEditingItem]          = useState<InventoryItem | undefined>(undefined);
  const [saving,                setSaving]                = useState(false);
  const [seeding,               setSeeding]               = useState(false);
  const [adjustingItem,         setAdjustingItem]         = useState<InventoryItem | undefined>(undefined);
  const [drawerItem,            setDrawerItem]            = useState<InventoryItem | undefined>(undefined);
  const [showBatchReport,       setShowBatchReport]       = useState(false);
  const [receiveBatchItem,      setReceiveBatchItem]      = useState<InventoryItem | undefined>(undefined);
  const [showArchivedItems,     setShowArchivedItems]     = useState(false);
  const [showMovementHistory,   setShowMovementHistory]   = useState(false);

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

  const openArchivedItems = useCallback(() => {
    setShowArchivedItems(true);
  }, []);

  const closeArchivedItems = useCallback(() => {
    setShowArchivedItems(false);
  }, []);

  const openMovementHistory = useCallback(() => {
    setShowMovementHistory(true);
  }, []);

  const closeMovementHistory = useCallback(() => {
    setShowMovementHistory(false);
  }, []);

  const handleSubmit = useCallback(async (
    input: CreateInventoryItemInput | UpdateInventoryItemInput,
    receivedDate?: string
  ) => {
    if (!restaurantId || saving) return;
    setSaving(true);
    try {
      if (editingItem) {
        await updateInventoryItem(restaurantId, editingItem.id, editingItem, input);
      } else {
        const createInput = input as CreateInventoryItemInput;
        await createInventoryItemWithInitialBatch(restaurantId, {
          itemInput: createInput,
          batchNo: createInput.batchNo,
          receivedDate,
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

  const loading = itemsLoading || categoriesLoading || batchesLoading;
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
        <TouchableOpacity onPress={() => setSelectedDate((d) => shiftDate(d, -1))} style={styles.dateNavArrow}>
          <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.dateNavLabel}>{formatDateLabel(selectedDate, today)}</Text>
        <TouchableOpacity
          onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
          style={styles.dateNavArrow}
          disabled={selectedDate >= today}
        >
          <MaterialIcons name="chevron-right" size={22} color={selectedDate >= today ? "#cbd5e1" : "#1e293b"} />
        </TouchableOpacity>
      </View>

      {isHistorical ? (
        <HistoricalInventoryTableView
          restaurantId={safeRestaurantId}
          selectedDate={selectedDate}
          categories={categories}
          inventoryItems={items}
          searchQuery={historicalSearchQuery}
          setSearchQuery={setHistoricalSearchQuery}
          categoryId={historicalCategoryId}
          setCategoryId={setHistoricalCategoryId}
        />
      ) : (
        <>
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
              />
              <View style={styles.compactSearchRow}>
                <MaterialIcons name="search" size={16} color="#94a3b8" />
                <TextInput
                  style={styles.compactSearchInput}
                  value={filters.searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search items..."
                />
              </View>
            </View>
          )}

          <InventoryFilters
            filters={filters}
            categories={categories}
            setCategoryId={setCategoryId}
            setSort={setSort}
          />

          {itemsError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{itemsError}</Text>
            </View>
          )}

          <InventoryTableView
            filteredItems={filteredItems}
            allItemsCount={items.length}
            categories={categories}
            batches={allBatches}
            loading={loading}
            onItemPress={openDrawer}
          />
        </>
      )}

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

      <ArchivedItemsModal
        visible={showArchivedItems}
        items={items}
        categoryMap={categoryMap}
        restaurantId={safeRestaurantId}
        fmt={fmt}
        onClose={closeArchivedItems}
      />

      <MovementHistoryModal
        visible={showMovementHistory}
        restaurantId={safeRestaurantId}
        items={items}
        categories={categories}
        onClose={closeMovementHistory}
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
  compactSearchRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", height: 32,
  },
  compactSearchInput: { flex: 1, fontSize: 13, color: "#1e293b" },
  errorBanner: {
    backgroundColor: "#fef2f2", margin: 16, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
});