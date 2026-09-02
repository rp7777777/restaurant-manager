// ============================================
// SERVORA ERP — HistoricalInventoryTableView Component
// ✅ Migration Step 1 — onItemPress (real InventoryItem lookup).
// ✅ Migration Step 2 — sort (Name/Stock).
// ✅ DESIGN — professional/corporate visual pass: navy/slate palette,
//    right-aligned numeric columns, subtle pill badges, zebra-striped
//    rows, wider Total QTY column with right padding (numbers no
//    longer flush against column edge), hidden scrollbar (drag/swipe
//    still works), extra spacing between category header and column
//    header row.
// ✅ NEW — multi-line Issue column: a batch with MORE THAN 2 Issue
//    entries on the selected date shows each entry on its own line
//    (row height grows to fit); 1-2 entries stay on one line joined
//    by "•", as before. Each batch row's height is now computed
//    per-row (not a fixed ROW_HEIGHT for the whole group) — the
//    left-hand item-name strip's total height is the SUM of all its
//    batch rows' individual heights.
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Category } from "../types/category";
import { InventoryItem } from "../types/inventory";
import { useHistoricalInventory, HistoricalItemStock } from "../hooks/useHistoricalInventory";

type HistoricalSortOption = "name-asc" | "stock-asc";

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
}

interface HistoricalCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        HistoricalItemStock[];
}

const ROW_HEIGHT = 26;
const LEFT_COLS = { sn: 40, item: 170 };
const RIGHT_COLS = { date: 90, batch: 110, issue: 160, stock: 90, unit: 70, expiry: 90, total: 122 };
const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item;
const RIGHT_WIDTH =
  RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.issue + RIGHT_COLS.stock +
  RIGHT_COLS.unit + RIGHT_COLS.expiry + RIGHT_COLS.total;
const TABLE_WIDTH = LEFT_WIDTH + RIGHT_WIDTH;

const UNCATEGORIZED_ID = "__uncategorized__";

// ✅ NEW — each batch's own row height, based on its Issue entry
// count (>2 entries -> one line per entry; otherwise one line).
function getBatchRowHeight(issueCount: number): number {
  return issueCount > 2 ? ROW_HEIGHT * issueCount : ROW_HEIGHT;
}

export function HistoricalInventoryTableView({
  restaurantId, selectedDate, categories, inventoryItems,
  searchQuery, setSearchQuery, categoryId, setCategoryId,
  onItemPress, sort, setSort,
}: HistoricalInventoryTableViewProps) {
  const { itemsWithHistoricalStock, loading, error } =
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
    if (categoryId) {
      result = result.filter((it) => it.categoryId === categoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((it) => it.itemName.toLowerCase().includes(q));
    }
    return result;
  }, [itemsWithHistoricalStock, searchQuery, categoryId]);

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

  if (loading) {
    return <ActivityIndicator size="large" color="#1e3a5f" style={styles.loadingIndicator} />;
  }

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search historical items..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <TouchableOpacity
            style={[styles.categoryChip, categoryId === null && styles.categoryChipActive]}
            onPress={() => setCategoryId(null)}
          >
            <Text style={[styles.categoryChipText, categoryId === null && styles.categoryChipTextActive]}>
              All Categories
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, categoryId === cat.id && styles.categoryChipActive]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[styles.categoryChipText, categoryId === cat.id && styles.categoryChipTextActive]}>
                {cat.icon} {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        <TouchableOpacity
          style={[styles.sortChip, sort === "name-asc" && styles.sortChipActive]}
          onPress={() => setSort("name-asc")}
        >
          <MaterialIcons name="sort-by-alpha" size={13} color={sort === "name-asc" ? "#fff" : "#64748b"} />
          <Text style={[styles.sortChipText, sort === "name-asc" && styles.sortChipTextActive]}>Name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sort === "stock-asc" && styles.sortChipActive]}
          onPress={() => setSort("stock-asc")}
        >
          <MaterialIcons name="trending-up" size={13} color={sort === "stock-asc" ? "#fff" : "#64748b"} />
          <Text style={[styles.sortChipText, sort === "stock-asc" && styles.sortChipTextActive]}>Stock</Text>
        </TouchableOpacity>
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
                <View style={styles.categoryHeader}>
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
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.issue }]}>Issue</Text>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRight, { width: RIGHT_COLS.stock }]}>Lot/Batch QTY</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry</Text>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRight, { width: RIGHT_COLS.total }]}>Total QTY</Text>
                  </View>
                </View>

                {group.items.map((item, itemIndex) => {
                  // ✅ NEW — total group height is the SUM of each
                  // batch's own (potentially multi-line) height.
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
                              <Text style={[styles.tableCell, styles.numericCell, styles.batchQtyCell, { width: RIGHT_COLS.stock }]}>{batch.quantity}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
                              <Text style={[styles.tableCell, styles.numericCell, styles.totalCell, { width: RIGHT_COLS.total }]}>
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
  categoryScroll: { maxHeight: 30, marginBottom: 8, width: "100%" },
  categoryScrollContent: { gap: 6, alignItems: "center" },
  categoryChip: {
    height: 22, justifyContent: "center", paddingHorizontal: 10, borderRadius: 4,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1",
  },
  categoryChipActive: { backgroundColor: "#1e3a5f", borderColor: "#1e3a5f" },
  categoryChipText: { fontSize: 10, fontWeight: "600", color: "#475569" },
  categoryChipTextActive: { color: "#fff" },
  sortRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    width: "100%", maxWidth: 500, marginBottom: 10,
  },
  sortLabel: { fontSize: 11, fontWeight: "700", color: "#94a3b8", marginRight: 2 },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1",
  },
  sortChipActive: { backgroundColor: "#1e3a5f", borderColor: "#1e3a5f" },
  sortChipText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  sortChipTextActive: { color: "#fff" },
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
  categoryHeader: { backgroundColor: "#1e3a5f", paddingVertical: 7, paddingHorizontal: 10 },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.6 },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    // ✅ NEW — extra top/bottom padding creates visible gap between
    // the navy category header above and this column-header row.
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
  // ✅ CHANGED — alignItems: "flex-start" (was "center") so
  // multi-line Issue content doesn't push other columns off-center.
  batchRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2 },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#cbd5e1" },
  tableCell: { fontSize: 9, color: "#334155", paddingHorizontal: 4 },
  numericCell: { textAlign: "right" },
  issueCell: { color: "#b91c1c", fontWeight: "600" },
  issueMultiLine: { marginBottom: 1 },
  batchQtyCell: { fontWeight: "800", color: "#1e3a5f", fontSize: 10, paddingRight: 6 },
  totalCell: { fontWeight: "800", color: "#1e3a5f", fontSize: 10, paddingRight: 6 },
});