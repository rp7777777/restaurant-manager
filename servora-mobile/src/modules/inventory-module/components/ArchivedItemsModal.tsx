// ============================================
// SERVORA ERP — ArchivedItemsModal Component
// ✅ UI REDESIGN — category-grouped, batch-level table (matching
//    HistoricalInventoryTableView's own design language).
// ✅ "Archived Date" column shows item.archivedAt (formatted), red
//    for visual emphasis.
// ✅ Column divider lines + table width fixed at exactly 900px.
// ✅ Restore calls restoreInventoryItem() — sets isActive back to
//    true and clears archivedAt.
// ✅ NEW — TWO TABS: "Items" (item-level archived — whole
//    InventoryItem.isActive === false, unchanged from before) and
//    "Batches" (NEW — batch-level archived: a batch with its own
//    isActive === false while its PARENT ITEM remains fully active).
//    This distinction matters: a banana batch being archived does
//    NOT make "Banana" an archived item — it stays a normal active
//    item with one fewer usable batch. Previously, batch-level
//    archives were invisible from this screen entirely (only visible
//    inside each item's own detail drawer). The Batches tab surfaces
//    them here too, category-grouped the same way, with the SAME
//    Archived Date column semantics (item.archivedAt for Items tab,
//    batch.archivedAt for Batches tab) and its own Restore action
//    (restoreInventoryBatch(), batch-level, independent of
//    restoreInventoryItem()).
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch } from "../types/inventory-batch";
import { Category } from "../types/category";
import { restoreInventoryItem } from "../services/inventory-item-service";
import { restoreInventoryBatch } from "../repository/inventory-batch-repository";
import { useAllInventoryBatches } from "../hooks/useAllInventoryBatches";

const isWeb = Platform.OS === "web";

interface ArchivedItemsModalProps {
  visible:      boolean;
  items:        InventoryItem[]; // full, unfiltered list — this component filters to archived itself
  categoryMap:  Map<string, Category>;
  restaurantId: string;
  fmt:          (n: number) => string;
  onClose:      () => void;
}

type ArchivedTab = "items" | "batches";

interface ArchivedBatchRow {
  batchId: string;
  batchNo: string;
  quantity: number;
}

interface ArchivedItemRow {
  inventoryId:   string;
  itemName:      string;
  unit:          string;
  archivedDate:  string;
  batches:       ArchivedBatchRow[];
}

interface ArchivedCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        ArchivedItemRow[];
}

// ✅ Batches-tab row shape: ONE row per archived batch (not merged
// under an item the way Items-tab rows are), since each archived
// batch is its own independent restore target.
interface ArchivedBatchOnlyRow {
  batchId:      string;
  batchNo:      string;
  itemName:     string;
  quantity:     number;
  unit:         string;
  archivedDate: string;
  categoryId:   string | null;
}

interface ArchivedBatchCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  rows:         ArchivedBatchOnlyRow[];
}

const UNCATEGORIZED_ID = "__uncategorized__";
const ROW_HEIGHT = 26;
const COLS = { sn: 35, item: 220, batch: 210, archived: 105, qty: 90, unit: 65, action: 175 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.batch + COLS.archived + COLS.qty + COLS.unit + COLS.action;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.archived; positions.push(x);
  x += COLS.qty; positions.push(x);
  x += COLS.unit; positions.push(x);
  return positions;
})();

