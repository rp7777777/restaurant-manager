// ============================================
// SERVORA ERP — MonthlyReportScreen Component
// ✅ Reuses useStoreRequests().requests (already restaurant-wide,
//    live) — no new Firestore subscription.
// 🔒 "month" = req.requiredDate's month (not createdAt).
// ✅ Status counts are current-snapshot (not historical state).
// ✅ Requested Qty = sum(orderQuantity), any status.
// ✅ Issued Qty = sum(issuedQuantity ?? 0), ISSUED status only.
// ✅ Rejected Qty = sum(orderQuantity), REJECTED status only.
// ✅ Item grouping key = inventoryId when present, else
//    `itemName::unit` fallback.
// ✅ NOTE — item-wise aggregation groups by item across ALL requests
//    in the month (any status) — an item requested 3 separate times
//    shows as ONE row with combined quantities, not 3 rows.
// ✅ Header polish: 18px/700 title, ~50px height, 18px left padding.
// ✅ Category filter chips (All Categories + each category).
// ✅ STEP 1 (this revision) — category header date range: for the
//    CURRENT calendar month, ends at TODAY (todayISO(), UTC-
//    consistent with the rest of the codebase) and grows daily
//    rather than showing the full month immediately. For a PAST
//    month, shows the fixed 01-to-last-day range. Computed via
//    formatMonthRange(selectedMonth, currentMonthKey, todayFullDate)
//    — todayFullDate captured once via todayISO() on mount (same
//    "today" staleness trade-off already accepted elsewhere in this
//    codebase, e.g. Inventory's date navigator).
// FROZEN (pending Steps 2-4: category dropdown, clickable stat
// cards, per-batch row breakdown — tracked separately)
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { Category } from "../../../modules/inventory-module/types/category";
import { todayISO } from "../../../utils/date-utils";

const ROW_HEIGHT = 26;
const COLS = { sn: 35, item: 160, unit: 60, requested: 100, issued: 90, rejected: 90 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.unit + COLS.requested + COLS.issued + COLS.rejected;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.unit; positions.push(x);
  x += COLS.requested; positions.push(x);
  x += COLS.issued; positions.push(x);
  return positions;
})();

const UNCATEGORIZED_ID = "__uncategorized__";

interface MonthlyReportScreenProps {
  requests:   IngredientRequest[];
  categories: Category[];
  onClose:    () => void;
}

interface ItemAgg {
  key:          string;
  itemName:     string;
  unit:         string;
  requestedQty: number;
  issuedQty:    number;
  rejectedQty:  number;
}

interface CategoryAgg {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        ItemAgg[];
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

// ✅ STEP 1 — for the CURRENT month, ends at TODAY (grows daily);
// for a PAST month, shows the fixed 01-to-last-day range.
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

function currentMonthKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export function MonthlyReportScreen({ requests, categories, onClose }: MonthlyReportScreenProps) {
  const today = useMemo(() => currentMonthKey(), []);
  const todayFullDate = useMemo(() => todayISO(), []);
  const [selectedMonth, setSelectedMonth] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

  const monthlyRequests = useMemo(
    () => requests.filter((r) => r.requiredDate?.slice(0, 7) === selectedMonth),
    [requests, selectedMonth]
  );

  const summary = useMemo(() => {
    let pending = 0, approved = 0, issued = 0, rejected = 0;
    for (const r of monthlyRequests) {
      if (r.status === "PENDING") pending++;
      else if (r.status === "APPROVED") approved++;
      else if (r.status === "ISSUED") issued++;
      else if (r.status === "REJECTED") rejected++;
    }
    return { total: monthlyRequests.length, pending, approved, issued, rejected };
  }, [monthlyRequests]);

  const categoryGroups = useMemo<CategoryAgg[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, Map<string, ItemAgg>>();

    for (const r of monthlyRequests) {
      const catKey = r.categoryId && categoryById.has(r.categoryId) ? r.categoryId : UNCATEGORIZED_ID;
      const itemKey = r.inventoryId ? r.inventoryId : `${r.itemName}::${r.unit}`;

      const byItem = byCategory.get(catKey) ?? new Map<string, ItemAgg>();
      const existing = byItem.get(itemKey) ?? {
        key: itemKey, itemName: r.itemName, unit: r.unit,
        requestedQty: 0, issuedQty: 0, rejectedQty: 0,
      };

      existing.requestedQty += r.orderQuantity;
      if (r.status === "ISSUED") existing.issuedQty += r.issuedQuantity ?? 0;
      if (r.status === "REJECTED") existing.rejectedQty += r.orderQuantity;

      byItem.set(itemKey, existing);
      byCategory.set(catKey, byItem);
    }

    const result: CategoryAgg[] = [];
    for (const category of categories) {
      const byItem = byCategory.get(category.id);
      if (!byItem || byItem.size === 0) continue;
      const items = Array.from(byItem.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
      result.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items });
    }

    const uncatByItem = byCategory.get(UNCATEGORIZED_ID);
    if (uncatByItem && uncatByItem.size > 0) {
      const items = Array.from(uncatByItem.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
      result.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items });
    }

