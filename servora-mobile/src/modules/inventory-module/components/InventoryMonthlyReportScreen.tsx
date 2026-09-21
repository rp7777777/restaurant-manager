// ============================================
// SERVORA ERP — InventoryMonthlyReportScreen Component
// ✅ Design language matches Store's own MonthlyReportScreen.tsx
//    EXACTLY: month navigator, clickable stat cards, category
//    dropdown, category-grouped table with the category header
//    INSIDE the same bordered categoryBlock as its table.
// ✅ NEW — category header now shows the month's date range on the
//    right (e.g. "01 SEPT 2026 - 30 SEPT 2026"), reusing the exact
//    same formatMonthRange() logic as Store's own MonthlyReportScreen
//    (current month clamps its end date to today; past months show
//    the full calendar month).
// ✅ NEW — "All" stat card (non-filtering-exclusive — clicking it
//    clears any active stat filter, showing every event) added
//    alongside Received/Issued/Waste/Archived, matching Store's own
//    "Total" card pattern.
// ✅ Table columns: S.N. / Item Name / Date / Event / Lot/Batch No. /
//    Quantity / Unit / Note. Item Name merged/vertically-centered
//    per item; Date/Event/Batch/Quantity/Note are per-EVENT rows.
// ✅ Event kind color coding: RECEIVED green, ISSUED blue, WASTE red,
//    TRANSFER amber, ADJUSTMENT gray, ARCHIVED_ITEM/ARCHIVED_BATCH
//    purple — purely visual, does not alter underlying data.
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { Category } from "../types/category";
import { useInventoryMonthlyReport, ReportEvent, ReportEventKind } from "../hooks/useInventoryMonthlyReport";

const ROW_HEIGHT = 26;
const COLS = { sn: 40, item: 190, date: 90, event: 100, batch: 150, qty: 80, unit: 60, note: 120 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.date + COLS.event + COLS.batch + COLS.qty + COLS.unit + COLS.note;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.date; positions.push(x);
  x += COLS.event; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.qty; positions.push(x);
  x += COLS.unit; positions.push(x);
  return positions;
})();

const UNCATEGORIZED_ID = "__uncategorized__";

const EVENT_LABEL: Record<ReportEventKind, string> = {
  RECEIVED:       "Received",
  ISSUED:         "Issued",
  WASTE:          "Waste",
  TRANSFER:       "Transfer",
  ADJUSTMENT:     "Adjustment",
  ARCHIVED_ITEM:  "Item Archived",
  ARCHIVED_BATCH: "Batch Archived",
};

const EVENT_COLOR: Record<ReportEventKind, string> = {
  RECEIVED:       "#059669",
  ISSUED:         "#2563eb",
  WASTE:          "#dc2626",
  TRANSFER:       "#d97706",
  ADJUSTMENT:     "#64748b",
  ARCHIVED_ITEM:  "#7c3aed",
  ARCHIVED_BATCH: "#7c3aed",
};

type StatFilter = "RECEIVED" | "ISSUED" | "WASTE" | "ARCHIVED" | null;

interface InventoryMonthlyReportScreenProps {
  restaurantId: string;
  items:        InventoryItem[];
  categories:   Category[];
  fmt:          (n: number) => string;
  onClose:      () => void;
}

interface ItemEventGroup {
  itemKey:  string;
  itemName: string;
  events:   ReportEvent[];
}

interface CategoryEventGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        ItemEventGroup[];
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
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

function todayFullDateKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ Same pattern as Store's own MonthlyReportScreen.tsx —
// current month clamps its end date to today, past months show the
// full calendar month.
function formatMonthRange(monthKey: string, currentMonthKeyVal: string, todayFullDate: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));

  const isCurrentMonth = monthKey === currentMonthKeyVal;
  let endDay: Date;
  if (isCurrentMonth) {
    const [ty, tm, td] = todayFullDate.split("-").map(Number);
    endDay = new Date(Date.UTC(ty, tm - 1, td));
  } else {
    endDay = new Date(Date.UTC(year, month, 0));
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
  return `${fmt(firstDay)} - ${fmt(endDay)}`;
}