function formatArchivedDate(archivedAt: unknown): string {
  if (!archivedAt) return "—";
  const raw = archivedAt as any;
  const d: Date | null = typeof raw?.toDate === "function" ? raw.toDate() : (raw instanceof Date ? raw : null);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ArchivedItemsModal({
  visible, items, categoryMap, restaurantId, fmt, onClose,
}: ArchivedItemsModalProps) {
  const [activeTab, setActiveTab] = useState<ArchivedTab>("items");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});
  const { batches, loading: batchesLoading } = useAllInventoryBatches(restaurantId);

  const itemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const archivedItems = useMemo(() => {
    return items
      .filter((item) => item.isActive === false)
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items]);

  // ✅ Items tab — unchanged item-level archive logic.
  const categoryGroups = useMemo<ArchivedCategoryGroup[]>(() => {
    const batchesByInventoryId = new Map<string, ArchivedBatchRow[]>();
    for (const b of batches) {
      const list = batchesByInventoryId.get(b.inventoryId) ?? [];
      list.push({ batchId: b.id, batchNo: b.batchNo, quantity: b.quantity });
      batchesByInventoryId.set(b.inventoryId, list);
    }

    const byCategory = new Map<string, ArchivedItemRow[]>();
    for (const item of archivedItems) {
      const key = item.categoryId && categoryMap.has(item.categoryId) ? item.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(key) ?? [];
      list.push({
        inventoryId:  item.id,
        itemName:     item.itemName,
        unit:         item.unit,
        archivedDate: formatArchivedDate(item.archivedAt),
        batches:      batchesByInventoryId.get(item.id) ?? [],
      });
      byCategory.set(key, list);
    }

    const groups: ArchivedCategoryGroup[] = [];
    for (const [id, category] of categoryMap.entries()) {
      const list = byCategory.get(id);
      if (!list || list.length === 0) continue;
      groups.push({ categoryId: id, categoryName: category.name, categoryIcon: category.icon, items: list });
    }
    const uncategorized = byCategory.get(UNCATEGORIZED_ID);
    if (uncategorized && uncategorized.length > 0) {
      groups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: uncategorized });
    }

    groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return groups;
  }, [archivedItems, batches, categoryMap]);

  // ✅ NEW — Batches tab: batch-level archived (batch.isActive ===
  // false) whose PARENT ITEM is still active (isActive !== false).
  // A batch belonging to an already item-archived item is excluded
  // here — that batch already appears under the Items tab's own
  // per-item batch list, avoiding duplication.
  const archivedBatchGroups = useMemo<ArchivedBatchCategoryGroup[]>(() => {
    const byCategory = new Map<string, ArchivedBatchOnlyRow[]>();

    for (const batch of batches) {
      if (batch.isActive !== false) continue; // not batch-archived
      const parentItem = itemById.get(batch.inventoryId);
      if (!parentItem) continue;
      if (parentItem.isActive === false) continue; // parent item already archived — shown under Items tab instead

      const catId = parentItem.categoryId && categoryMap.has(parentItem.categoryId) ? parentItem.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(catId) ?? [];
      list.push({
        batchId:      batch.id,
        batchNo:      batch.batchNo,
        itemName:     parentItem.itemName,
        quantity:     batch.quantity,
        unit:         batch.unit,
        archivedDate: formatArchivedDate(batch.archivedAt),
        categoryId:   parentItem.categoryId ?? null,
      });
      byCategory.set(catId, list);
    }

    const groups: ArchivedBatchCategoryGroup[] = [];
    for (const [id, category] of categoryMap.entries()) {
      const list = byCategory.get(id);
      if (!list || list.length === 0) continue;
      list.sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: id, categoryName: category.name, categoryIcon: category.icon, rows: list });
    }
    const uncategorized = byCategory.get(UNCATEGORIZED_ID);
    if (uncategorized && uncategorized.length > 0) {
      uncategorized.sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, rows: uncategorized });
    }

    groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return groups;
  }, [batches, itemById, categoryMap]);

  const handleRestoreItem = async (inventoryId: string) => {
    if (restoringId) return;
    setRestoringId(inventoryId);
    try {
      await restoreInventoryItem(restaurantId, inventoryId);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to restore item";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreBatch = async (batchId: string) => {
    if (restoringId) return;
    setRestoringId(batchId);
    try {
      await restoreInventoryBatch(restaurantId, batchId);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to restore batch";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Archived Inventory</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "items" && styles.tabBtnActive]}
            onPress={() => setActiveTab("items")}
          >
            <Text style={[styles.tabBtnText, activeTab === "items" && styles.tabBtnTextActive]}>Items</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "batches" && styles.tabBtnActive]}
            onPress={() => setActiveTab("batches")}
          >
            <Text style={[styles.tabBtnText, activeTab === "batches" && styles.tabBtnTextActive]}>Batches</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {batchesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#1e3a5f" />
          ) : activeTab === "items" ? (
            archivedItems.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="archive" size={40} color="#cbd5e1" />
                <Text style={styles.emptyStateText}>No archived items</Text>
              </View>
            ) : (
              <View style={{ width: TABLE_WIDTH }}>
                {categoryGroups.map((group) => {
                  const key = `items-${group.categoryId}`;
                  const measuredHeight = tableAreaHeights[key] ?? 0;

                  return (
                    <View key={key} style={styles.categoryBlock}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryHeaderText}>
                          {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                        </Text>
                      </View>

                      <View
                        style={styles.tableArea}
                        onLayout={(e) => {
                          const h = e.nativeEvent.layout.height;
                          setTableAreaHeights((prev) =>
                            prev[key] === h ? prev : { ...prev, [key]: h }
                          );
                        }}
                      >
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.headerCell, { width: COLS.sn }]}>S.N.</Text>
                          <Text style={[styles.headerCell, { width: COLS.item }]}>Item Name</Text>
                          <Text style={[styles.headerCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                          <Text style={[styles.headerCell, styles.centerCell, { width: COLS.archived }]}>Archived Date</Text>
                          <Text style={[styles.headerCell, styles.centerCell, { width: COLS.qty }]}>Batch QTY</Text>
                          <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                          <Text style={[styles.headerCell, styles.centerCell, { width: COLS.action }]}>Action</Text>
                        </View>

                        {group.items.map((item, itemIndex) => {
                          const rows = item.batches.length > 0 ? item.batches : [null];
                          const rowsHeight = rows.length * ROW_HEIGHT;
                          const isEvenRow = itemIndex % 2 === 1;
                          const isRestoringThis = restoringId === item.inventoryId;

                          return (
                            <View
                              key={item.inventoryId}
                              style={[styles.itemRow, { minHeight: rowsHeight }, isEvenRow && styles.itemRowAlt]}
                            >
                              <Text style={[styles.cell, { width: COLS.sn }]}>{itemIndex + 1}</Text>
                              <Text style={[styles.cell, styles.itemNameCell, { width: COLS.item }]}>{item.itemName}</Text>

                              <View style={{ width: COLS.batch }}>
                                {rows.map((b, i) => (
                                  <View key={b ? b.batchId : "no-batch"} style={[styles.batchLine, { height: ROW_HEIGHT }, i < rows.length - 1 && styles.batchLineDivider]}>
                                    <Text style={styles.cell} numberOfLines={1}>{b ? b.batchNo : "—"}</Text>
                                  </View>
                                ))}
                              </View>

                              <View style={[styles.mergedCell, { width: COLS.archived, minHeight: rowsHeight }]}>
                                <Text style={[styles.cell, styles.centerCell, styles.archivedDateText]}>{item.archivedDate}</Text>
                              </View>

                              <View style={{ width: COLS.qty }}>
                                {rows.map((b, i) => (
                                  <View key={b ? b.batchId : "no-batch"} style={[styles.batchLine, { height: ROW_HEIGHT }, i < rows.length - 1 && styles.batchLineDivider]}>
                                    <Text style={[styles.cell, styles.centerCell]}>{b ? b.quantity : "—"}</Text>
                                  </View>
                                ))}
                              </View>

                              <View style={[styles.mergedCell, { width: COLS.unit, minHeight: rowsHeight }]}>
                                <Text style={[styles.cell, styles.centerCell]}>{item.unit}</Text>
                              </View>

                              <View style={[styles.mergedCell, { width: COLS.action, minHeight: rowsHeight }]}>
                                <TouchableOpacity
                                  style={styles.restoreBtn}
                                  onPress={() => handleRestoreItem(item.inventoryId)}
                                  disabled={!!restoringId}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                  {isRestoringThis ? (
                                    <ActivityIndicator size="small" color="#0369a1" />
                                  ) : (
                                    <MaterialIcons name="unarchive" size={16} color="#0369a1" />
                                  )}
                                </TouchableOpacity>
                              </View>
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
                })}
              </View>
            )
          ) : archivedBatchGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory-2" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No archived batches</Text>
            </View>
          ) : (
            <View style={{ width: TABLE_WIDTH }}>
              {archivedBatchGroups.map((group) => {
                const key = `batches-${group.categoryId}`;
                const measuredHeight = tableAreaHeights[key] ?? 0;

                return (
                  <View key={key} style={styles.categoryBlock}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryHeaderText}>
                        {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={styles.tableArea}
                      onLayout={(e) => {
                        const h = e.nativeEvent.layout.height;
                        setTableAreaHeights((prev) =>
                          prev[key] === h ? prev : { ...prev, [key]: h }
                        );
                      }}
                    >
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.headerCell, { width: COLS.sn }]}>S.N.</Text>
                        <Text style={[styles.headerCell, { width: COLS.item }]}>Item Name</Text>
                        <Text style={[styles.headerCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                        <Text style={[styles.headerCell, styles.centerCell, { width: COLS.archived }]}>Archived Date</Text>
                        <Text style={[styles.headerCell, styles.centerCell, { width: COLS.qty }]}>Batch QTY</Text>
                        <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                        <Text style={[styles.headerCell, styles.centerCell, { width: COLS.action }]}>Action</Text>
                      </View>

                      {group.rows.map((row, rowIndex) => {
                        const isEvenRow = rowIndex % 2 === 1;
                        const isRestoringThis = restoringId === row.batchId;

                        return (
                          <View
                            key={row.batchId}
                            style={[styles.itemRow, { minHeight: ROW_HEIGHT }, isEvenRow && styles.itemRowAlt]}
                          >
                            <Text style={[styles.cell, { width: COLS.sn }]}>{rowIndex + 1}</Text>
                            <Text style={[styles.cell, styles.itemNameCell, { width: COLS.item }]}>{row.itemName}</Text>
                            <Text style={[styles.cell, { width: COLS.batch }]} numberOfLines={1}>{row.batchNo}</Text>
                            <Text style={[styles.cell, styles.centerCell, styles.archivedDateText, { width: COLS.archived }]}>{row.archivedDate}</Text>
                            <Text style={[styles.cell, styles.centerCell, { width: COLS.qty }]}>{row.quantity}</Text>
                            <Text style={[styles.cell, styles.centerCell, { width: COLS.unit }]}>{row.unit}</Text>
                            <View style={[styles.mergedCell, { width: COLS.action }]}>
                              <TouchableOpacity
                                style={styles.restoreBtn}
                                onPress={() => handleRestoreBatch(row.batchId)}
                                disabled={!!restoringId}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                {isRestoringThis ? (
                                  <ActivityIndicator size="small" color="#0369a1" />
                                ) : (
                                  <MaterialIcons name="unarchive" size={16} color="#0369a1" />
                                )}
                              </TouchableOpacity>
                            </View>
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
              })}
            </View>
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
  tabRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  tabBtnActive: { backgroundColor: "#1e3a5f" },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  tabBtnTextActive: { color: "#fff" },
  body: { flex: 1 },
  bodyContent: { padding: 16, alignItems: "center" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },

  categoryBlock: {
    marginBottom: 16, borderWidth: 1.5, borderColor: "#475569", borderRadius: 4, overflow: "hidden",
  },
  categoryHeader: {
    backgroundColor: "#1e3a5f", paddingVertical: 7, paddingHorizontal: 10,
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.6 },

  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 6,
  },
  headerCell: { fontSize: 12, fontWeight: "800", color: "#334155", paddingHorizontal: 4 },
  centerCell: { textAlign: "center" },

  itemRow: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1.5, borderBottomColor: "#475569" },
  itemRowAlt: { backgroundColor: "#f8fafc" },
  cell: { fontSize: 11, color: "#334155", paddingHorizontal: 4 },
  itemNameCell: { fontWeight: "700", color: "#0f172a", alignSelf: "center" },
  archivedDateText: { color: "#dc2626", fontWeight: "700" },

  batchLine: { justifyContent: "center", paddingHorizontal: 4, paddingVertical: 2 },
  batchLineDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  mergedCell: { justifyContent: "center", alignItems: "center" },

  restoreBtn: {
    width: 30, height: 30, borderRadius: 6, backgroundColor: "#e0f2fe",
    alignItems: "center", justifyContent: "center",
  },
});