    result.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return result;
  }, [monthlyRequests, categories]);

  const visibleCategoryGroups = useMemo(() => {
    if (!categoryFilter) return categoryGroups;
    return categoryGroups.filter((g) => g.categoryId === categoryFilter);
  }, [categoryGroups, categoryFilter]);

  const isNextDisabled = selectedMonth >= today;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Report</Text>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.monthNavArrow} onPress={() => setSelectedMonth((m) => shiftMonth(m, -1))}>
          <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.monthNavLabel}>{formatMonthLabel(selectedMonth)}</Text>
        <TouchableOpacity
          style={styles.monthNavArrow}
          onPress={() => setSelectedMonth((m) => shiftMonth(m, 1))}
          disabled={isNextDisabled}
        >
          <MaterialIcons name="chevron-right" size={22} color={isNextDisabled ? "#cbd5e1" : "#1e293b"} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.pageContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
            <SummaryCard label="Total" value={summary.total} color="#64748b" icon="list" />
            <SummaryCard label="Pending" value={summary.pending} color="#f59e0b" icon="schedule" />
            <SummaryCard label="Approved" value={summary.approved} color="#3b82f6" icon="check-circle" />
            <SummaryCard label="Issued" value={summary.issued} color="#10b981" icon="done-all" />
            <SummaryCard label="Rejected" value={summary.rejected} color="#ef4444" icon="cancel" />
          </ScrollView>

          {categories.length > 0 && (
            <View style={styles.categoryWrap}>
              <TouchableOpacity
                style={[styles.categoryChip, categoryFilter === null && styles.categoryChipActive]}
                onPress={() => setCategoryFilter(null)}
              >
                <Text style={[styles.categoryChipText, categoryFilter === null && styles.categoryChipTextActive]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, categoryFilter === cat.id && styles.categoryChipActive]}
                  onPress={() => setCategoryFilter(cat.id)}
                >
                  <Text style={[styles.categoryChipText, categoryFilter === cat.id && styles.categoryChipTextActive]}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {visibleCategoryGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="bar-chart" size={36} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No requests this month</Text>
            </View>
          ) : (
            visibleCategoryGroups.map((group) => {
              const measuredHeight = tableAreaHeights[group.categoryId] ?? 0;

              return (
                <View key={group.categoryId} style={[styles.categoryBlock, { width: TABLE_WIDTH }]}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryHeaderText}>
                      {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                    </Text>
                    <Text style={styles.categoryHeaderDate}>{formatMonthRange(selectedMonth, today, todayFullDate)}</Text>
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
                      <Text style={[styles.headerCell, { width: COLS.item }]}>Item</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.requested }]}>Requested Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.issued }]}>Issued Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.rejected }]}>Rejected Qty</Text>
                    </View>

                    {group.items.map((item, idx) => {
                      const isEvenRow = idx % 2 === 1;
                      return (
                        <View key={item.key} style={[styles.dataRow, isEvenRow && styles.dataRowAlt]}>
                          <Text style={[styles.cell, { width: COLS.sn }]}>{idx + 1}</Text>
                          <Text style={[styles.cell, styles.itemCell, { width: COLS.item }]}>{item.itemName}</Text>
                          <Text style={[styles.cell, styles.centerCell, { width: COLS.unit }]}>{item.unit}</Text>
                          <Text style={[styles.cell, styles.centerCell, { width: COLS.requested }]}>{item.requestedQty}</Text>
                          <Text style={[styles.cell, styles.centerCell, { width: COLS.issued }]}>{item.issuedQty}</Text>
                          <Text style={[styles.cell, styles.centerCell, styles.rejectedCell, { width: COLS.rejected }]}>{item.rejectedQty}</Text>
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

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: keyof typeof MaterialIcons.glyphMap }) {
  return (
    <View style={styles.summaryCard}>
      <MaterialIcons name={icon} size={14} color={color} />
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
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
  monthNavLabel: { fontSize: 15, fontWeight: "800", color: "#1e293b", minWidth: 170, textAlign: "center" },
  body: { flex: 1 },
  bodyContent: { padding: 12, alignItems: "center", flexGrow: 1 },
  pageContainer: { width: "100%", maxWidth: 900, alignItems: "center" },
  summaryRow: { gap: 6, alignItems: "center", marginBottom: 10 },
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32,
    borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  summaryValue: { fontSize: 13, fontWeight: "800" },
  summaryLabel: { fontSize: 10, fontWeight: "600", color: "#64748b" },
  categoryWrap: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    width: "100%", marginBottom: 14,
  },
  categoryChip: {
    height: 24, justifyContent: "center", paddingHorizontal: 10, borderRadius: 4,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1",
  },
  categoryChipActive: { backgroundColor: "#0369a1", borderColor: "#0369a1" },
  categoryChipText: { fontSize: 10, fontWeight: "600", color: "#475569" },
  categoryChipTextActive: { color: "#fff" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 16, borderWidth: 1, borderColor: "#475569", borderRadius: 4, overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#0369a1", paddingVertical: 7, paddingHorizontal: 10,
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.4 },
  categoryHeaderDate: { color: "#dbeafe", fontWeight: "700", fontSize: 11 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#fef9c3",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8,
  },
  headerCell: { fontSize: 12, fontWeight: "800", color: "#1e293b", paddingHorizontal: 3 },
  centerCell: { textAlign: "center" },
  dataRow: {
    flexDirection: "row", alignItems: "center", height: ROW_HEIGHT,
    borderBottomWidth: 1.5, borderBottomColor: "#475569", backgroundColor: "#fff",
  },
  dataRowAlt: { backgroundColor: "#f8fafc" },
  cell: { fontSize: 11, color: "#334155", paddingHorizontal: 3 },
  itemCell: { fontWeight: "700", color: "#0f172a" },
  rejectedCell: { color: "#dc2626", fontWeight: "700" },
});