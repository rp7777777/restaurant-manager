// ============================================
// SERVORA ERP — MovementHistoryModal Component
// ✅ Full-screen Modal, restaurant-wide movement log.
// ✅ Wraps useStockMovements() (restaurant-wide, live).
// ✅ Movement-type filter chips (All + all 7 StockMovementType
//    values).
// ✅ Attendance-style single-day date navigator (UTC-based
//    shiftDate(), immune to timezone drift).
// ✅ NEW — Category-grouped layout, matching InventoryBatchReport/
//    InventoryTableView's visual language: date shown ONCE at the
//    top (via the date navigator, unchanged), then movements
//    grouped by the item's CATEGORY, each category as its own
//    bordered block with a green header — not a flat list anymore.
// ✅ NEW — Batch Allocation display: each movement row shows the
//    batch(es) it actually involved (via the new
//    StockMovement.batchAllocations field, populated by
//    inventory-service.ts's receiveBatch()/writeMovementRecord()).
//    A movement spanning MULTIPLE batches (e.g. a FEFO deduction
//    that drew from 2 batches) renders as one merged-look row-group
//    — S.N./Item/Type/Time/Before→After shown once (left strip
//    style, matching InventoryBatchReport's own row-span technique
//    for its item column), one sub-row per batch showing that
//    batch's own batchNo + quantity. Movements with NO
//    batchAllocations (the non-batch adjustStock() path —
//    Increase/Decrease/Correction/Transfer In) show a single row
//    with "—" in the batch column instead of a sub-row breakdown.
// ✅ Grouping requires resolving each movement's item → category —
//    done via a client-side join (movement.inventoryId → item →
//    categoryId → category), using items/categories already loaded
//    by the parent screen and passed down as props (no new
//    Firestore subscription created here).
// ✅ Compact rows (Excel-default-row-height sizing) preserved.
// ✅ Read-only — no actions on this screen.
// FROZEN
// ============================================

import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { StockMovement, StockMovementType, BatchAllocationRecord } from "../../stock-movement-module/types/stock-movement";
import { useStockMovements } from "../hooks/useStockMovements";
import { InventoryItem } from "../types/inventory";
import { Category } from "../types/category";
import { todayISO } from "../../../utils/date-utils";

interface MovementHistoryModalProps {
  visible:      boolean;
  restaurantId: string;
  items:        InventoryItem[];
  categories:   Category[];
  onClose:      () => void;
}

type FilterType = "ALL" | StockMovementType;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "ALL",           label: "All" },
  { value: "PURCHASE",      label: "Purchase" },
  { value: "WASTE",         label: "Waste" },
  { value: "TRANSFER_OUT",  label: "Transfer Out" },
  { value: "TRANSFER_IN",   label: "Transfer In" },
  { value: "ADJUSTMENT",    label: "Adjustment" },
  { value: "KITCHEN_ISSUE", label: "Kitchen Issue" },
  { value: "RETURN",        label: "Return" },
];

const MOVEMENT_COLOR: Record<StockMovementType, string> = {
  PURCHASE:      "#059669",
  RETURN:        "#059669",
  TRANSFER_IN:   "#059669",
  KITCHEN_ISSUE: "#dc2626",
  WASTE:         "#dc2626",
  TRANSFER_OUT:  "#dc2626",
  ADJUSTMENT:    "#0369a1",
};

