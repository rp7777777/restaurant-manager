// ============================================
// SERVORA ERP — ArchivedItemsModal Component
// ✅ Single merged table (no separate item/batch tabs), including
//    BOTH item-level archived items (whole InventoryItem.isActive
//    === false) AND items that only have one or more BATCH-level
//    archived batches while the item itself stays active — merged
//    into ONE row per item: Item Name merged/vertically-centered,
//    Lot/Batch No. one row per batch.
//    - Item-level archived item: shows ALL its batches.
//    - Batch-only archived item: shows ONLY its archived batch(es)
//      matching the active date filter.
//    - Restore is per-ROW-GROUP: item-level → restoreInventoryItem()
//      (whole item); batch-only → per-BATCH restoreInventoryBatch()
//      (independent button per archived batch).
// ✅ NEW — "Daily" / "Monthly" toggle:
//    - Daily (default, unchanged behavior): date navigator
//      ("< [date] >"), EXACT-DATE filter — only items/batches
//      archived ON selectedDate.
//    - Monthly (new): month navigator ("< [Month Year] >"),
//      CUMULATIVE filter for the whole calendar month — every item/
//      batch whose archivedAt falls anywhere in that month. Lets the
//      user see "how much was archived this month" at a glance,
//      complementing the Inventory Monthly Report's own Archived
//      stat (which only gives a COUNT, not this per-item/batch
//      detail).
// ✅ Both modes share the exact same table rendering — only the
//    filtering predicate (exact-date vs in-month) and the nav
//    control (day-shift vs month-shift) differ.
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
import { todayISO } from "../../../utils/date-utils";

const isWeb = Platform.OS === "web";

type ViewMode = "daily" | "monthly";

interface ArchivedItemsModalProps {
  visible:      boolean;
  items:        InventoryItem[]; // full, unfiltered list — this component filters to archived itself
  categoryMap:  Map<string, Category>;
  restaurantId: string;
  fmt:          (n: number) => string;
  onClose:      () => void;
}

interface DisplayBatchRow {
  batchId:  string;
  batchNo:  string;
  quantity: number;
  archivedDateLabel: string; // per-batch, since Monthly mode can mix dates within the same item row
}

// ✅ One row per ITEM — whether it's item-level archived (shows all
// its batches) or only has batch-level archived batches (shows only
// those). isItemLevel decides which Restore action applies.
interface ArchivedDisplayRow {
  inventoryId:  string;
  itemName:     string;
  unit:         string;
  isItemLevel:  boolean; // true = whole item archived; false = only some batches archived
  itemArchivedDateLabel: string | null; // formatted label for the item-level archive date, when isItemLevel
  batches:      DisplayBatchRow[];
}

interface ArchivedCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  rows:         ArchivedDisplayRow[];
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

