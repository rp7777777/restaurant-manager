// ============================================
// SERVORA ERP — InventoryTableView Component
// ✅ THIS IS THE MAIN INVENTORY SCREEN VIEW.
// ✅ Column order: S.N. → Item Name → Date → Lot/Batch No. →
//    Batch QTY → Unit → Expiry Date → Total QTY.
// ✅ FIX — column renamed "Current Stock" → "Batch QTY". This
//    column shows batch.quantity (a single batch's own remaining
//    quantity), NOT InventoryItem.currentStock (the item's
//    authoritative transactional stock counter) — "Current Stock"
//    was misleading, since a multi-batch item would show several
//    different "Current Stock" values (one per batch row) none of
//    which is actually the item's real current stock. "Batch QTY"
//    unambiguously labels what the column is: this specific batch's
//    quantity. The item's true authoritative stock remains visible
//    via the "Total QTY" column (sum of active batch quantities,
//    shown once per item) and via ItemDetailsDrawer's own "Current
//    Stock" row (which correctly shows item.currentStock).
// ✅ Archived items excluded; zero-batch items show "No batches
//    yet"; active batches only in the total; alphabetical category/
//    item sorting; S.N. restarts per category; search/filter
//    inherited via filteredItems; row tap opens ItemDetailsDrawer.
// ✅ Compact, Movement-History-style sizing (ROW_HEIGHT: 24,
//    tightened fonts/padding); categoryBlock sized to TABLE_WIDTH.
// ✅ FIX — double-border overlap on a multi-batch item's LAST row
//    resolved, mirroring the same fix already applied to
//    MovementHistoryModal.tsx: batchRow itself no longer carries a
//    border; a batchRowDivider style applies ONLY to batch rows
//    before the last one within an item group, so the group's own
//    bottom border (on itemGroupRow) is the only border on the
//    final row — no doubling/thicker line.
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch, isActiveBatch } from "../types/inventory-batch";
import { Category } from "../types/category";

interface InventoryTableViewProps {
  filteredItems:  InventoryItem[];
  allItemsCount:  number;
  categories:     Category[];
  batches:        InventoryBatch[];
  loading:        boolean;
  onItemPress:    (item: InventoryItem) => void;
}

interface ItemRow {
  item:          InventoryItem;
  batches:       InventoryBatch[];
  totalQuantity: number;
  hasBatches:    boolean;
}

interface CategoryGroup {
  category: Category;
  rows:     ItemRow[];
}

const ROW_HEIGHT = 24;

const LEFT_COLS = { sn: 30, item: 110 };
const RIGHT_COLS = { date: 74, batch: 84, stock: 62, unit: 48, expiry: 74, total: 62 };

const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item;
const RIGHT_WIDTH =
  RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.stock +
  RIGHT_COLS.unit + RIGHT_COLS.expiry + RIGHT_COLS.total;
const TABLE_WIDTH = LEFT_WIDTH + RIGHT_WIDTH;

