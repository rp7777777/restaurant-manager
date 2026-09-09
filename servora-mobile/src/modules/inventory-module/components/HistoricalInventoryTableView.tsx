// ============================================
// SERVORA ERP — HistoricalInventoryTableView Component
// ✅ Migration Steps 1-5 — single table for Today and Historical.
// ✅ Out of Stock dedicated table display (Today mode only).
// ✅ Total QTY and Edit arrow are item-level columns, vertically
//    centered across groupHeight.
// ✅ Received Qty, Lot/Batch QTY, Total QTY are center-aligned.
// ✅ Item Name is vertically centered within its row.
// ✅ Column dividers are centralized absolute-positioned lines,
//    using onLayout-measured tableArea height (+4px buffer to fully
//    reach the bottom of the last row).
// ✅ Rows are non-interactive as a whole — ONLY the Edit arrow icon
//    (Today mode only) opens ItemDetailsDrawer.
// ✅ Edit column is entirely excluded from the table layout in
//    Historical mode.
// ✅ "Received" header renamed to "Received Date". The receivedDate
//    cell is highlighted (bold, darker) when
//    batch.receivedDate === selectedDate.
// ✅ Category header shows the currently-viewed date (always the
//    actual formatted date, never "Today").
// ✅ Received Date/Lot-Batch-No/Issue/Unit/Expiry are vertically
//    center-aligned within each batch row (batchRow alignItems:
//    "center", was "flex-start").
// ✅ NEW — Issue column: batches with MORE THAN 2 entries now show
//    them PAIRED, 2 entries per line joined by " / ", instead of one
//    entry per line — reduces row height for batches with many
//    issues (e.g. 4 entries -> 2 lines, not 4). 1-2 entries still
//    render on a single line joined by " • ", unchanged.
//    getBatchRowHeight() updated to match: height scales by
//    ceil(issueCount / 2) lines, not issueCount lines.
// ✅ NEW — batch-to-batch divider line (within a multi-batch item)
//    darkened (#cbd5e1 -> #94a3b8) to match the visibility of other
//    table lines. (Known remaining cosmetic gap: this divider spans
//    only the batch-detail columns, not the item-level Total QTY/
//    Edit columns to their right — deferred, not fixed here.)
// ✅ Edit arrow icon is red (#dc2626). Lot/Batch QTY and Total QTY
//    numbers are fixed black (#0f172a).
// ✅ Column widths fit within 900px without horizontal scrolling.
//    Text wrapping (no numberOfLines truncation) on Item Name/Batch No.
// ✅ oosRow uses minHeight so wrapped text never clips.
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity } from "react-native";
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
const LEFT_COLS = { sn: 35, item: 130 };
const RIGHT_COLS = { date: 75, batch: 85, receivedQty: 70, issue: 175, stock: 70, unit: 50, expiry: 75 };
const TOTAL_COL = 75;
const ARROW_COL = 35;
const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item;
const BATCH_COLS_WIDTH =
  RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty + RIGHT_COLS.issue + RIGHT_COLS.stock +
  RIGHT_COLS.unit + RIGHT_COLS.expiry;
const TABLE_WIDTH = LEFT_WIDTH + BATCH_COLS_WIDTH + TOTAL_COL + ARROW_COL;

const DIVIDER_X_POSITIONS = [
  LEFT_COLS.sn,
  LEFT_COLS.sn + LEFT_COLS.item,
  LEFT_WIDTH + RIGHT_COLS.date,
  LEFT_WIDTH + RIGHT_COLS.date + RIGHT_COLS.batch,
  LEFT_WIDTH + RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty,
  LEFT_WIDTH + RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty + RIGHT_COLS.issue,
  LEFT_WIDTH + BATCH_COLS_WIDTH - RIGHT_COLS.unit - RIGHT_COLS.expiry,
  LEFT_WIDTH + BATCH_COLS_WIDTH - RIGHT_COLS.expiry,
  LEFT_WIDTH + BATCH_COLS_WIDTH,
  LEFT_WIDTH + BATCH_COLS_WIDTH + TOTAL_COL,
];

const OOS_TABLE_WIDTH = 900;
const OOS_COLS = { sn: 50, item: 260, date: 160, note: 180 };

