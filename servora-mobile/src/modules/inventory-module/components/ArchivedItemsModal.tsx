// ============================================
// SERVORA ERP — ArchivedItemsModal Component
// ✅ UI REDESIGN — category-grouped, batch-level table (matching
//    HistoricalInventoryTableView's own design language), replacing
//    the previous simple item-level card list.
// ✅ NEW — "Archived Date" column shows item.archivedAt (formatted),
//    so it's immediately clear WHEN each item was archived — needed
//    to cross-check against Historical Inventory's date-navigated
//    view (an item archived on 18 Sep should still show its real
//    data for 13-18 Sep, hidden only from 19 Sep onward).
// ✅ Batch-level rows: each archived item's batches (fetched via
//    useAllInventoryBatches, same hook the Historical table uses)
//    are listed individually under that item — Lot/Batch No. and
//    Batch QTY are per-batch; Item Name, Archived Date, Unit are
//    item-level (merged/vertically centered across that item's own
//    batch rows), matching the merged-cell pattern used throughout
//    Store/Kitchen/Historical tables in this app.
// ✅ Category header shown ONLY with the category name (no date —
//    each row already carries its own Archived Date, so a single
//    header date would be misleading when items in the same
//    category were archived on different dates).
// ✅ Restore calls restoreInventoryItem() (inventory-item-service.ts,
//    FROZEN) — sets isActive back to true and clears archivedAt,
//    which makes the item reappear in the live table immediately.
// ✅ "View" action (chevron) — placeholder for a future detail view;
//    for now, tapping it does nothing extra beyond what Restore
//    already provides on this screen (kept as a visual affordance
//    matching the other tables' "View" column, per the requested
//    heading).
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { Category } from "../types/category";
import { restoreInventoryItem } from "../services/inventory-item-service";
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

const UNCATEGORIZED_ID = "__uncategorized__";
const ROW_HEIGHT = 26;
const COLS = { sn: 35, item: 170, batch: 150, archived: 100, qty: 75, unit: 55, action: 60 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.batch + COLS.archived + COLS.qty + COLS.unit + COLS.action;

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
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { batches, loading: batchesLoading } = useAllInventoryBatches(restaurantId);

  const archivedItems = useMemo(() => {
    return items
      .filter((item) => item.isActive === false)
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items]);

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

  const handleRestore = async (inventoryId: string) => {
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Archived Inventory</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {batchesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#1e3a5f" />
          ) : archivedItems.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="archive" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No archived items</Text>
            </View>
          ) : (
            <View style={{ width: TABLE_WIDTH }}>
              {categoryGroups.map((group) => (
                <View key={group.categoryId} style={styles.categoryBlock}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryHeaderText}>
                      {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                    </Text>
                  </View>

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
                          <Text style={[styles.cell, styles.centerCell]}>{item.archivedDate}</Text>
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
                            onPress={() => handleRestore(item.inventoryId)}
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
                </View>
              ))}
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

  batchLine: { justifyContent: "center", paddingHorizontal: 4, paddingVertical: 2 },
  batchLineDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  mergedCell: { justifyContent: "center", alignItems: "center" },

  restoreBtn: {
    width: 30, height: 30, borderRadius: 6, backgroundColor: "#e0f2fe",
    alignItems: "center", justifyContent: "center",
  },
});