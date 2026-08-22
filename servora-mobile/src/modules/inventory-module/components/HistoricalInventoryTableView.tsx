// ============================================
// SERVORA ERP — HistoricalInventoryTableView Component
// ✅ NEW, SEPARATE component — the existing, FROZEN
//    InventoryTableView.tsx is NEVER modified or reused for
//    historical mode.
// ✅ useHistoricalInventory() called with inventoryItems param so
//    categoryId metadata can be joined by inventoryId — no
//    duplicate Firestore subscription.
// ✅ FIX — results are now GROUPED BY CATEGORY, matching
//    InventoryTableView.tsx's own visual language exactly (one
//    bordered block per category, category name as a colored
//    header, alphabetically sorted categories, S.N. restarting at 1
//    per category). Previously all filtered items rendered under a
//    single flat "HISTORICAL STOCK" block regardless of category —
//    functionally correct filtering, but visually inconsistent with
//    the rest of the Inventory module. Items whose categoryId
//    doesn't match any category in the `categories` list (a rare
//    edge case — e.g. category deleted after the historical data was
//    recorded) are grouped under a final "Uncategorized" block
//    rather than silently dropped.
// ✅ Category filter chips — category reflects the item's CURRENT
//    category assignment (a live-metadata join, not a historical
//    snapshot of what category it was in ON that date) — documented,
//    accepted limitation.
// ✅ Sort/stock-status filters deliberately NOT included — those are
//    live-inventory-specific concepts without a well-defined
//    historical meaning.
// ✅ hasInconsistency surfaced as a small warning indicator per item.
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Category } from "../types/category";
import { InventoryItem } from "../types/inventory";
import { useHistoricalInventory, HistoricalItemStock } from "../hooks/useHistoricalInventory";

interface HistoricalInventoryTableViewProps {
  restaurantId:   string;
  selectedDate:   string;
  categories:     Category[];
  inventoryItems: InventoryItem[];
  searchQuery:    string;
  setSearchQuery: (q: string) => void;
  categoryId:     string | null;
  setCategoryId:  (id: string | null) => void;
}

interface HistoricalCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        HistoricalItemStock[];
}

const ROW_HEIGHT = 24;
const LEFT_COLS = { sn: 30, item: 110 };
const RIGHT_COLS = { date: 74, batch: 84, stock: 62, unit: 48, expiry: 74, total: 62 };
const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item;
const RIGHT_WIDTH =
  RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.stock +
  RIGHT_COLS.unit + RIGHT_COLS.expiry + RIGHT_COLS.total;
const TABLE_WIDTH = LEFT_WIDTH + RIGHT_WIDTH;

const UNCATEGORIZED_ID = "__uncategorized__";

export function HistoricalInventoryTableView({
  restaurantId, selectedDate, categories, inventoryItems,
  searchQuery, setSearchQuery, categoryId, setCategoryId,
}: HistoricalInventoryTableViewProps) {
  const { itemsWithHistoricalStock, loading, error } =
    useHistoricalInventory(restaurantId, selectedDate, inventoryItems);

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

  // ✅ NEW — group filteredItems by category, mirroring
  // InventoryTableView.tsx's own grouping approach.
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
  }, [filteredItems, categories]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0369a1" style={styles.loadingIndicator} />;
  }

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search historical items..."
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
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
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
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.stock }]}>Batch Qty</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.total }]}>Total QTY</Text>
                  </View>
                </View>

                {group.items.map((item, itemIndex) => {
                  const rowCount = item.batches.length;
                  const groupHeight = ROW_HEIGHT * rowCount;

                  return (
                    <View key={item.inventoryId} style={[styles.itemGroupRow, { minHeight: groupHeight }]}>
                      <View style={[styles.leftStrip, { width: LEFT_WIDTH, minHeight: groupHeight }]}>
                        <Text style={[styles.leftStripCell, { width: LEFT_COLS.sn }]}>{itemIndex + 1}</Text>
                        <View style={{ width: LEFT_COLS.item }}>
                          <Text style={styles.leftStripCell} numberOfLines={2}>{item.itemName}</Text>
                          {item.hasInconsistency && (
                            <View style={styles.inconsistencyBadge}>
                              <MaterialIcons name="warning" size={10} color="#d97706" />
                              <Text style={styles.inconsistencyText}>data issue</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.rightBatchRows}>
                        {item.batches.map((batch, batchIndex) => (
                          <View
                            key={batch.batchId}
                            style={[
                              styles.batchRow,
                              { height: ROW_HEIGHT },
                              batchIndex < item.batches.length - 1 && styles.batchRowDivider,
                            ]}
                          >
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.date }]}>{batch.receivedDate}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.batch }]} numberOfLines={1}>{batch.batchNo}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.stock }]}>{batch.quantity}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
                            <Text style={[styles.tableCell, styles.totalCell, { width: RIGHT_COLS.total }]}>
                              {batchIndex === 0 ? String(item.historicalStock) : ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
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
    borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },
  categoryScroll: { maxHeight: 30, marginBottom: 10, width: "100%" },
  categoryScrollContent: { gap: 6, alignItems: "center" },
  categoryChip: {
    height: 22, justifyContent: "center", paddingHorizontal: 9, borderRadius: 12,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  categoryChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  categoryChipText: { fontSize: 10, fontWeight: "600", color: "#475569" },
  categoryChipTextActive: { color: "#fff" },
  errorBanner: {
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 8, marginBottom: 10, width: "100%", maxWidth: 500,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 16, borderWidth: 1, borderColor: "#1e293b", borderRadius: 6, overflow: "hidden",
  },
  categoryHeader: { backgroundColor: "#7c3aed", paddingVertical: 6, paddingHorizontal: 10 },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#fef9c3",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 4,
  },
  leftHeaderGroup: { flexDirection: "row" },
  rightHeaderGroup: { flexDirection: "row" },
  tableHeaderCell: { fontSize: 9, fontWeight: "800", color: "#1e293b", paddingHorizontal: 3 },
  itemGroupRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  leftStrip: {
    flexDirection: "row", alignItems: "flex-start",
    borderRightWidth: 1, borderRightColor: "#cbd5e1", backgroundColor: "#f8fafc", paddingVertical: 3,
  },
  leftStripCell: { fontSize: 9, color: "#334155", paddingHorizontal: 3 },
  inconsistencyBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 3, marginTop: 2 },
  inconsistencyText: { fontSize: 7, color: "#d97706", fontWeight: "700" },
  rightBatchRows: { flex: 1 },
  batchRow: { flexDirection: "row", alignItems: "center" },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tableCell: { fontSize: 9, color: "#334155", paddingHorizontal: 3 },
  totalCell: { fontWeight: "800", color: "#7c3aed", fontSize: 10 },
});