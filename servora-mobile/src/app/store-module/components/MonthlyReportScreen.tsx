// ============================================
// SERVORA ERP — MonthlyReportScreen Component
// ✅ Reuses useStoreRequests().requests — no new Firestore
//    subscription for the request list.
// 🔒 "month" = req.requiredDate's month (not createdAt).
// ✅ Category header date range: current month ends at TODAY (grows
//    daily), past month shows fixed 01-to-last-day range.
// ✅ Category filter dropdown — NOT absolutely positioned anymore:
//    when open, it sits in normal document flow and pushes the
//    table below it downward, then the table returns to its normal
//    position when the dropdown closes. This was changed from an
//    absolute-positioned overlay because the overlay was rendering
//    with an apparently-transparent background on web, letting
//    table content bleed through visually even with an explicit
//    opaque backgroundColor — normal flow avoids that class of
//    layering issue entirely.
// ✅ Stat cards clickable, filter item breakdown by status.
// ✅ FINAL column order: S.N. / Item Name / Lot/Batch No. / Kitchen
//    Req.Qty / Store Issued Qty / Store Rejected Qty / Kitchen Req.
//    Total Qty / Store Issued Total Qty / Unit.
// ✅ Store Issued Qty (batch-level) AND Store Issued Total Qty
//    (item-level) both colored green (#059669) — consistent
//    "issued/positive" color across both granularities.
// ✅ Unit column values given light bold weight (600) for readability.
// 🔒 CONFIRMED SEMANTICS (unchanged from prior freeze):
//    - Kitchen Req.Qty  = REQUEST-level, merged across that
//      request's own batch rows.
//    - Store Issued Qty = BATCH-level ONLY, no issuedQuantity
//      fallback (a no-batch row always shows "—").
//    - Kitchen Req. Total Qty  = ITEM-level sum(orderQuantity).
//    - Store Issued Total Qty  = ITEM-level sum of all batch
//      allocation quantities (not re-derived from issuedQuantity).
//    - Store Rejected Qty = ITEM-level sum(orderQuantity) over
//      REJECTED requests.
// ✅ Item grouping key prefers inventoryId over itemName-only.
// FROZEN (pending: rejectionNote field + Rejection Note column —
// tracked as a separate, larger schema change)
// ============================================

import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest, RequestStatus } from "../../kitchen-module/types/kitchen-types";
import { Category } from "../../../modules/inventory-module/types/category";
import { getMovementsByReference } from "../../../modules/stock-movement-module/services/stock-movement-service";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { todayISO } from "../../../utils/date-utils";

const ROW_HEIGHT = 26;
const COLS = { sn: 40, item: 190, batch: 110, req: 75, issued: 85, rejected: 100, reqTotal: 90, issuedTotal: 95, unit: 60 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.batch + COLS.req + COLS.issued + COLS.rejected + COLS.reqTotal + COLS.issuedTotal + COLS.unit;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.req; positions.push(x);
  x += COLS.issued; positions.push(x);
  x += COLS.rejected; positions.push(x);
  x += COLS.reqTotal; positions.push(x);
  x += COLS.issuedTotal; positions.push(x);
  return positions;
})();

const UNCATEGORIZED_ID = "__uncategorized__";

type StatusFilter = RequestStatus | null;

interface MonthlyReportScreenProps {
  requests:   IngredientRequest[];
  categories: Category[];
  onClose:    () => void;
}

interface ItemGroup {
  itemKey:  string;
  itemName: string;
  requests: IngredientRequest[];
}

interface CategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        ItemGroup[];
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

function getRequestRowCount(allocationCount: number): number {
  return allocationCount > 0 ? allocationCount : 1;
}