function movementDateKey(movement: StockMovement): string {
  const raw = movement.createdAt as any;
  if (!raw) return "unknown";
  const date: Date = typeof raw.toDate === "function" ? raw.toDate() : new Date(raw);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function movementTimeLabel(movement: StockMovement): string {
  const raw = movement.createdAt as any;
  if (!raw) return "";
  const date: Date = typeof raw.toDate === "function" ? raw.toDate() : new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shiftDate(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

interface CategoryGroup {
  category:  Category;
  movements: StockMovement[];
}

const ROW_HEIGHT = 24;

export function MovementHistoryModal({ visible, restaurantId, items, categories, onClose }: MovementHistoryModalProps) {
  const { movements, loading, error } = useStockMovements(restaurantId);
  const [filter, setFilter] = useState<FilterType>("ALL");

  const today = useMemo(() => todayISO(), []);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    if (visible) setSelectedDate(today);
  }, [visible, today]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const filtered = (filter === "ALL" ? movements : movements.filter((m) => m.movementType === filter))
      .filter((m) => movementDateKey(m) === selectedDate);

    const byCategory = new Map<string, StockMovement[]>();
    for (const movement of filtered) {
      const item = itemById.get(movement.inventoryId);
      const categoryId = item?.categoryId;
      if (!categoryId) continue; // item unknown/deleted — skip rather than crash
      const list = byCategory.get(categoryId) ?? [];
      list.push(movement);
      byCategory.set(categoryId, list);
    }

    const groups: CategoryGroup[] = [];
    for (const category of categories) {
      const list = byCategory.get(category.id);
      if (!list || list.length === 0) continue;
      groups.push({ category, movements: list });
    }

    groups.sort((a, b) => a.category.name.localeCompare(b.category.name));
    return groups;
  }, [movements, filter, selectedDate, itemById, categories]);

  const isEmpty = !loading && categoryGroups.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Movement History</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, filter === opt.value && styles.filterChipActive]}
              onPress={() => setFilter(opt.value)}
            >
              <Text style={[styles.filterChipText, filter === opt.value && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.dateNavArrow} onPress={() => setSelectedDate((d) => shiftDate(d, -1))}>
            <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>{formatDateLabel(selectedDate, today)}</Text>
          <TouchableOpacity
            style={styles.dateNavArrow}
            onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
            disabled={selectedDate >= today}
          >
            <MaterialIcons name="chevron-right" size={22} color={selectedDate >= today ? "#cbd5e1" : "#1e293b"} />
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {loading ? (
            <Text style={styles.loadingText}>Loading movement history...</Text>
          ) : isEmpty ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt-long" size={36} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No movements on this date</Text>
            </View>
          ) : (
            categoryGroups.map((group) => (
              <View key={group.category.id} style={styles.categoryBlock}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryHeaderText}>
                    {group.category.icon ? `${group.category.icon} ` : ""}{group.category.name.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.colSN]}>S.N.</Text>
                  <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
                  <Text style={[styles.tableHeaderCell, styles.colType]}>Type</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTime]}>Time</Text>
                  <Text style={[styles.tableHeaderCell, styles.colBatch]}>Batch</Text>
                  <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
                  <Text style={[styles.tableHeaderCell, styles.colBeforeAfter]}>Before→After</Text>
                </View>

                {group.movements.map((movement, idx) => {
                  const color = MOVEMENT_COLOR[movement.movementType];
                  const allocations: BatchAllocationRecord[] = movement.batchAllocations ?? [];
                  const rowCount = allocations.length > 0 ? allocations.length : 1;
                  const groupHeight = ROW_HEIGHT * rowCount;

                  return (
                    <View key={movement.id} style={[styles.movementGroupRow, { minHeight: groupHeight }]}>
                      <View style={[styles.leftStrip, { minHeight: groupHeight }]}>
                        <Text style={[styles.leftStripCell, styles.colSN]}>{idx + 1}</Text>
                        <Text style={[styles.leftStripCell, styles.colItem]} numberOfLines={1}>{movement.itemName}</Text>
                        <Text style={[styles.leftStripCell, styles.colType, { color }]} numberOfLines={1}>
                          {movement.movementType.replace("_", " ")}
                        </Text>
                        <Text style={[styles.leftStripCell, styles.colTime]}>{movementTimeLabel(movement)}</Text>
                      </View>

                      <View style={styles.rightBatchRows}>
                        {allocations.length > 0 ? (
                          allocations.map((alloc, allocIdx) => (
                            <View key={alloc.batchId} style={[styles.batchRow, { height: ROW_HEIGHT }]}>
                              <Text style={[styles.cell, styles.colBatch]} numberOfLines={1}>{alloc.batchNo}</Text>
                              <Text style={[styles.cell, styles.colQty, { color }]}>{alloc.quantity}</Text>
                              <Text style={[styles.cell, styles.colBeforeAfter]}>
                                {allocIdx === allocations.length - 1
                                  ? `${movement.beforeQuantity}→${movement.afterQuantity}`
                                  : ""}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <View style={[styles.batchRow, { height: ROW_HEIGHT }]}>
                            <Text style={[styles.cell, styles.colBatch]}>—</Text>
                            <Text style={[styles.cell, styles.colQty, { color }]}>
                              {movement.quantityChanged > 0 ? "+" : ""}{movement.quantityChanged}
                            </Text>
                            <Text style={[styles.cell, styles.colBeforeAfter]}>
                              {movement.beforeQuantity}→{movement.afterQuantity}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
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
  filterScroll: { marginTop: 8, maxHeight: 32 },
  filterScrollContent: { paddingHorizontal: 16, gap: 6, alignItems: "center" },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: "#f1f5f9", height: 24, justifyContent: "center",
  },
  filterChipActive: { backgroundColor: "#0369a1" },
  filterChipText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  filterChipTextActive: { color: "#fff" },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 14, fontWeight: "800", color: "#1e293b", minWidth: 160, textAlign: "center" },
  errorBanner: {
    backgroundColor: "#fef2f2", marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  body: { flex: 1 },
  bodyContent: { padding: 12 },
  loadingText: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 16,
    borderWidth: 1, borderColor: "#1e293b", borderRadius: 6,
    overflow: "hidden",
  },
  categoryHeader: { backgroundColor: "#059669", paddingVertical: 6, paddingHorizontal: 10 },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#fef9c3",
    borderBottomWidth: 2, borderBottomColor: "#1e293b",
    paddingVertical: 4,
  },
  tableHeaderCell: { fontSize: 9, fontWeight: "800", color: "#1e293b", paddingHorizontal: 3 },
  colSN:           { width: 24 },
  colItem:         { width: 90 },
  colType:         { width: 80 },
  colTime:         { width: 50 },
  colBatch:        { width: 70 },
  colQty:          { width: 55, textAlign: "right" },
  colBeforeAfter:  { width: 70, textAlign: "right" },
  movementGroupRow: {
    flexDirection: "row",
    borderBottomWidth: 1, borderBottomColor: "#94a3b8",
  },
  leftStrip: {
    flexDirection: "row", alignItems: "center",
    borderRightWidth: 1, borderRightColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  leftStripCell: { fontSize: 10, color: "#334155", paddingHorizontal: 3 },
  rightBatchRows: { flex: 1 },
  batchRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  cell: { fontSize: 10, color: "#334155", paddingHorizontal: 3 },
});