function shiftDate(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function toDateKey(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function archivedAtDateKey(archivedAt: unknown): string | null {
  if (!archivedAt) return null;
  const raw = archivedAt as any;
  const d: Date | null = typeof raw?.toDate === "function" ? raw.toDate() : (raw instanceof Date ? raw : null);
  return d ? toDateKey(d) : null;
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function currentMonthKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function formatShortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function ArchivedItemsModal({
  visible, items, categoryMap, restaurantId, fmt, onClose,
}: ArchivedItemsModalProps) {
  const today = useMemo(() => todayISO(), []);
  const currentMonth = useMemo(() => currentMonthKey(), []);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});
  const { batches, loading: batchesLoading } = useAllInventoryBatches(restaurantId);

  const itemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const batchesByInventoryId = useMemo(() => {
    const map = new Map<string, InventoryBatch[]>();
    for (const b of batches) {
      const list = map.get(b.inventoryId) ?? [];
      list.push(b);
      map.set(b.inventoryId, list);
    }
    return map;
  }, [batches]);

  // ✅ Matches the current mode's filter: Daily = exact date match;
  // Monthly = same YYYY-MM prefix (cumulative for the whole month).
  const matchesSelectedPeriod = (dateKey: string | null): boolean => {
    if (!dateKey) return false;
    if (viewMode === "daily") return dateKey === selectedDate;
    return dateKey.startsWith(selectedMonth);
  };

  const categoryGroups = useMemo<ArchivedCategoryGroup[]>(() => {
    const byCategory = new Map<string, ArchivedDisplayRow[]>();

    // Item-level archived items whose archivedAt matches the selected period.
    for (const item of items) {
      if (item.isActive !== false) continue;
      const itemDateKey = archivedAtDateKey(item.archivedAt);
      if (!matchesSelectedPeriod(itemDateKey)) continue;

      const key = item.categoryId && categoryMap.has(item.categoryId) ? item.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(key) ?? [];

      // ✅ Daily: unchanged — show ALL batches for an item-level
      // archived item. Monthly: only batches whose OWN archivedAt
      // falls within the selected month — an active batch, or one
      // archived in a different month, is excluded even though the
      // parent item itself was archived in the selected month.
      const rawItemBatches = batchesByInventoryId.get(item.id) ?? [];
      const relevantItemBatches = viewMode === "monthly"
        ? rawItemBatches.filter((b) => b.isActive !== false || matchesSelectedPeriod(archivedAtDateKey(b.archivedAt)))
        : rawItemBatches;

      const itemBatches = relevantItemBatches.map((b) => ({
        batchId: b.id, batchNo: b.batchNo, quantity: b.quantity,
        archivedDateLabel: b.isActive === false && b.archivedAt ? formatShortDate(archivedAtDateKey(b.archivedAt) ?? "") : "—",
      }));

      list.push({
        inventoryId: item.id,
        itemName:    item.itemName,
        unit:        item.unit,
        isItemLevel: true,
        itemArchivedDateLabel: itemDateKey ? formatShortDate(itemDateKey) : null,
        batches:     itemBatches,
      });
      byCategory.set(key, list);
    }

    // Batch-only archived: item still active, but has one or more
    // batches archived within the selected period.
    for (const [inventoryId, itemBatches] of batchesByInventoryId.entries()) {
      const parentItem = itemById.get(inventoryId);
      if (!parentItem) continue;
      if (parentItem.isActive === false) continue; // item-level archived — handled above

      const archivedInPeriod = itemBatches.filter(
        (b) => b.isActive === false && matchesSelectedPeriod(archivedAtDateKey(b.archivedAt))
      );
      if (archivedInPeriod.length === 0) continue;

      const key = parentItem.categoryId && categoryMap.has(parentItem.categoryId) ? parentItem.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(key) ?? [];
      list.push({
        inventoryId: parentItem.id,
        itemName:    parentItem.itemName,
        unit:        parentItem.unit,
        isItemLevel: false,
        itemArchivedDateLabel: null,
        batches:     archivedInPeriod.map((b) => ({
          batchId: b.id, batchNo: b.batchNo, quantity: b.quantity,
          archivedDateLabel: formatShortDate(archivedAtDateKey(b.archivedAt) ?? ""),
        })),
      });
      byCategory.set(key, list);
    }

    const groups: ArchivedCategoryGroup[] = [];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, batchesByInventoryId, itemById, categoryMap, selectedDate, selectedMonth, viewMode]);

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

  const isNextDayDisabled = selectedDate >= today;
  const isNextMonthDisabled = selectedMonth >= currentMonth;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Archived Inventory</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "daily" && styles.toggleBtnActive]}
            onPress={() => setViewMode("daily")}
          >
            <Text style={[styles.toggleBtnText, viewMode === "daily" && styles.toggleBtnTextActive]}>Daily</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "monthly" && styles.toggleBtnActive]}
            onPress={() => setViewMode("monthly")}
          >
            <Text style={[styles.toggleBtnText, viewMode === "monthly" && styles.toggleBtnTextActive]}>Monthly</Text>
          </TouchableOpacity>
        </View>

        {viewMode === "daily" ? (
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => setSelectedDate((d) => shiftDate(d, -1))} style={styles.dateNavArrow}>
              <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.dateNavLabel}>{formatDateLabel(selectedDate, today)}</Text>
            <TouchableOpacity
              onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
              style={[styles.dateNavArrow, isNextDayDisabled && styles.dateNavArrowDisabled]}
              disabled={isNextDayDisabled}
            >
              <MaterialIcons name="chevron-right" size={22} color={isNextDayDisabled ? "#cbd5e1" : "#1e293b"} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => setSelectedMonth((m) => shiftMonth(m, -1))} style={styles.dateNavArrow}>
              <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.dateNavLabel}>{formatMonthLabel(selectedMonth)}</Text>
            <TouchableOpacity
              onPress={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              style={[styles.dateNavArrow, isNextMonthDisabled && styles.dateNavArrowDisabled]}
              disabled={isNextMonthDisabled}
            >
              <MaterialIcons name="chevron-right" size={22} color={isNextMonthDisabled ? "#cbd5e1" : "#1e293b"} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {batchesLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#1e3a5f" />
          ) : categoryGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="archive" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>
                {viewMode === "daily" ? "Nothing archived on this date" : "Nothing archived this month"}
              </Text>
            </View>
          ) : (
            <View style={{ width: TABLE_WIDTH }}>
              {categoryGroups.map((group) => {
                const measuredHeight = tableAreaHeights[group.categoryId] ?? 0;

                return (
                  <View key={group.categoryId} style={styles.categoryBlock}>
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
                          prev[group.categoryId] === h ? prev : { ...prev, [group.categoryId]: h }
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
                        const rows = row.batches.length > 0 ? row.batches : [null];
                        const rowsHeight = rows.length * ROW_HEIGHT;
                        const isEvenRow = rowIndex % 2 === 1;
                        const isRestoringItem = row.isItemLevel && restoringId === row.inventoryId;

                        return (
                          <View
                            key={row.inventoryId}
                            style={[styles.itemRow, { minHeight: rowsHeight }, isEvenRow && styles.itemRowAlt]}
                          >
                            <Text style={[styles.cell, { width: COLS.sn }]}>{rowIndex + 1}</Text>
                            <Text style={[styles.cell, styles.itemNameCell, { width: COLS.item }]}>{row.itemName}</Text>

                            <View style={{ width: COLS.batch }}>
                              {rows.map((b, i) => (
                                <View key={b ? b.batchId : "no-batch"} style={[styles.batchLine, { height: ROW_HEIGHT }, i < rows.length - 1 && styles.batchLineDivider]}>
                                  <Text style={styles.cell} numberOfLines={1}>{b ? b.batchNo : "—"}</Text>
                                </View>
                              ))}
                            </View>

                            {row.isItemLevel ? (
                              <View style={[styles.mergedCell, { width: COLS.archived, minHeight: rowsHeight }]}>
                                <Text style={[styles.cell, styles.centerCell, styles.archivedDateText]}>{row.itemArchivedDateLabel}</Text>
                              </View>
                            ) : (
                              <View style={{ width: COLS.archived }}>
                                {rows.map((b, i) => (
                                  <View key={b ? b.batchId : "no-batch"} style={[styles.batchLine, { height: ROW_HEIGHT }, i < rows.length - 1 && styles.batchLineDivider]}>
                                    <Text style={[styles.cell, styles.centerCell, styles.archivedDateText]}>{b ? b.archivedDateLabel : "—"}</Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            <View style={{ width: COLS.qty }}>
                              {rows.map((b, i) => (
                                <View key={b ? b.batchId : "no-batch"} style={[styles.batchLine, { height: ROW_HEIGHT }, i < rows.length - 1 && styles.batchLineDivider]}>
                                  <Text style={[styles.cell, styles.centerCell]}>{b ? b.quantity : "—"}</Text>
                                </View>
                              ))}
                            </View>

                            <View style={[styles.mergedCell, { width: COLS.unit, minHeight: rowsHeight }]}>
                              <Text style={[styles.cell, styles.centerCell]}>{row.unit}</Text>
                            </View>

                            {row.isItemLevel ? (
                              <View style={[styles.mergedCell, { width: COLS.action, minHeight: rowsHeight }]}>
                                <TouchableOpacity
                                  style={styles.restoreBtn}
                                  onPress={() => handleRestoreItem(row.inventoryId)}
                                  disabled={!!restoringId}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                  {isRestoringItem ? (
                                    <ActivityIndicator size="small" color="#0369a1" />
                                  ) : (
                                    <MaterialIcons name="unarchive" size={16} color="#0369a1" />
                                  )}
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={{ width: COLS.action }}>
                                {rows.map((b, i) => {
                                  const isRestoringThisBatch = b && restoringId === b.batchId;
                                  return (
                                    <View key={b ? b.batchId : "no-batch"} style={[styles.batchLine, styles.actionBatchLine, { height: ROW_HEIGHT }, i < rows.length - 1 && styles.batchLineDivider]}>
                                      {b && (
                                        <TouchableOpacity
                                          style={styles.restoreBtn}
                                          onPress={() => handleRestoreBatch(b.batchId)}
                                          disabled={!!restoringId}
                                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                          {isRestoringThisBatch ? (
                                            <ActivityIndicator size="small" color="#0369a1" />
                                          ) : (
                                            <MaterialIcons name="unarchive" size={16} color="#0369a1" />
                                          )}
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  );
                                })}
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
  toggleRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  toggleBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  toggleBtnActive: { backgroundColor: "#1e3a5f" },
  toggleBtnText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  toggleBtnTextActive: { color: "#fff" },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  dateNavArrow: { padding: 4 },
  dateNavArrowDisabled: { opacity: 0.4 },
  dateNavLabel: { fontSize: 14, fontWeight: "800", color: "#1e293b", minWidth: 170, textAlign: "center" },
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
  actionBatchLine: { alignItems: "center" },
  batchLineDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  mergedCell: { justifyContent: "center", alignItems: "center" },

  restoreBtn: {
    width: 30, height: 30, borderRadius: 6, backgroundColor: "#e0f2fe",
    alignItems: "center", justifyContent: "center",
  },
});