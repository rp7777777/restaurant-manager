// ============================================
// SERVORA ERP — HistoricalInventoryTableView Component
// ✅ Migration Steps 1-5 — single table for Today and Historical,
//    real InventoryItem onItemPress, Sort, Full Screen, isHistorical
//    dynamic theming, Today-mode-only stockStatus filter.
// ✅ Out of Stock dedicated display (Today mode only) — table-style
//    layout (S.N. / Item Name / Date / Note columns, category
//    grouping) instead of a plain list, matching the normal table's
//    visual structure. Membership ("WHO is out of stock") comes from
//    liveItem.currentStock <= 0 — the SAME source of truth as the
//    stat card and the main stockStatus filter above. "Date"/"Note"
//    (WHEN it became out of stock) is looked up from depletedItems;
//    falls back to "—"/"Out of stock" if not found.
// ✅ "Received Qty" column — batch.originalQuantity ONLY when
//    batch.receivedDate === selectedDate, otherwise "—".
// ✅ Multi-line Issue column (>2 entries -> one per line, dynamic
//    row height).
// ✅ Category chips AND sort/full-screen row both use full page
//    width (no maxWidth constraint).
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Category } from "../types/category";
import {
  InventoryItem, classifyExpiry, resolveExpiryAlertDays,
} from "../types/inventory";
import { useHistoricalInventory, HistoricalItemStock } from "../hooks/useHistoricalInventory";

type HistoricalSortOption = "name-asc" | "stock-asc";
type StockStatusFilter = "all" | "lowStock" | "outOfStock" | "expiringSoon";

interface HistoricalInventoryTableViewProps {
  restaurantId:   string;
  selectedDate:   string;
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

interface HistoricalCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        HistoricalItemStock[];
}

interface OutOfStockRow {
  inventoryId:   string;
  itemName:      string;
  categoryId:    string;
  depletedSince: string | null;
}

interface OutOfStockGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        OutOfStockRow[];
}

const ROW_HEIGHT = 26;
const LEFT_COLS = { sn: 40, item: 170 };
const RIGHT_COLS = { date: 90, batch: 110, receivedQty: 76, issue: 160, stock: 90, unit: 70, expiry: 90, total: 122 };
const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item;
const RIGHT_WIDTH =
  RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty + RIGHT_COLS.issue + RIGHT_COLS.stock +
  RIGHT_COLS.unit + RIGHT_COLS.expiry + RIGHT_COLS.total;
const TABLE_WIDTH = LEFT_WIDTH + RIGHT_WIDTH;

const OOS_TABLE_WIDTH = 900;
const OOS_COLS = { sn: 50, item: 260, date: 160, note: 180 };

const UNCATEGORIZED_ID = "__uncategorized__";

function getBatchRowHeight(issueCount: number): number {
  return issueCount > 2 ? ROW_HEIGHT * issueCount : ROW_HEIGHT;
}

