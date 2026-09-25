// ============================================
// SERVORA ERP — HistoricalInventoryTableView Component (CONTROLLER)
// ✅ Single inventory table for BOTH Today and Historical dates.
// ✅ REFACTOR (4-file split) — this file is now the controller only:
//    - runs useHistoricalInventory() (UNCHANGED hook)
//    - builds inventoryItemById
//    - filtering (Today-mode stock-status card filter, category,
//      search), sorting, category grouping
//    - item-level status calculation → statusesByInventoryId Map
//    - Out of Stock row building (Today mode only)
//    - chooses what to render and passes ready data down.
//    Rendering lives in:
//    - HistoricalInventoryToolbar.tsx → controls row + date navigator
//    - HistoricalInventoryTable.tsx   → letterhead + ERP table
//    - OutOfStockTable.tsx            → Out of Stock card view
//    All filtering/sorting/grouping/status code below was MOVED, not
//    changed — same rules, same results.
// ✅ Status rules (existing rules only, no new thresholds):
//    - Today mode mirrors useInventoryFilters / InventoryStats (live
//      currentStock, isLowStock, item expiryDate).
//    - Historical mode mirrors useHistoricalInventoryStats (closing
//      Total QTY vs CURRENT minStock — documented limitation — and the
//      visible batches' expiry vs selectedDate).
//    - An item can show more than one status; "—" when none.
// ✅ Out of Stock filter (Today mode only) guards against archived
//    items leaking in via `isHistorical || item.isActive !== false`.
// ✅ Parent (InventoryScreen.tsx / InventoryFullScreenTableModal.tsx)
//    still owns selectedDate + date navigation — this component only
//    receives dateLabel/onPreviousDay/onNextDay/isNextDayDisabled.
//    Props interface is UNCHANGED, so neither parent needs changes.
// ✅ LAYOUT — the toolbar (controls row + compact date pill) is
//    rendered in a FIXED header ABOVE the vertical ScrollView, so it
//    stays in place while the table scrolls. Everything is
//    left-aligned with 16px side padding, matching InventoryScreen's
//    title/buttons/stat cards, so all blocks share one left edge.
//    The fixed header has a raised zIndex/elevation so the category
//    dropdown still opens OVER the table.
// ✅ STICKY TABLE HEAD — the table is no longer inside a page-level
//    vertical ScrollView. It fills the remaining height, and
//    HistoricalInventoryTable scrolls ONLY its category rows, so the
//    letterhead and column header stay fixed while scrolling.
// ✅ BATCH DATA CHECK — tapping an item's "data issue" badge opens
//    BatchDataCheckModal with that item's mismatched batches (from
//    useHistoricalInventory's batchChecksByInventoryId). Fix buttons
//    are shown only with the "fix_inventory_data" permission
//    (OWNER + MANAGER).
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Category } from "../types/category";
import {
  InventoryItem, classifyExpiry, resolveExpiryAlertDays,
} from "../types/inventory";
import { useHistoricalInventory, HistoricalItemStock } from "../hooks/useHistoricalInventory";
import { HistoricalInventoryToolbar, HistoricalSortOption } from "./HistoricalInventoryToolbar";
import {
  HistoricalInventoryTable, HistoricalCategoryGroup, ItemStatusKind, getHistoricalTableWidth,
} from "./HistoricalInventoryTable";
import { OutOfStockTable, OutOfStockGroup, OutOfStockRow } from "./OutOfStockTable";
import { BatchDataCheckModal } from "./BatchDataCheckModal";
import { usePermission } from "../../../hooks/usePermission";

type StockStatusFilter = "all" | "lowStock" | "outOfStock" | "expiringSoon";

