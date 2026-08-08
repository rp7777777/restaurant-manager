// ============================================
// SERVORA ERP — InventoryBatchReport Component
// ✅ Full-screen Modal, restaurant-wide, category-grouped batch
//    report — Category → Item → Batch rows → Item Total QTY.
// ✅ ARCHITECTURE — READ-ONLY, DISPLAY-LAYER feature. No backend/
//    schema change.
// ✅ VISUAL ROW-SPAN — leftStrip (S.N. | Item Name | Total QTY, one
//    continuous block) + rightBatchRows (Date | Batch No. | Current
//    Stock | Unit | Expiry, one row per batch).
// ✅ Independent column-width system — LEFT_COLS and RIGHT_COLS are
//    two SEPARATE fixed-width tables (pixels, not flex/%), so the
//    left strip's three columns never share layout calculation with
//    the right side's five columns. The header row references the
//    same two constants, so header/body alignment can never drift.
// ✅ FIX — the category header is now INSIDE the same horizontal
//    ScrollView as the table header and body rows (previously it
//    sat outside, at a fixed TABLE_WIDTH that didn't actually
//    scroll with the rest of the table on narrow screens). Now the
//    category header, table header, left strip, and right batch
//    columns all belong to ONE horizontally scrollable surface —
//    scrolling right moves the category header along with
//    everything else, exactly like a real spreadsheet's frozen-top-
//    row-but-scrollable-horizontally behavior.
// ✅ S.N. is assigned PER ITEM, restarting at 1 for each category.
// ✅ Total QTY = sum of that item's VISIBLE-AND-ACTIVE batch
//    quantities. A fully-depleted item under showDepleted=true shows
//    Total QTY = 0 explicitly (audit transparency).
// ✅ Categories/items sorted alphabetically; batches within an item
//    shown in receivedDate ascending order.
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch, isActiveBatch } from "../types/inventory-batch";
import { Category } from "../types/category";
import { useInventory } from "../hooks/useInventory";
import { useCategoriesForPicker } from "../hooks/useCategoriesForPicker";
import { useAllInventoryBatches } from "../hooks/useAllInventoryBatches";

interface InventoryBatchReportProps {
  visible:      boolean;
  restaurantId: string;
  onClose:      () => void;
}

interface ItemWithBatches {
  item:          InventoryItem;
  batches:       InventoryBatch[];
  totalQuantity: number;
}

interface CategoryGroup {
  category: Category;
  items:    ItemWithBatches[];
}

const ROW_HEIGHT = 32;

const LEFT_COLS = { sn: 40, item: 130, total: 80 };
const RIGHT_COLS = { date: 90, batch: 100, stock: 80, unit: 60, expiry: 90 };

const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item + LEFT_COLS.total;
const RIGHT_WIDTH = RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.stock + RIGHT_COLS.unit + RIGHT_COLS.expiry;
const TABLE_WIDTH = LEFT_WIDTH + RIGHT_WIDTH;

