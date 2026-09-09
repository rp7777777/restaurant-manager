// ============================================
// SERVORA ERP — MovementHistoryModal Component
// ✅ Full-screen Modal, restaurant-wide movement log.
// ✅ Category-grouped layout, alphabetical by category name.
// ✅ THREE-level grouping (category -> item -> movements[]). ONLY
//    the "Item" column is merged/vertically-centered per item —
//    Type/Time/Lot-Batch-No/Qty/Before/Stock After/Unit/Notes each
//    remain on their OWN row per movement, since each movement is a
//    genuinely distinct event.
// ✅ Fixed column widths (900px total, no horizontal scroll).
// ✅ Centralized absolute-positioned vertical column dividers.
// ✅ Live date shown on category header (right side).
// ✅ NEW — "Lot/Batch" header renamed to "Lot/Batch No." for full
//    consistency with Inventory table's naming.
// ✅ NEW — Qty, Before, Stock After, Unit columns are center-aligned.
// ⚠️ SCALE NOTE: movements are loaded live restaurant-wide, then
//    filtered client-side.
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
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function formatCategoryHeaderDate(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

interface ItemGroup {
  inventoryId: string;
  itemName:    string;
  movements:   StockMovement[];
}

interface CategoryGroup {
  category: Category;
  items:    ItemGroup[];
}

const ROW_HEIGHT = 26;

const COLS = { sn: 35, item: 120, type: 90, time: 55, batch: 90, qty: 60, before: 65, stockAfter: 75, unit: 50, notes: 260 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.type + COLS.time + COLS.batch + COLS.qty + COLS.before + COLS.stockAfter + COLS.unit + COLS.notes;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.type; positions.push(x);
  x += COLS.time; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.qty; positions.push(x);
  x += COLS.before; positions.push(x);
  x += COLS.stockAfter; positions.push(x);
  x += COLS.unit; positions.push(x);
  return positions;
})();

function getMovementRowHeight(): number {
  return ROW_HEIGHT;
}