interface HistoricalInventoryTableViewProps {
  restaurantId:   string;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantEmail?: string;
  restaurantVatNumber?: string;
  selectedDate:   string;
  dateLabel:      string;
  onPreviousDay:  () => void;
  onNextDay:      () => void;
  isNextDayDisabled: boolean;
  categories:     Category[];
  inventoryItems: InventoryItem[];
  searchQuery:    string;
  setSearchQuery: (q: string) => void;
  categoryId:     string | null;
  setCategoryId:  (id: string | null) => void;
  onItemPress:    (item: InventoryItem) => void;
  sort:           HistoricalSortOption;
  setSort:        (s: HistoricalSortOption) => void;
  isHistorical:   boolean;
  onOpenFullScreen?: () => void;
  stockStatus?:    StockStatusFilter;
  todayISO:        string;
  categoryMapForExpiry: Map<string, Category>;
  restaurantDefaultExpiryAlertDays?: number;
}

const UNCATEGORIZED_ID = "__uncategorized__";

function formatReportDate(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function HistoricalInventoryTableView({
  restaurantId, restaurantName, restaurantAddress, restaurantPhone, restaurantEmail, restaurantVatNumber,
  selectedDate, dateLabel, onPreviousDay, onNextDay, isNextDayDisabled,
  categories, inventoryItems,
  searchQuery, setSearchQuery, categoryId, setCategoryId,
  onItemPress, sort, setSort, isHistorical, onOpenFullScreen,
  stockStatus, todayISO, categoryMapForExpiry, restaurantDefaultExpiryAlertDays,
}: HistoricalInventoryTableViewProps) {
  const headerBg = isHistorical ? "#1e3a5f" : "#059669";
  const tableWidth = getHistoricalTableWidth(isHistorical);
  const reportDateLabel = formatReportDate(selectedDate);

  const { itemsWithHistoricalStock, depletedItems, loading, error, batchChecksByInventoryId } =
    useHistoricalInventory(restaurantId, selectedDate, inventoryItems);

  const canFixInventoryData = usePermission("fix_inventory_data");
  const [dataCheckInventoryId, setDataCheckInventoryId] = useState<string | null>(null);

  const inventoryItemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of inventoryItems) map.set(it.id, it);
    return map;
  }, [inventoryItems]);

  const sortItems = (list: HistoricalItemStock[]): HistoricalItemStock[] => {
    const sorted = [...list];
    if (sort === "stock-asc") {
      sorted.sort((a, b) => a.historicalStock - b.historicalStock);
    } else {
      sorted.sort((a, b) => a.itemName.localeCompare(b.itemName));
    }
    return sorted;
  };

  const filteredItems = useMemo(() => {
    let result = itemsWithHistoricalStock;

    if (!isHistorical && stockStatus && stockStatus !== "all") {
      result = result.filter((histItem) => {
        const liveItem = inventoryItemById.get(histItem.inventoryId);
        if (!liveItem) return false;

        if (stockStatus === "lowStock") {
          return liveItem.currentStock > 0 && liveItem.isLowStock;
        }
        if (stockStatus === "outOfStock") {
          return liveItem.currentStock <= 0;
        }
        if (stockStatus === "expiringSoon") {
          const category = categoryMapForExpiry.get(liveItem.categoryId);
          const resolvedDays = resolveExpiryAlertDays(
            liveItem.expiryAlertDaysOverride,
            category?.expiryAlertDays,
            restaurantDefaultExpiryAlertDays
          );
          return classifyExpiry(liveItem.expiryDate, todayISO, resolvedDays) === "expiringSoon";
        }
        return true;
      });
    }

    if (categoryId) {
      result = result.filter((it) => it.categoryId === categoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((it) => it.itemName.toLowerCase().includes(q));
    }
    return result;
  }, [
    itemsWithHistoricalStock, searchQuery, categoryId, isHistorical, stockStatus,
    inventoryItemById, todayISO, categoryMapForExpiry, restaurantDefaultExpiryAlertDays,
  ]);

  const categoryGroups = useMemo<HistoricalCategoryGroup[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, HistoricalItemStock[]>();

    for (const item of filteredItems) {
      const key = item.categoryId && categoryById.has(item.categoryId) ? item.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(key) ?? [];
      list.push(item);
      byCategory.set(key, list);
    }

    const groups: HistoricalCategoryGroup[] = [];
    for (const category of categories) {
      const items = byCategory.get(category.id);
      if (!items || items.length === 0) continue;
      groups.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items: sortItems(items) });
    }

    const uncategorized = byCategory.get(UNCATEGORIZED_ID);
    if (uncategorized && uncategorized.length > 0) {
      groups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: sortItems(uncategorized) });
    }

    groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return groups;
  }, [filteredItems, categories, sort]);

  // ✅ Item-level status — EXISTING classification rules only (see
  // header comment). Computed once per data change, looked up by the
  // table (which does no calculation of its own).
  const statusesByInventoryId = useMemo(() => {
    const map = new Map<string, ItemStatusKind[]>();

    for (const histItem of filteredItems) {
      const statuses: ItemStatusKind[] = [];
      const liveItem = inventoryItemById.get(histItem.inventoryId);
      const category = histItem.categoryId ? categoryMapForExpiry.get(histItem.categoryId) : undefined;
      const resolvedDays = resolveExpiryAlertDays(
        liveItem?.expiryAlertDaysOverride,
        category?.expiryAlertDays,
        restaurantDefaultExpiryAlertDays
      );

      if (!isHistorical) {
        // Today — same rules as useInventoryFilters / InventoryStats.
        if (liveItem) {
          if (liveItem.currentStock <= 0) statuses.push("outOfStock");
          else if (liveItem.isLowStock) statuses.push("lowStock");
          const expiry = classifyExpiry(liveItem.expiryDate, todayISO, resolvedDays);
          if (expiry === "expired") statuses.push("expired");
          else if (expiry === "expiringSoon") statuses.push("expiring");
        }
      } else {
        // Historical — same rules as useHistoricalInventoryStats.
        const minStock = liveItem?.minStock ?? 0;
        if (histItem.historicalStock <= 0) statuses.push("outOfStock");
        else if (histItem.historicalStock <= minStock) statuses.push("lowStock");

        let hasExpired = false;
        let hasExpiring = false;
        for (const batch of histItem.batches) {
          if (!batch.expiryDate) continue;
          const result = classifyExpiry(batch.expiryDate, selectedDate, resolvedDays);
          if (result === "expired") hasExpired = true;
          else if (result === "expiringSoon") hasExpiring = true;
        }
        if (hasExpired) statuses.push("expired");
        if (hasExpiring) statuses.push("expiring");
      }

      map.set(histItem.inventoryId, statuses);
    }

    return map;
  }, [
    filteredItems, inventoryItemById, categoryMapForExpiry, restaurantDefaultExpiryAlertDays,
    isHistorical, todayISO, selectedDate,
  ]);

  const outOfStockGroups = useMemo<OutOfStockGroup[]>(() => {
    const depletedSinceByInventoryId = new Map(depletedItems.map((d) => [d.inventoryId, d.depletedSince]));
    const outOfStockItems = inventoryItems.filter(
      (item) => (isHistorical || item.isActive !== false) && item.currentStock <= 0
    );

    const rows: OutOfStockRow[] = outOfStockItems
      .filter((item) => {
        if (categoryId && item.categoryId !== categoryId) return false;
        if (searchQuery.trim() && !item.itemName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
        return true;
      })
      .map((item) => ({
        inventoryId:   item.id,
        itemName:      item.itemName,
        categoryId:    item.categoryId,
        depletedSince: depletedSinceByInventoryId.get(item.id) ?? null,
      }));

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, OutOfStockRow[]>();
    for (const row of rows) {
      const key = row.categoryId && categoryById.has(row.categoryId) ? row.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(key) ?? [];
      list.push(row);
      byCategory.set(key, list);
    }

    const groups: OutOfStockGroup[] = [];
    for (const category of categories) {
      const items = byCategory.get(category.id);
      if (!items || items.length === 0) continue;
      items.sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items });
    }
    const uncategorized = byCategory.get(UNCATEGORIZED_ID);
    if (uncategorized && uncategorized.length > 0) {
      uncategorized.sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: uncategorized });
    }
    groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return groups;
  }, [depletedItems, inventoryItems, categories, categoryId, searchQuery, isHistorical]);

  const dataCheckItem = dataCheckInventoryId ? inventoryItemById.get(dataCheckInventoryId) ?? null : null;
  const dataCheckItemName =
    dataCheckItem?.itemName ??
    itemsWithHistoricalStock.find((it) => it.inventoryId === dataCheckInventoryId)?.itemName ??
    "";

  const dataCheckModal = (
    <BatchDataCheckModal
      visible={dataCheckInventoryId !== null}
      onClose={() => setDataCheckInventoryId(null)}
      restaurantId={restaurantId}
      item={dataCheckItem}
      itemName={dataCheckItemName}
      checks={dataCheckInventoryId ? batchChecksByInventoryId.get(dataCheckInventoryId) ?? [] : []}
      canFix={canFixInventoryData}
    />
  );

  if (loading) {
    return <ActivityIndicator size="large" color={headerBg} style={styles.loadingIndicator} />;
  }

  const isShowingOutOfStock = !isHistorical && stockStatus === "outOfStock";

  const toolbar = (
    <HistoricalInventoryToolbar
      maxWidth={tableWidth}
      isHistorical={isHistorical}
      categories={categories}
      categoryId={categoryId}
      setCategoryId={setCategoryId}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      sort={sort}
      setSort={setSort}
      onOpenFullScreen={onOpenFullScreen}
      dateLabel={dateLabel}
      reportDateLabel={reportDateLabel}
      onPreviousDay={onPreviousDay}
      onNextDay={onNextDay}
      isNextDayDisabled={isNextDayDisabled}
    />
  );

  if (isShowingOutOfStock) {
    return (
      <View style={styles.container}>
        <View style={styles.fixedHeader}>{toolbar}</View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <OutOfStockTable groups={outOfStockGroups} headerBg={headerBg} reportDateLabel={reportDateLabel} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeader}>{toolbar}</View>
      <View style={styles.tableBody}>
        {error && (
          <View style={[styles.errorBanner, { maxWidth: tableWidth }]}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {categoryGroups.length === 0 ? (
          <View style={[styles.emptyState, { maxWidth: tableWidth }]}>
            <MaterialIcons name="history" size={40} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>No stock existed on this date</Text>
          </View>
        ) : (
          <HistoricalInventoryTable
            groups={categoryGroups}
            isHistorical={isHistorical}
            selectedDate={selectedDate}
            reportDateLabel={reportDateLabel}
            inventoryItemById={inventoryItemById}
            statusesByInventoryId={statusesByInventoryId}
            onItemPress={onItemPress}
            onDataIssuePress={setDataCheckInventoryId}
            restaurantName={restaurantName}
            restaurantAddress={restaurantAddress}
            restaurantPhone={restaurantPhone}
            restaurantEmail={restaurantEmail}
            restaurantVatNumber={restaurantVatNumber}
          />
        )}
      </View>
      {dataCheckModal}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingIndicator: { marginTop: 40 },
  container: { flex: 1 },
  fixedHeader: {
    paddingHorizontal: 16, paddingTop: 8,
    zIndex: 1000, elevation: 20, position: "relative",
  },
  body: { flex: 1, zIndex: 0 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16, alignItems: "flex-start" },
  tableBody: { flex: 1, paddingHorizontal: 16, paddingBottom: 12, alignItems: "flex-start" },
  errorBanner: {
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 6, marginBottom: 10, width: "100%",
    borderWidth: 1, borderColor: "#fecaca",
  },
  errorBannerText: { color: "#b91c1c", fontSize: 12, fontWeight: "600" },
  emptyState: { width: "100%", alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
});