export function MonthlyReportScreen({ requests, categories, onClose }: MonthlyReportScreenProps) {
  const today = useMemo(() => currentMonthKey(), []);
  const todayFullDate = useMemo(() => todayISO(), []);
  const [selectedMonth, setSelectedMonth] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
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

  const statusFilteredRequests = useMemo(() => {
    if (!statusFilter) return monthlyRequests;
    return monthlyRequests.filter((r) => r.status === statusFilter);
  }, [monthlyRequests, statusFilter]);

  const [batchAllocationsByRequestId, setBatchAllocationsByRequestId] =
    useState<Map<string, BatchAllocationRecord[]>>(new Map());

  const issuedIdsKey = useMemo(
    () =>
      statusFilteredRequests
        .filter((r) => r.status === "ISSUED")
        .map((r) => `${r.id}:${r.issuedQuantity ?? 0}`)
        .sort()
        .join(","),
    [statusFilteredRequests]
  );

  useEffect(() => {
    const issuedIds = statusFilteredRequests.filter((r) => r.status === "ISSUED").map((r) => r.id);
    if (issuedIds.length === 0) {
      setBatchAllocationsByRequestId(new Map());
      return;
    }

    let cancelled = false;
    (async () => {
      const restaurantId = statusFilteredRequests[0]?.restaurantId;
      if (!restaurantId) return;
      const entries = await Promise.all(
        issuedIds.map(async (id): Promise<readonly [string, BatchAllocationRecord[]]> => {
          try {
            const movements = await getMovementsByReference(restaurantId, "KITCHEN_REQUEST", id);
            const allocations = movements.flatMap((m) => m.batchAllocations ?? []);
            return [id, allocations];
          } catch (error) {
            console.warn(`Failed to load batch allocations for request ${id}:`, error);
            return [id, [] as BatchAllocationRecord[]];
          }
        })
      );
      if (!cancelled) {
        setBatchAllocationsByRequestId(new Map(entries));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuedIdsKey]);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, Map<string, IngredientRequest[]>>();

    for (const r of statusFilteredRequests) {
      const catKey = r.categoryId && categoryById.has(r.categoryId) ? r.categoryId : UNCATEGORIZED_ID;
      const byItem = byCategory.get(catKey) ?? new Map<string, IngredientRequest[]>();
      const itemKey = r.inventoryId ? r.inventoryId : `${r.itemName}::${r.unit}`;
      const list = byItem.get(itemKey) ?? [];
      list.push(r);
      byItem.set(itemKey, list);
      byCategory.set(catKey, byItem);
    }

    const result: CategoryGroup[] = [];
    for (const category of categories) {
      const byItem = byCategory.get(category.id);
      if (!byItem || byItem.size === 0) continue;
      const itemGroups: ItemGroup[] = Array.from(byItem.entries())
        .map(([itemKey, itemRequests]) => ({ itemKey, itemName: itemRequests[0].itemName, requests: itemRequests }))
        .sort((a, b) => a.itemName.localeCompare(b.itemName));
      result.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items: itemGroups });
    }

    const uncatByItem = byCategory.get(UNCATEGORIZED_ID);
    if (uncatByItem && uncatByItem.size > 0) {
      const itemGroups: ItemGroup[] = Array.from(uncatByItem.entries())
        .map(([itemKey, itemRequests]) => ({ itemKey, itemName: itemRequests[0].itemName, requests: itemRequests }))
        .sort((a, b) => a.itemName.localeCompare(b.itemName));
      result.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: itemGroups });
    }

    result.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return result;
  }, [statusFilteredRequests, categories]);

  const visibleCategoryGroups = useMemo(() => {
    if (!categoryFilter) return categoryGroups;
    return categoryGroups.filter((g) => g.categoryId === categoryFilter);
  }, [categoryGroups, categoryFilter]);

  const isNextDisabled = selectedMonth >= today;

  const selectedCategoryName = categoryFilter
    ? categories.find((c) => c.id === categoryFilter)?.name ?? "All Categories"
    : "All Categories";

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
          <View style={styles.topControlsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
              <SummaryCard label="Total" value={summary.total} color="#64748b" icon="list" active={statusFilter === null} onPress={() => setStatusFilter(null)} />
              <SummaryCard label="Pending" value={summary.pending} color="#f59e0b" icon="schedule" active={statusFilter === "PENDING"} onPress={() => setStatusFilter((s) => s === "PENDING" ? null : "PENDING")} />
              <SummaryCard label="Approved" value={summary.approved} color="#3b82f6" icon="check-circle" active={statusFilter === "APPROVED"} onPress={() => setStatusFilter((s) => s === "APPROVED" ? null : "APPROVED")} />
              <SummaryCard label="Issued" value={summary.issued} color="#10b981" icon="done-all" active={statusFilter === "ISSUED"} onPress={() => setStatusFilter((s) => s === "ISSUED" ? null : "ISSUED")} />
              <SummaryCard label="Rejected" value={summary.rejected} color="#ef4444" icon="cancel" active={statusFilter === "REJECTED"} onPress={() => setStatusFilter((s) => s === "REJECTED" ? null : "REJECTED")} />
            </ScrollView>

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
                      <Text style={[styles.headerCell, { width: COLS.item }]}>Item Name</Text>
                      <Text style={[styles.headerCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.req }]}>Kitchen Req.Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.issued }]}>Store Issued Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.rejected }]}>Store Rejected Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.reqTotal }]}>Kitchen Req. Total Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.issuedTotal }]}>Store Issued Total Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                    </View>

                    {group.items.map((itemGroup, itemIndex) => {
                      const itemGroupHeight = itemGroup.requests.reduce((sum, req) => {
                        const allocationCount = (batchAllocationsByRequestId.get(req.id) ?? []).length;
                        return sum + getRequestRowCount(allocationCount) * ROW_HEIGHT;
                      }, 0);
                      const isEvenRow = itemIndex % 2 === 1;

                      const reqTotal = itemGroup.requests.reduce((sum, r) => sum + r.orderQuantity, 0);
                      const issuedTotal = itemGroup.requests.reduce((sum, r) => {
                        const allocations = batchAllocationsByRequestId.get(r.id) ?? [];
                        return sum + allocations.reduce((s, a) => s + a.quantity, 0);
                      }, 0);
                      const itemUnit = itemGroup.requests[0]?.unit ?? "";
                      const rejectedTotal = itemGroup.requests.filter((r) => r.status === "REJECTED").reduce((s, r) => s + r.orderQuantity, 0);

                      return (
                        <View key={itemGroup.itemKey} style={[styles.itemGroupRow, { minHeight: itemGroupHeight }, isEvenRow && styles.itemGroupRowAlt]}>
                          <View style={[styles.leftStrip, { width: COLS.sn + COLS.item, minHeight: itemGroupHeight }]}>
                            <Text style={[styles.cell, { width: COLS.sn }]}>{itemIndex + 1}</Text>
                            <Text style={[styles.cell, styles.itemCell, { width: COLS.item }]}>{itemGroup.itemName}</Text>
                          </View>

                          <View style={styles.rightRequestRows}>
                            {itemGroup.requests.map((req, reqIdx) => {
                              const allocations = batchAllocationsByRequestId.get(req.id) ?? [];
                              const rows = allocations.length > 0 ? allocations : [null];
                              const requestBlockHeight = rows.length * ROW_HEIGHT;

                              return (
                                <View
                                  key={req.id}
                                  style={[
                                    styles.requestBlock,
                                    { minHeight: requestBlockHeight },
                                    reqIdx < itemGroup.requests.length - 1 && styles.requestRowDivider,
                                  ]}
                                >
                                  <View style={{ width: COLS.batch }}>
                                    {rows.map((alloc, rowIdx) => (
                                      <View
                                        key={alloc ? alloc.batchId : "no-batch"}
                                        style={[styles.batchLineRow, { height: ROW_HEIGHT }, rowIdx < rows.length - 1 && styles.batchRowDivider]}
                                      >
                                        <Text style={styles.cell}>{alloc ? alloc.batchNo : "—"}</Text>
                                      </View>
                                    ))}
                                  </View>

                                  <View style={[styles.requestLevelCell, { width: COLS.req, minHeight: requestBlockHeight }]}>
                                    <Text style={[styles.cell, styles.centerCell]}>{req.orderQuantity}</Text>
                                  </View>

                                  <View style={{ width: COLS.issued }}>
                                    {rows.map((alloc, rowIdx) => (
                                      <View
                                        key={alloc ? alloc.batchId : "no-batch"}
                                        style={[styles.batchLineRow, { height: ROW_HEIGHT }, rowIdx < rows.length - 1 && styles.batchRowDivider]}
                                      >
                                        <Text style={[styles.cell, styles.centerCell, alloc && styles.issuedQtyCell]}>
                                          {alloc ? alloc.quantity : "—"}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              );
                            })}
                          </View>

                          <View style={[styles.itemLevelCell, { width: COLS.rejected, minHeight: itemGroupHeight }]}>
                            <Text style={[styles.cell, styles.centerCell, styles.rejectedCell]}>{rejectedTotal}</Text>
                          </View>

                          <View style={[styles.itemLevelCell, { width: COLS.reqTotal, minHeight: itemGroupHeight }]}>
                            <Text style={[styles.cell, styles.centerCell, styles.totalCellText]}>{reqTotal}</Text>
                          </View>

                          <View style={[styles.itemLevelCell, { width: COLS.issuedTotal, minHeight: itemGroupHeight }]}>
                            <Text style={[styles.cell, styles.centerCell, styles.totalCellText, styles.issuedQtyCell]}>{issuedTotal}</Text>
                          </View>

                          <View style={[styles.itemLevelCell, { width: COLS.unit, minHeight: itemGroupHeight }]}>
                            <Text style={[styles.cell, styles.centerCell, styles.unitCellText]}>{itemUnit}</Text>
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

function SummaryCard({
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
  monthNavLabel: { fontSize: 15, fontWeight: "800", color: "#1e293b", minWidth: 170, textAlign: "center" },
  body: { flex: 1 },
  bodyContent: { padding: 12, alignItems: "center", flexGrow: 1 },
  pageContainer: { width: "100%", maxWidth: 900, alignItems: "center" },
  topControlsRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    width: "100%", maxWidth: TABLE_WIDTH, marginBottom: 14, gap: 10,
  },
  summaryRow: { gap: 6, alignItems: "center" },
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32,
    borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
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
  itemGroupRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#475569" },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  cell: { fontSize: 11, color: "#334155", paddingHorizontal: 3 },
  itemCell: { fontWeight: "700", color: "#0f172a" },
  rightRequestRows: { flex: 1 },
  requestBlock: { flexDirection: "row" },
  requestRowDivider: { borderBottomWidth: 1.5, borderBottomColor: "#475569" },
  batchLineRow: { justifyContent: "center", paddingHorizontal: 3 },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  requestLevelCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  itemLevelCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  totalCellText: { fontWeight: "800", color: "#0f172a" },
  unitCellText: { fontWeight: "600" },
  rejectedCell: { color: "#dc2626", fontWeight: "700" },
  issuedQtyCell: { color: "#059669", fontWeight: "700" },
});