export function MovementHistoryModal({ visible, restaurantId, items, categories, onClose }: MovementHistoryModalProps) {
  const { movements, loading, error } = useStockMovements(restaurantId);
  const [filter, setFilter] = useState<FilterType>("ALL");

  const today = useMemo(() => todayISO(), []);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    if (visible) setSelectedDate(today);
  }, [visible, today]);

  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const filtered = (filter === "ALL" ? movements : movements.filter((m) => m.movementType === filter))
      .filter((m) => movementDateKey(m) === selectedDate);

    const byCategory = new Map<string, Map<string, StockMovement[]>>();
    for (const movement of filtered) {
      const item = itemById.get(movement.inventoryId);
      const categoryId = item?.categoryId;
      if (!categoryId) continue;

      const byItem = byCategory.get(categoryId) ?? new Map<string, StockMovement[]>();
      const itemMovements = byItem.get(movement.inventoryId) ?? [];
      itemMovements.push(movement);
      byItem.set(movement.inventoryId, itemMovements);
      byCategory.set(categoryId, byItem);
    }

    const groups: CategoryGroup[] = [];
    for (const category of categories) {
      const byItem = byCategory.get(category.id);
      if (!byItem || byItem.size === 0) continue;

      const itemGroups: ItemGroup[] = [];
      for (const [inventoryId, itemMovements] of byItem.entries()) {
        // ✅ NEW — sort each item's movements chronologically
        // (oldest first) using createdAt, instead of relying on
        // useStockMovements()'s fetch order (which can be newest-
        // first depending on the underlying Firestore query).
        const sortedMovements = [...itemMovements].sort((a, b) => {
          const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any);
          const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as any);
          return dateA.getTime() - dateB.getTime();
        });

        itemGroups.push({
          inventoryId,
          itemName: sortedMovements[0].itemName,
          movements: sortedMovements,
        });
      }
      itemGroups.sort((a, b) => a.itemName.localeCompare(b.itemName));

      groups.push({ category, items: itemGroups });
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
          <View style={styles.pageContainer}>
            {loading ? (
              <Text style={styles.loadingText}>Loading movement history...</Text>
            ) : isEmpty ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="receipt-long" size={36} color="#cbd5e1" />
                <Text style={styles.emptyStateText}>No movements on this date</Text>
              </View>
            ) : (
              categoryGroups.map((group) => {
                const measuredHeight = tableAreaHeights[group.category.id] ?? 0;

                return (
                  <View key={group.category.id} style={[styles.categoryBlock, { width: TABLE_WIDTH }]}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryHeaderText}>
                        {group.category.icon ? `${group.category.icon} ` : ""}{group.category.name.toUpperCase()}
                      </Text>
                      <Text style={styles.categoryHeaderDate}>{formatCategoryHeaderDate(selectedDate)}</Text>
                    </View>

                    <View
                      style={styles.tableArea}
                      onLayout={(e) => {
                        const h = e.nativeEvent.layout.height;
                        setTableAreaHeights((prev) =>
                          prev[group.category.id] === h ? prev : { ...prev, [group.category.id]: h }
                        );
                      }}
                    >
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { width: COLS.sn }]}>S.N.</Text>
                        <Text style={[styles.tableHeaderCell, { width: COLS.item }]}>Item</Text>
                        <Text style={[styles.tableHeaderCell, { width: COLS.type }]}>Type</Text>
                        <Text style={[styles.tableHeaderCell, { width: COLS.time }]}>Time</Text>
                        <Text style={[styles.tableHeaderCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                        <Text style={[styles.tableHeaderCell, styles.centerCell, { width: COLS.qty }]}>Qty</Text>
                        <Text style={[styles.tableHeaderCell, styles.centerCell, { width: COLS.before }]}>Before</Text>
                        <Text style={[styles.tableHeaderCell, styles.centerCell, { width: COLS.stockAfter }]}>Stock After</Text>
                        <Text style={[styles.tableHeaderCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                        <Text style={[styles.tableHeaderCell, { width: COLS.notes }]}>Notes</Text>
                      </View>

                      {group.items.map((itemGroup, itemIndex) => {
                        const itemGroupHeight = itemGroup.movements.reduce((sum) => sum + getMovementRowHeight(), 0);
                        const isEvenRow = itemIndex % 2 === 1;

                        return (
                          <View
                            key={itemGroup.inventoryId}
                            style={[
                              styles.itemGroupRow,
                              { minHeight: itemGroupHeight },
                              isEvenRow && styles.itemGroupRowAlt,
                            ]}
                          >
                            <View style={[styles.leftStrip, { width: COLS.sn + COLS.item, minHeight: itemGroupHeight }]}>
                              <Text style={[styles.leftStripCell, { width: COLS.sn }]}>{itemIndex + 1}</Text>
                              <Text style={[styles.leftStripCell, styles.itemNameCell, { width: COLS.item }]}>{itemGroup.itemName}</Text>
                            </View>

                            <View style={styles.rightMovementRows}>
                              {itemGroup.movements.map((movement, moveIdx) => {
                                const color = MOVEMENT_COLOR[movement.movementType];
                                const allocations: BatchAllocationRecord[] = movement.batchAllocations ?? [];
                                const batchLabel = allocations.length > 0
                                  ? allocations.map((a) => a.batchNo).join(", ")
                                  : "—";
                                const qtyLabel = allocations.length > 0
                                  ? allocations.reduce((sum, a) => sum + a.quantity, 0)
                                  : Math.abs(movement.quantityChanged);

                                return (
                                  <View
                                    key={movement.id}
                                    style={[
                                      styles.movementRow,
                                      { height: ROW_HEIGHT },
                                      moveIdx < itemGroup.movements.length - 1 && styles.movementRowDivider,
                                    ]}
                                  >
                                    <Text style={[styles.cell, { width: COLS.type, color }]}>
                                      {movement.movementType.replace("_", " ")}
                                    </Text>
                                    <Text style={[styles.cell, { width: COLS.time }]}>{movementTimeLabel(movement)}</Text>
                                    <Text style={[styles.cell, { width: COLS.batch }]}>{batchLabel}</Text>
                                    <Text style={[styles.cell, styles.centerCell, { width: COLS.qty, color }]}>{qtyLabel}</Text>
                                    <Text style={[styles.cell, styles.centerCell, { width: COLS.before }]}>{movement.beforeQuantity}</Text>
                                    <Text style={[styles.cell, styles.stockAfterCell, styles.centerCell, { width: COLS.stockAfter }]}>{movement.afterQuantity}</Text>
                                    <Text style={[styles.cell, styles.centerCell, { width: COLS.unit }]}>{movement.unit}</Text>
                                    <Text style={[styles.cell, { width: COLS.notes }]}>{movement.reason ?? ""}</Text>
                                  </View>
                                );
                              })}
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
              })
            )}
          </View>
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
  bodyContent: { padding: 12, alignItems: "center" },
  pageContainer: { width: "100%", maxWidth: 850, alignItems: "center" },
  loadingText: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 16,
    borderWidth: 1, borderColor: "#475569", borderRadius: 4,
    overflow: "hidden",
  },
  categoryHeader: {
    backgroundColor: "#059669", paddingVertical: 7, paddingHorizontal: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  categoryHeaderDate: { color: "#fff", fontWeight: "700", fontSize: 12 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b",
    paddingVertical: 8,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: "800", color: "#1e293b", paddingHorizontal: 3 },
  centerCell: { textAlign: "center" },
  itemGroupRow: {
    flexDirection: "row",
    width: "100%",
    borderBottomWidth: 1.5, borderBottomColor: "#475569",
  },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  leftStripCell: { fontSize: 11, color: "#334155", paddingHorizontal: 3 },
  itemNameCell: { fontWeight: "700", color: "#0f172a" },
  rightMovementRows: { flex: 1 },
  movementRow: {
    flexDirection: "row", alignItems: "center",
    width: "100%",
  },
  movementRowDivider: {
    borderBottomWidth: 1, borderBottomColor: "#94a3b8",
  },
  cell: { fontSize: 11, color: "#334155", paddingHorizontal: 3 },
  stockAfterCell: { fontWeight: "800", color: "#0f172a" },
});