export function HistoricalInventoryTableView({
  restaurantId, selectedDate, categories, inventoryItems,
  searchQuery, setSearchQuery, categoryId, setCategoryId,
  onItemPress, sort, setSort, isHistorical, onOpenFullScreen,
  stockStatus, todayISO, categoryMapForExpiry, restaurantDefaultExpiryAlertDays,
}: HistoricalInventoryTableViewProps) {
  const theme = isHistorical
    ? { headerBg: "#1e3a5f", batchQty: "#1e3a5f", total: "#1e3a5f", chipActive: "#1e3a5f" }
    : { headerBg: "#059669", batchQty: "#6d28d9", total: "#059669", chipActive: "#1e293b" };

  const { itemsWithHistoricalStock, depletedItems, loading, error } =
    useHistoricalInventory(restaurantId, selectedDate, inventoryItems);

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

  // ✅ NEW — Out of Stock grouped rows (S.N./Item Name/Date/Note),
  // computed only when needed.
  const outOfStockGroups = useMemo<OutOfStockGroup[]>(() => {
    const depletedSinceByInventoryId = new Map(depletedItems.map((d) => [d.inventoryId, d.depletedSince]));
    const outOfStockItems = inventoryItems.filter((item) => item.currentStock <= 0);

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
  }, [depletedItems, inventoryItems, categories, categoryId, searchQuery]);

  if (loading) {
    return <ActivityIndicator size="large" color={theme.headerBg} style={styles.loadingIndicator} />;
  }

  const isShowingOutOfStock = !isHistorical && stockStatus === "outOfStock";

  if (isShowingOutOfStock) {
    return (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.searchRow}>
          <MaterialIcons name="search" size={18} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search items..."
            placeholderTextColor="#94a3b8"
          />
        </View>

        {outOfStockGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={40} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>No out-of-stock items</Text>
          </View>
        ) : (
          outOfStockGroups.map((group) => (
            <View key={group.categoryId} style={[styles.categoryBlock, { width: OOS_TABLE_WIDTH }]}>
              <View style={[styles.categoryHeader, { backgroundColor: theme.headerBg }]}>
                <Text style={styles.categoryHeaderText}>
                  {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                </Text>
              </View>
              <View style={styles.oosTableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.sn }]}>S.N.</Text>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.item }]}>Item Name</Text>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.date }]}>Date</Text>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.note }]}>Note</Text>
              </View>
              {group.items.map((item, itemIndex) => (
                <View
                  key={item.inventoryId}
                  style={[styles.oosRow, itemIndex % 2 === 1 && styles.itemGroupRowAlt]}
                >
                  <Text style={[styles.leftStripCell, { width: OOS_COLS.sn }]}>{itemIndex + 1}</Text>
                  <Text style={[styles.itemNameCell, { width: OOS_COLS.item }]} numberOfLines={1}>{item.itemName}</Text>
                  <Text style={[styles.leftStripCell, { width: OOS_COLS.date }]}>{item.depletedSince ?? "—"}</Text>
                  <Text style={[styles.oosNoteText, { width: OOS_COLS.note }]}>Out of stock</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      {categories.length > 0 && (
        <View style={styles.categoryWrap}>
          <TouchableOpacity
            style={[
              styles.categoryChip,
              categoryId === null && { backgroundColor: theme.chipActive, borderColor: theme.chipActive },
            ]}
            onPress={() => setCategoryId(null)}
          >
            <Text style={[styles.categoryChipText, categoryId === null && styles.categoryChipTextActive]}>
              All Categories
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                categoryId === cat.id && { backgroundColor: theme.chipActive, borderColor: theme.chipActive },
              ]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[styles.categoryChipText, categoryId === cat.id && styles.categoryChipTextActive]}>
                {cat.icon} {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
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

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {categoryGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="history" size={40} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>No stock existed on this date</Text>
        </View>
      ) : (
        categoryGroups.map((group) => (
          <View key={group.categoryId} style={[styles.categoryBlock, { width: TABLE_WIDTH }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              <View style={{ width: TABLE_WIDTH }}>
                <View style={[styles.categoryHeader, { backgroundColor: theme.headerBg }]}>
                  <Text style={styles.categoryHeaderText}>
                    {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.tableHeaderRow}>
                  <View style={[styles.leftHeaderGroup, { width: LEFT_WIDTH }]}>
                    <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.sn }]}>S.N.</Text>
                    <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.item }]}>Item Name</Text>
                  </View>
                  <View style={styles.rightHeaderGroup}>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.date }]}>Received</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.batch }]}>Lot/Batch No.</Text>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRight, { width: RIGHT_COLS.receivedQty }]}>Received Qty</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.issue }]}>Issue</Text>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRight, { width: RIGHT_COLS.stock }]}>Lot/Batch QTY</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry</Text>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRight, { width: RIGHT_COLS.total }]}>Total QTY</Text>
                  </View>
                </View>

                {group.items.map((item, itemIndex) => {
                  const groupHeight = item.batches.reduce(
                    (sum, b) => sum + getBatchRowHeight(b.issues.length), 0
                  );
                  const realItem = inventoryItemById.get(item.inventoryId);
                  const isEvenRow = itemIndex % 2 === 1;

                  return (
                    <TouchableOpacity
                      key={item.inventoryId}
                      style={[
                        styles.itemGroupRow,
                        { minHeight: groupHeight },
                        isEvenRow && styles.itemGroupRowAlt,
                      ]}
                      onPress={() => { if (realItem) onItemPress(realItem); }}
                      activeOpacity={0.7}
                      disabled={!realItem}
                    >
                      <View style={[styles.leftStrip, { width: LEFT_WIDTH, minHeight: groupHeight }, isEvenRow && styles.leftStripAlt]}>
                        <Text style={[styles.leftStripCell, { width: LEFT_COLS.sn }]}>{itemIndex + 1}</Text>
                        <View style={{ width: LEFT_COLS.item }}>
                          <Text style={[styles.leftStripCell, styles.itemNameCell]} numberOfLines={2}>{item.itemName}</Text>
                          {item.hasInconsistency && (
                            <View style={styles.inconsistencyBadge}>
                              <MaterialIcons name="warning" size={10} color="#b45309" />
                              <Text style={styles.inconsistencyText}>data issue</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.rightBatchRows}>
                        {item.batches.map((batch, batchIndex) => {
                          const useMultiLineIssue = batch.issues.length > 2;
                          const batchRowHeight = getBatchRowHeight(batch.issues.length);
                          const wasReceivedToday = batch.receivedDate === selectedDate;

                          return (
                            <View
                              key={batch.batchId}
                              style={[
                                styles.batchRow,
                                { minHeight: batchRowHeight },
                                batchIndex < item.batches.length - 1 && styles.batchRowDivider,
                              ]}
                            >
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.date }]}>{batch.receivedDate}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.batch }]} numberOfLines={1}>{batch.batchNo}</Text>
                              <Text style={[styles.tableCell, styles.numericCell, styles.receivedQtyCell, { width: RIGHT_COLS.receivedQty }]}>
                                {wasReceivedToday ? String(batch.originalQuantity) : "—"}
                              </Text>
                              <View style={{ width: RIGHT_COLS.issue }}>
                                {batch.issues.length === 0 ? (
                                  <Text style={[styles.tableCell, styles.issueCell]}>—</Text>
                                ) : useMultiLineIssue ? (
                                  batch.issues.map((iss, i) => (
                                    <Text key={i} style={[styles.tableCell, styles.issueCell, styles.issueMultiLine]} numberOfLines={1}>
                                      {iss.quantity} {batch.unit} {iss.source}
                                    </Text>
                                  ))
                                ) : (
                                  <Text style={[styles.tableCell, styles.issueCell]} numberOfLines={1}>
                                    {batch.issues.map((iss) => `${iss.quantity} ${batch.unit} ${iss.source}`).join(" • ")}
                                  </Text>
                                )}
                              </View>
                              <Text style={[styles.tableCell, styles.numericCell, styles.batchQtyCell, { width: RIGHT_COLS.stock, color: theme.batchQty }]}>{batch.quantity}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
                              <Text style={[styles.tableCell, styles.numericCell, styles.totalCell, { width: RIGHT_COLS.total, color: theme.total }]}>
                                {batchIndex === 0 ? String(item.historicalStock) : ""}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingIndicator: { marginTop: 40 },
  body: { flex: 1 },
  bodyContent: { padding: 12, paddingTop: 4, alignItems: "center" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", width: "100%", maxWidth: 500, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },
  categoryWrap: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    width: "100%", marginBottom: 8,
  },
  categoryChip: {
    height: 22, justifyContent: "center", paddingHorizontal: 10, borderRadius: 4,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1",
  },
  categoryChipText: { fontSize: 10, fontWeight: "600", color: "#475569" },
  categoryChipTextActive: { color: "#fff" },
  sortRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    width: "100%", marginBottom: 10,
  },
  sortLabel: { fontSize: 11, fontWeight: "700", color: "#94a3b8", marginRight: 2 },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1",
  },
  sortChipText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  sortChipTextActive: { color: "#fff" },
  fullScreenBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4,
    backgroundColor: "#0369a1", marginLeft: "auto",
  },
  fullScreenBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  errorBanner: {
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 6, marginBottom: 10, width: "100%", maxWidth: 500,
    borderWidth: 1, borderColor: "#fecaca",
  },
  errorBannerText: { color: "#b91c1c", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 16, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, overflow: "hidden",
  },
  horizontalScroll: {
    ...(Platform.OS === "web" ? ({ scrollbarWidth: "thin" } as any) : {}),
  },
  categoryHeader: { paddingVertical: 7, paddingHorizontal: 10 },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.6 },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 1, borderBottomColor: "#cbd5e1", paddingVertical: 8, marginTop: 2,
  },
  leftHeaderGroup: { flexDirection: "row" },
  rightHeaderGroup: { flexDirection: "row" },
  tableHeaderCell: { fontSize: 9, fontWeight: "800", color: "#334155", paddingHorizontal: 4, letterSpacing: 0.3 },
  tableHeaderCellRight: { textAlign: "right" },
  itemGroupRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#94a3b8" },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: {
    flexDirection: "row", alignItems: "flex-start",
    borderRightWidth: 1, borderRightColor: "#e2e8f0", backgroundColor: "#fff", paddingVertical: 4,
  },
  leftStripAlt: { backgroundColor: "#f8fafc" },
  leftStripCell: { fontSize: 9, color: "#475569", paddingHorizontal: 4 },
  itemNameCell: { fontWeight: "700", color: "#0f172a", fontSize: 11 },
  inconsistencyBadge: {
    flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 3, marginLeft: 4, backgroundColor: "#fef3c7", borderRadius: 3, alignSelf: "flex-start",
  },
  inconsistencyText: { fontSize: 7, color: "#92400e", fontWeight: "700" },
  rightBatchRows: { flex: 1 },
  batchRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2 },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#cbd5e1" },
  tableCell: { fontSize: 9, color: "#334155", paddingHorizontal: 4 },
  numericCell: { textAlign: "right" },
  receivedQtyCell: { color: "#475569", fontWeight: "700" },
  issueCell: { color: "#b91c1c", fontWeight: "600" },
  issueMultiLine: { marginBottom: 1 },
  batchQtyCell: { fontWeight: "800", fontSize: 10, paddingRight: 6 },
  totalCell: { fontWeight: "800", fontSize: 10, paddingRight: 6 },
  oosTableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8, paddingHorizontal: 10,
  },
  oosRow: {
    flexDirection: "row", alignItems: "center",
    height: ROW_HEIGHT,
    paddingHorizontal: 10,
    borderBottomWidth: 1.5, borderBottomColor: "#94a3b8",
  },
  oosNoteText: { fontSize: 10, color: "#dc2626", fontWeight: "700" },
});