export function InventoryMonthlyReportScreen({
  restaurantId, items, categories, fmt, onClose,
}: InventoryMonthlyReportScreenProps) {
  const today = useMemo(() => currentMonthKey(), []);
  const todayFullDate = useMemo(() => todayFullDateKey(), []);
  const [selectedMonth, setSelectedMonth] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statFilter, setStatFilter] = useState<StatFilter>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

  const {
    events, totalReceivedQty, totalIssuedQty, totalWasteQty, totalArchivedCount,
    currentStockValue, loading, error,
  } = useInventoryMonthlyReport(restaurantId, selectedMonth, items);

  const totalEventCount = events.length;

  const filteredEvents = useMemo(() => {
    let result = events;
    if (statFilter === "ARCHIVED") {
      result = result.filter((e) => e.kind === "ARCHIVED_ITEM" || e.kind === "ARCHIVED_BATCH");
    } else if (statFilter) {
      result = result.filter((e) => e.kind === statFilter);
    }
    if (categoryFilter) {
      result = result.filter((e) => e.categoryId === categoryFilter);
    }
    return result;
  }, [events, statFilter, categoryFilter]);

  const categoryGroups = useMemo<CategoryEventGroup[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, Map<string, ReportEvent[]>>();

    for (const e of filteredEvents) {
      const catKey = e.categoryId && categoryById.has(e.categoryId) ? e.categoryId : UNCATEGORIZED_ID;
      const byItem = byCategory.get(catKey) ?? new Map<string, ReportEvent[]>();
      const itemKey = e.itemName;
      const list = byItem.get(itemKey) ?? [];
      list.push(e);
      byItem.set(itemKey, list);
      byCategory.set(catKey, byItem);
    }

    const groups: CategoryEventGroup[] = [];
    for (const category of categories) {
      const byItem = byCategory.get(category.id);
      if (!byItem || byItem.size === 0) continue;
      const itemGroups: ItemEventGroup[] = Array.from(byItem.entries())
        .map(([itemName, itemEvents]) => ({ itemKey: itemName, itemName, events: itemEvents }))
        .sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items: itemGroups });
    }
    const uncatByItem = byCategory.get(UNCATEGORIZED_ID);
    if (uncatByItem && uncatByItem.size > 0) {
      const itemGroups: ItemEventGroup[] = Array.from(uncatByItem.entries())
        .map(([itemName, itemEvents]) => ({ itemKey: itemName, itemName, events: itemEvents }))
        .sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: itemGroups });
    }

    groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return groups;
  }, [filteredEvents, categories]);

  const selectedCategoryName = categoryFilter
    ? categories.find((c) => c.id === categoryFilter)?.name ?? "All Categories"
    : "All Categories";

  const monthRangeLabel = formatMonthRange(selectedMonth, today, todayFullDate);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory Monthly Report</Text>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={22} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setSelectedMonth((m) => shiftMonth(m, -1))} style={styles.monthNavArrow}>
          <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.monthNavLabel}>{formatMonthLabel(selectedMonth)}</Text>
        <TouchableOpacity
          onPress={() => setSelectedMonth((m) => shiftMonth(m, 1))}
          style={[styles.monthNavArrow, selectedMonth >= today && styles.monthNavArrowDisabled]}
          disabled={selectedMonth >= today}
        >
          <MaterialIcons name="chevron-right" size={22} color={selectedMonth >= today ? "#cbd5e1" : "#1e293b"} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.pageContainer}>
          <View style={styles.topControlsRow}>
            <View style={styles.summaryRow}>
              <StatCard label="All" value={totalEventCount} color="#1e293b" icon="list-alt" active={statFilter === null} onPress={() => setStatFilter(null)} />
              <StatCard label="Received" value={totalReceivedQty} color="#059669" icon="move-to-inbox" active={statFilter === "RECEIVED"} onPress={() => setStatFilter((s) => s === "RECEIVED" ? null : "RECEIVED")} />
              <StatCard label="Issued" value={totalIssuedQty} color="#2563eb" icon="outbox" active={statFilter === "ISSUED"} onPress={() => setStatFilter((s) => s === "ISSUED" ? null : "ISSUED")} />
              <StatCard label="Waste" value={totalWasteQty} color="#dc2626" icon="delete-outline" active={statFilter === "WASTE"} onPress={() => setStatFilter((s) => s === "WASTE" ? null : "WASTE")} />
              <StatCard label="Archived" value={totalArchivedCount} color="#7c3aed" icon="archive" active={statFilter === "ARCHIVED"} onPress={() => setStatFilter((s) => s === "ARCHIVED" ? null : "ARCHIVED")} />
              <View style={styles.valueCard}>
                <MaterialIcons name="payments" size={14} color="#0f172a" />
                <Text style={styles.valueCardText}>{fmt(currentStockValue)}</Text>
                <Text style={styles.summaryLabel}>Stock Value</Text>
              </View>
            </View>

            {categories.length > 0 && (
              <View style={styles.dropdownWrap}>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowCategoryDropdown((v) => !v)}>
                  <Text style={styles.dropdownButtonText}>{selectedCategoryName}</Text>
                  <MaterialIcons name={showCategoryDropdown ? "expand-less" : "expand-more"} size={20} color="#059669" />
                </TouchableOpacity>
                {showCategoryDropdown && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setCategoryFilter(null); setShowCategoryDropdown(false); }}>
                      <Text style={styles.dropdownItemText}>All Categories</Text>
                    </TouchableOpacity>
                    {categories.map((cat) => (
                      <TouchableOpacity key={cat.id} style={styles.dropdownItem} onPress={() => { setCategoryFilter(cat.id); setShowCategoryDropdown(false); }}>
                        <Text style={styles.dropdownItemText}>{cat.icon} {cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#1e3a5f" />
          ) : error ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="error-outline" size={40} color="#dc2626" />
              <Text style={styles.emptyStateText}>{error}</Text>
            </View>
          ) : categoryGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No activity this month</Text>
            </View>
          ) : (
            categoryGroups.map((group) => {
              const groupHeights = group.items.map((ig) => ig.events.length * ROW_HEIGHT);
              const measuredHeight = tableAreaHeights[group.categoryId] ?? 0;

              return (
                <View key={group.categoryId} style={[styles.categoryBlock, { width: TABLE_WIDTH }]}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryHeaderText}>
                      {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                    </Text>
                    <Text style={styles.categoryHeaderDate}>{monthRangeLabel}</Text>
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
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.date }]}>Date</Text>
                      <Text style={[styles.headerCell, { width: COLS.event }]}>Event</Text>
                      <Text style={[styles.headerCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.qty }]}>Quantity</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                      <Text style={[styles.headerCell, { width: COLS.note }]}>Note</Text>
                    </View>

                    {group.items.map((itemGroup, itemIndex) => {
                      const groupHeight = groupHeights[itemIndex];
                      const isEvenRow = itemIndex % 2 === 1;

                      return (
                        <View
                          key={itemGroup.itemKey}
                          style={[styles.itemGroupRow, { minHeight: groupHeight }, isEvenRow && styles.itemGroupRowAlt]}
                        >
                          <View style={[styles.leftStrip, { width: COLS.sn + COLS.item, minHeight: groupHeight }]}>
                            <Text style={[styles.cell, { width: COLS.sn }]}>{itemIndex + 1}</Text>
                            <Text style={[styles.cell, styles.itemCell, { width: COLS.item }]}>{itemGroup.itemName}</Text>
                          </View>

                          <View style={styles.rightEventRows}>
                            {itemGroup.events.map((e, eIdx) => (
                              <View
                                key={e.id}
                                style={[
                                  styles.eventRow,
                                  { height: ROW_HEIGHT },
                                  eIdx < itemGroup.events.length - 1 && styles.eventRowDivider,
                                ]}
                              >
                                <Text style={[styles.cell, styles.centerCell, { width: COLS.date }]}>{e.dateKey}</Text>
                                <Text style={[styles.cell, { width: COLS.event, color: EVENT_COLOR[e.kind], fontWeight: "700" }]}>{EVENT_LABEL[e.kind]}</Text>
                                <Text style={[styles.cell, { width: COLS.batch }]} numberOfLines={1}>{e.batchNo ?? "—"}</Text>
                                <Text style={[styles.cell, styles.centerCell, { width: COLS.qty }]}>{e.quantity ?? "—"}</Text>
                                <Text style={[styles.cell, styles.centerCell, { width: COLS.unit }]}>{e.unit}</Text>
                                <Text style={[styles.cell, { width: COLS.note }]} numberOfLines={1}>{e.note ?? "—"}</Text>
                              </View>
                            ))}
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
  );
}

function StatCard({
  label, value, color, icon, active, onPress,
}: { label: string; value: number; color: string; icon: keyof typeof MaterialIcons.glyphMap; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.summaryCard, active && { borderColor: color, borderWidth: 2 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialIcons name={icon} size={14} color={color} />
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    height: 50, paddingLeft: 18, paddingRight: 16,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  monthNavArrow: { padding: 4 },
  monthNavArrowDisabled: { opacity: 0.4 },
  monthNavLabel: { fontSize: 15, fontWeight: "800", color: "#1e293b", minWidth: 170, textAlign: "center" },
  body: { flex: 1 },
  bodyContent: { padding: 12, alignItems: "center", flexGrow: 1 },
  pageContainer: { width: "100%", maxWidth: 900, alignItems: "center" },
  topControlsRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    width: "100%", maxWidth: 900, marginBottom: 14, gap: 10,
  },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32,
    borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  valueCard: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32,
    borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  valueCardText: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  summaryValue: { fontSize: 13, fontWeight: "800" },
  summaryLabel: { fontSize: 10, fontWeight: "600", color: "#64748b" },
  dropdownWrap: { width: 220 },
  dropdownButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1.5, borderColor: "#059669", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff",
  },
  dropdownButtonText: { fontSize: 13, color: "#1e293b", fontWeight: "600" },
  dropdownList: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 220, backgroundColor: "#ffffff",
    width: 220, alignSelf: "flex-end",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropdownItemText: { fontSize: 13, color: "#1e293b" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 16, borderWidth: 1, borderColor: "#475569", borderRadius: 4, overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#1e3a5f", paddingVertical: 7, paddingHorizontal: 10,
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.4 },
  categoryHeaderDate: { color: "#dbeafe", fontWeight: "700", fontSize: 11 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8,
  },
  headerCell: { fontSize: 12, fontWeight: "800", color: "#334155", paddingHorizontal: 4 },
  centerCell: { textAlign: "center" },
  itemGroupRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#475569" },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  cell: { fontSize: 11, color: "#334155", paddingHorizontal: 4 },
  itemCell: { fontWeight: "700", color: "#0f172a" },
  rightEventRows: { flex: 1 },
  eventRow: { flexDirection: "row", alignItems: "center" },
  eventRowDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
});