export function InventoryTableView({
  filteredItems, allItemsCount, categories, batches, loading, onItemPress,
}: InventoryTableViewProps) {
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const batchesByItem = new Map<string, InventoryBatch[]>();
    for (const batch of batches) {
      const list = batchesByItem.get(batch.inventoryId) ?? [];
      list.push(batch);
      batchesByItem.set(batch.inventoryId, list);
    }

    const rowsByCategory = new Map<string, ItemRow[]>();
    for (const item of filteredItems) {
      if (item.isActive === false) continue;

      const itemBatches = (batchesByItem.get(item.id) ?? []).filter(isActiveBatch);
      const totalQuantity = itemBatches.reduce((sum, b) => sum + b.quantity, 0);

      const row: ItemRow = {
        item,
        batches: itemBatches,
        totalQuantity,
        hasBatches: itemBatches.length > 0,
      };

      const list = rowsByCategory.get(item.categoryId) ?? [];
      list.push(row);
      rowsByCategory.set(item.categoryId, list);
    }

    const groups: CategoryGroup[] = [];
    for (const category of categories) {
      const rows = rowsByCategory.get(category.id);
      if (!rows || rows.length === 0) continue;

      rows.sort((a, b) => a.item.itemName.localeCompare(b.item.itemName));
      groups.push({ category, rows });
    }

    groups.sort((a, b) => a.category.name.localeCompare(b.category.name));

    return groups;
  }, [filteredItems, categories, batches]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0369a1" style={styles.loadingIndicator} />;
  }

  if (categoryGroups.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="inventory-2" size={40} color="#cbd5e1" />
        <Text style={styles.emptyStateText}>
          {allItemsCount === 0 ? "No inventory items yet" : "No items match your filters"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      {categoryGroups.map((group) => (
        <View key={group.category.id} style={[styles.categoryBlock, { width: TABLE_WIDTH }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ width: TABLE_WIDTH }}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryHeaderText}>
                  {group.category.icon ? `${group.category.icon} ` : ""}{group.category.name.toUpperCase()}
                </Text>
              </View>

              <View style={styles.tableHeaderRow}>
                <View style={[styles.leftHeaderGroup, { width: LEFT_WIDTH }]}>
                  <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.sn }]}>S.N.</Text>
                  <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.item }]}>Item Name</Text>
                </View>
                <View style={styles.rightHeaderGroup}>
                  <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.date }]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.batch }]}>Lot/Batch No.</Text>
                  <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.stock }]}>Batch QTY</Text>
                  <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                  <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry Date</Text>
                  <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.total }]}>Total QTY</Text>
                </View>
              </View>

              {group.rows.map((row, itemIndex) => {
                const rowCount = row.hasBatches ? row.batches.length : 1;
                const groupHeight = ROW_HEIGHT * rowCount;

                return (
                  <TouchableOpacity
                    key={row.item.id}
                    style={[styles.itemGroupRow, { minHeight: groupHeight }]}
                    onPress={() => onItemPress(row.item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.leftStrip, { width: LEFT_WIDTH, minHeight: groupHeight }]}>
                      <Text style={[styles.leftStripCell, { width: LEFT_COLS.sn }]}>{itemIndex + 1}</Text>
                      <Text style={[styles.leftStripCell, { width: LEFT_COLS.item }]} numberOfLines={2}>
                        {row.item.itemName}
                      </Text>
                    </View>

                    <View style={styles.rightBatchRows}>
                      {row.hasBatches ? (
                        row.batches.map((batch, batchIndex) => (
                          <View
                            key={batch.id}
                            style={[
                              styles.batchRow,
                              { height: ROW_HEIGHT },
                              batchIndex < row.batches.length - 1 && styles.batchRowDivider,
                            ]}
                          >
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.date }]}>{batch.receivedDate}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.batch }]} numberOfLines={1}>{batch.batchNo}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.stock }]}>{batch.quantity}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                            <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
                            <Text style={[styles.tableCell, styles.totalCell, { width: RIGHT_COLS.total }]}>
                              {batchIndex === 0 ? String(row.totalQuantity) : ""}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={[styles.batchRow, { height: ROW_HEIGHT }]}>
                          <Text style={[styles.tableCell, styles.noBatchText, { width: RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.stock + RIGHT_COLS.unit + RIGHT_COLS.expiry }]}>
                            No batches yet — use Receive Batch to add stock
                          </Text>
                          <Text style={[styles.tableCell, { width: RIGHT_COLS.total }]}>0</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingIndicator: { marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  body: { flex: 1 },
  bodyContent: { padding: 12, paddingTop: 4, alignItems: "center" },
  categoryBlock: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 6,
    overflow: "hidden",
  },
  categoryHeader: {
    backgroundColor: "#059669",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#fef9c3",
    borderBottomWidth: 2,
    borderBottomColor: "#1e293b",
    paddingVertical: 4,
  },
  leftHeaderGroup: { flexDirection: "row" },
  rightHeaderGroup: { flexDirection: "row" },
  tableHeaderCell: { fontSize: 9, fontWeight: "800", color: "#1e293b", paddingHorizontal: 3 },
  itemGroupRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
  },
  leftStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  leftStripCell: { fontSize: 9, color: "#334155", paddingHorizontal: 3 },
  rightBatchRows: { flex: 1 },
  // ✅ FIX — no border of its own now.
  batchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  // ✅ NEW — applied only to batch rows before the last one within
  // an item group.
  batchRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tableCell: { fontSize: 9, color: "#334155", paddingHorizontal: 3 },
  totalCell: { fontWeight: "800", color: "#059669", fontSize: 10 },
  noBatchText: { fontSize: 9, color: "#94a3b8", fontStyle: "italic" },
});