export function InventoryBatchReport({ visible, restaurantId, onClose }: InventoryBatchReportProps) {
  const { items } = useInventory(restaurantId);
  const { categories } = useCategoriesForPicker(restaurantId);
  const { batches, loading, error } = useAllInventoryBatches(restaurantId);
  const [showDepleted, setShowDepleted] = useState(false);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const batchesByItem = new Map<string, InventoryBatch[]>();
    for (const batch of batches) {
      const list = batchesByItem.get(batch.inventoryId) ?? [];
      list.push(batch);
      batchesByItem.set(batch.inventoryId, list);
    }

    const itemsWithBatches: ItemWithBatches[] = [];
    for (const item of items) {
      const itemBatches = batchesByItem.get(item.id);
      if (!itemBatches || itemBatches.length === 0) continue;

      const activeBatches = itemBatches.filter(isActiveBatch);
      const totalQuantity = activeBatches.reduce((sum, b) => sum + b.quantity, 0);
      const visibleBatches = showDepleted ? itemBatches : activeBatches;

      if (visibleBatches.length === 0) continue;

      itemsWithBatches.push({ item, batches: visibleBatches, totalQuantity });
    }

    const itemsByCategory = new Map<string, ItemWithBatches[]>();
    for (const iwb of itemsWithBatches) {
      const list = itemsByCategory.get(iwb.item.categoryId) ?? [];
      list.push(iwb);
      itemsByCategory.set(iwb.item.categoryId, list);
    }

    const groups: CategoryGroup[] = [];
    for (const category of categories) {
      const groupItems = itemsByCategory.get(category.id);
      if (!groupItems || groupItems.length === 0) continue;

      groupItems.sort((a, b) => a.item.itemName.localeCompare(b.item.itemName));
      groups.push({ category, items: groupItems });
    }

    groups.sort((a, b) => a.category.name.localeCompare(b.category.name));

    return groups;
  }, [items, categories, batches, showDepleted]);

  const hasAnyDepletedBatches = batches.some((b) => !isActiveBatch(b));
  const isEmpty = !loading && categoryGroups.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Inventory Batch Report</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        {hasAnyDepletedBatches && (
          <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowDepleted((v) => !v)}>
            <MaterialIcons
              name={showDepleted ? "visibility-off" : "history"}
              size={16}
              color="#0369a1"
            />
            <Text style={styles.toggleBtnText}>
              {showDepleted ? "Hide depleted batches" : "Show depleted batches"}
            </Text>
          </TouchableOpacity>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {loading ? (
            <Text style={styles.loadingText}>Loading batch report...</Text>
          ) : isEmpty ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory-2" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No batch data recorded yet</Text>
            </View>
          ) : (
            categoryGroups.map((group) => (
              <View key={group.category.id} style={styles.categoryBlock}>
                {/* ── EVERYTHING — category header, table header, and
                    all item groups — sits inside ONE horizontal
                    ScrollView, so the whole table (including the
                    category header) scrolls together as a single
                    unit. ── */}
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
                        <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.total }]}>Total QTY</Text>
                      </View>
                      <View style={styles.rightHeaderGroup}>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.date }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.batch }]}>Lot/Batch No.</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.stock }]}>Stock</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry</Text>
                      </View>
                    </View>

                    {group.items.map((iwb, itemIndex) => {
                      const groupHeight = ROW_HEIGHT * iwb.batches.length;
                      return (
                        <View key={iwb.item.id} style={[styles.itemGroupRow, { minHeight: groupHeight }]}>
                          <View style={[styles.leftStrip, { width: LEFT_WIDTH, minHeight: groupHeight }]}>
                            <Text style={[styles.leftStripCell, { width: LEFT_COLS.sn }]}>{itemIndex + 1}</Text>
                            <Text style={[styles.leftStripCell, { width: LEFT_COLS.item }]} numberOfLines={2}>
                              {iwb.item.itemName}
                            </Text>
                            <Text style={[styles.leftStripCell, styles.totalCell, { width: LEFT_COLS.total }]}>
                              {iwb.totalQuantity}
                            </Text>
                          </View>

                          <View style={styles.rightBatchRows}>
                            {iwb.batches.map((batch) => (
                              <View key={batch.id} style={[styles.batchRow, { height: ROW_HEIGHT }]}>
                                <Text style={[styles.tableCell, { width: RIGHT_COLS.date }]}>{batch.receivedDate}</Text>
                                <Text style={[styles.tableCell, { width: RIGHT_COLS.batch }]} numberOfLines={1}>{batch.batchNo}</Text>
                                <Text style={[styles.tableCell, { width: RIGHT_COLS.stock }]}>{batch.quantity}</Text>
                                <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                                <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  toggleBtnText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
  errorBanner: {
    backgroundColor: "#fef2f2", marginHorizontal: 16, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingTop: 4 },
  loadingText: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 6,
    overflow: "hidden",
  },
  categoryHeader: {
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#fef9c3",
    borderBottomWidth: 2,
    borderBottomColor: "#1e293b",
    paddingVertical: 6,
  },
  leftHeaderGroup: { flexDirection: "row" },
  rightHeaderGroup: { flexDirection: "row" },
  tableHeaderCell: { fontSize: 10, fontWeight: "800", color: "#1e293b", paddingHorizontal: 4 },
  itemGroupRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
  },
  leftStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRightWidth: 2,
    borderRightColor: "#1e293b",
    backgroundColor: "#f8fafc",
    paddingVertical: 4,
  },
  leftStripCell: { fontSize: 11, color: "#334155", paddingHorizontal: 4 },
  totalCell: { fontWeight: "800", color: "#059669", fontSize: 13 },
  rightBatchRows: { flex: 1 },
  batchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tableCell: { fontSize: 11, color: "#334155", paddingHorizontal: 4 },
});