const UNCATEGORIZED_ID = "__uncategorized__";

// ✅ UPDATED — 2 issue entries per line (was 1 per line for >2
// entries). issueCount <= 2 stays a single line.
function getBatchRowHeight(issueCount: number): number {
  if (issueCount <= 2) return ROW_HEIGHT;
  const lineCount = Math.ceil(issueCount / 2);
  return ROW_HEIGHT * lineCount;
}

function formatCategoryHeaderDate(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function HistoricalInventoryTableView({
  restaurantId, selectedDate, categories, inventoryItems,
  searchQuery, setSearchQuery, categoryId, setCategoryId,
  onItemPress, sort, setSort, isHistorical, onOpenFullScreen,
  stockStatus, todayISO, categoryMapForExpiry, restaurantDefaultExpiryAlertDays,
}: HistoricalInventoryTableViewProps) {
  const theme = isHistorical
    ? { headerBg: "#1e3a5f", chipActive: "#1e3a5f" }
    : { headerBg: "#059669", chipActive: "#1e293b" };

  const effectiveTableWidth = isHistorical ? TABLE_WIDTH - ARROW_COL : TABLE_WIDTH;

  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

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
                <Text style={styles.categoryHeaderDate}>{formatCategoryHeaderDate(selectedDate)}</Text>
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
                  <Text style={[styles.itemNameCell, { width: OOS_COLS.item }]}>{item.itemName}</Text>
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
        categoryGroups.map((group) => {
          const groupHeights = group.items.map((item) =>
            item.batches.reduce((sum, b) => sum + getBatchRowHeight(b.issues.length), 0)
          );
          const measuredHeight = tableAreaHeights[group.categoryId] ?? 0;

          return (
            <View key={group.categoryId} style={[styles.categoryBlock, { width: effectiveTableWidth }]}>
              <View style={[styles.categoryHeader, { backgroundColor: theme.headerBg }]}>
                <Text style={styles.categoryHeaderText}>
                  {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                </Text>
                <Text style={styles.categoryHeaderDate}>{formatCategoryHeaderDate(selectedDate)}</Text>
              </View>

              <View
                style={styles.tableArea}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  setTableAreaHeights((prev) =>
                    prev[group.categoryId] === h ? prev : { ...prev, [group.categoryId]: h }
                  );
                }}
              >
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.leftHeaderGroup, { width: LEFT_WIDTH }]}>
                    <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.sn }]}>S.N.</Text>
                    <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.item }]}>Item Name</Text>
                  </View>
                  <View style={styles.rightHeaderGroup}>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.date }]}>Received Date</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.batch }]}>Lot/Batch No.</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.receivedQty }]}>Received Qty</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.issue }]}>Issue</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.stock }]}>Lot/Batch QTY</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry</Text>
                  </View>
                  <Text style={[styles.tableHeaderCell, { width: TOTAL_COL }]}>Total QTY</Text>
                  {!isHistorical && (
                    <Text style={[styles.tableHeaderCell, { width: ARROW_COL, textAlign: "center" }]}>Edit</Text>
                  )}
                </View>

                {group.items.map((item, itemIndex) => {
                  const groupHeight = groupHeights[itemIndex];
                  const realItem = inventoryItemById.get(item.inventoryId);
                  const isEvenRow = itemIndex % 2 === 1;

                  return (
                    <View
                      key={item.inventoryId}
                      style={[
                        styles.itemGroupRow,
                        { minHeight: groupHeight },
                        isEvenRow && styles.itemGroupRowAlt,
                      ]}
                    >
                      <View style={[styles.leftStrip, { width: LEFT_WIDTH, minHeight: groupHeight }, isEvenRow && styles.leftStripAlt]}>
                        <Text style={[styles.leftStripCell, { width: LEFT_COLS.sn }]}>{itemIndex + 1}</Text>
                        <View style={{ width: LEFT_COLS.item }}>
                          <Text style={[styles.leftStripCell, styles.itemNameCell]}>{item.itemName}</Text>
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
                              <Text style={[
                                styles.tableCell,
                                { width: RIGHT_COLS.date },
                                wasReceivedToday && styles.receivedDateHighlight,
                              ]}>
                                {batch.receivedDate}
                              </Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.batch }]}>{batch.batchNo}</Text>
                              <Text style={[styles.tableCell, styles.receivedQtyCell, { width: RIGHT_COLS.receivedQty }]}>
                                {wasReceivedToday ? String(batch.originalQuantity) : "—"}
                              </Text>
                              <View style={{ width: RIGHT_COLS.issue }}>
                                {batch.issues.length === 0 ? (
                                  <Text style={[styles.tableCell, styles.issueCell]}>—</Text>
                                ) : batch.issues.length <= 2 ? (
                                  <Text style={[styles.tableCell, styles.issueCell]} numberOfLines={1}>
                                    {batch.issues.map((iss) => `${iss.quantity} ${batch.unit} ${iss.source}`).join(" • ")}
                                  </Text>
                                ) : (
                                  Array.from({ length: Math.ceil(batch.issues.length / 2) }).map((_, lineIdx) => {
                                    const pair = batch.issues.slice(lineIdx * 2, lineIdx * 2 + 2);
                                    return (
                                      <Text key={lineIdx} style={[styles.tableCell, styles.issueCell, styles.issueMultiLine]} numberOfLines={1}>
                                        {pair.map((iss) => `${iss.quantity} ${batch.unit} ${iss.source}`).join(" / ")}
                                      </Text>
                                    );
                                  })
                                )}
                              </View>
                              <Text style={[styles.tableCell, styles.batchQtyCell, { width: RIGHT_COLS.stock }]}>{batch.quantity}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
                            </View>
                          );
                        })}
                      </View>

                      <View style={{ width: TOTAL_COL, minHeight: groupHeight, justifyContent: "center", alignItems: "center" }}>
                        <Text style={styles.totalCell}>{String(item.historicalStock)}</Text>
                      </View>

                      {!isHistorical && (
                        <View style={{ width: ARROW_COL, minHeight: groupHeight, justifyContent: "center", alignItems: "center" }}>
                          {realItem && (
                            <TouchableOpacity onPress={() => onItemPress(realItem)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <MaterialIcons name="chevron-right" size={16} color="#dc2626" />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                {measuredHeight > 0 && DIVIDER_X_POSITIONS.map((x) => (
                  <View
                    key={x}
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: x,
                      top: 0,
                      height: measuredHeight + 4,
                      width: 1,
                      backgroundColor: "#94a3b8",
                    }}
                  />
                ))}
              </View>
            </View>
          );
        })
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
    marginBottom: 16, borderWidth: 1.5, borderColor: "#475569", borderRadius: 4, overflow: "hidden",
  },
  categoryHeader: {
    paddingVertical: 7, paddingHorizontal: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.6 },
  categoryHeaderDate: { color: "#fff", fontWeight: "700", fontSize: 10 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8, marginTop: 2,
  },
  leftHeaderGroup: { flexDirection: "row" },
  rightHeaderGroup: { flexDirection: "row" },
  tableHeaderCell: { fontSize: 9, fontWeight: "800", color: "#334155", paddingHorizontal: 4, letterSpacing: 0.3 },
  itemGroupRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#475569" },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingVertical: 4,
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
  batchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  tableCell: { fontSize: 9, color: "#334155", paddingHorizontal: 4 },
  receivedDateHighlight: { color: "#0f172a", fontWeight: "800" },
  receivedQtyCell: { color: "#475569", fontWeight: "700", textAlign: "center" },
  issueCell: { color: "#b91c1c", fontWeight: "600" },
  issueMultiLine: { marginBottom: 1 },
  batchQtyCell: { fontWeight: "800", fontSize: 10, color: "#0f172a", textAlign: "center" },
  totalCell: { fontWeight: "800", fontSize: 10, color: "#0f172a", textAlign: "center" },
  oosTableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8, paddingHorizontal: 10,
  },
  oosRow: {
    flexDirection: "row", alignItems: "center",
    minHeight: ROW_HEIGHT,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 2, borderBottomColor: "#1e293b",
  },
  oosNoteText: { fontSize: 10, color: "#dc2626", fontWeight: "700" },
});