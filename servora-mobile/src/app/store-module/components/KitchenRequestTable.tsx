// ============================================
// SERVORA ERP — KitchenRequestTable Component
// ✅ Generic onRowPress(req) callback.
// ✅ FOUR-level grouping: category -> item -> individual requests ->
//    batch allocation rows. Category header shows only the date.
//    "Item Name" merged/vertically-centered per item.
// ✅ NEW — WITHIN a request, "Req.Qty", "Unit", and "Required Date"
//    are now REQUEST-LEVEL columns (siblings of the batch-row
//    column, matching Item Name's own vertically-centered layout),
//    NOT split per batch row — only "Lot/Batch No." and "Issued"
//    are truly per-batch data and remain split across batch rows.
//    This matches the exact same "item-level column beside
//    batch-level rows" pattern already used for Total QTY in
//    HistoricalInventoryTableView.tsx.
// ✅ Notes/Status/Requested By remain shown once per request (on the
//    first batch row) — batch count doesn't affect those either,
//    but they're inherently single-line so no separate column
//    treatment was needed.
// ✅ NEW — row divider colors darkened to match Inventory table's
//    contrast level (#94a3b8 -> #475569 for batch dividers,
//    matching itemGroupRow's own color).
// ✅ ONLY the first category block shows the column header row.
// ✅ No gap between category blocks.
// ✅ Column order: S.N. / Item Name / Lot/Batch No. / Req.Qty /
//    Issued / Unit / Required Date / Notes / Status / Requested By
//    / (chevron).
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { Category } from "../../../modules/inventory-module/types/category";
import { STATUS_COLORS } from "../utils/store-formatters";

const ROW_HEIGHT = 26;
const COLS = { sn: 30, item: 110, batch: 85, req: 55, issued: 55, unit: 45, date: 90, note: 165, status: 95, by: 90, chevron: 35 };
const TABLE_WIDTH =
  COLS.sn + COLS.item + COLS.batch + COLS.req + COLS.issued + COLS.unit + COLS.date + COLS.note + COLS.status + COLS.by + COLS.chevron;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.req; positions.push(x);
  x += COLS.issued; positions.push(x);
  x += COLS.unit; positions.push(x);
  x += COLS.date; positions.push(x);
  x += COLS.note; positions.push(x);
  x += COLS.status; positions.push(x);
  x += COLS.by; positions.push(x);
  return positions;
})();

const UNCATEGORIZED_ID = "__uncategorized__";

interface KitchenRequestTableProps {
  requests:                     IngredientRequest[];
  batchAllocationsByRequestId:  Map<string, BatchAllocationRecord[]>;
  categories:                   Category[];
  onRowPress:                   (req: IngredientRequest) => void;
}

interface ItemGroup {
  itemName:  string;
  requests:  IngredientRequest[];
}

interface CategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  categoryDate: string;
  items:        ItemGroup[];
}

function formatGroupDate(ts: unknown): string {
  if (!ts) return "";
  try {
    const d = (ts as any).toDate ? (ts as any).toDate() : new Date(ts as any);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function getRequestRowCount(allocationCount: number): number {
  return allocationCount > 0 ? allocationCount : 1;
}

export function KitchenRequestTable({ requests, batchAllocationsByRequestId, categories, onRowPress }: KitchenRequestTableProps) {
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

  const groups = useMemo<CategoryGroup[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, Map<string, IngredientRequest[]>>();

    for (const req of requests) {
      const catKey = req.categoryId && categoryById.has(req.categoryId) ? req.categoryId : UNCATEGORIZED_ID;
      const byItem = byCategory.get(catKey) ?? new Map<string, IngredientRequest[]>();
      const itemKey = req.itemName;
      const list = byItem.get(itemKey) ?? [];
      list.push(req);
      byItem.set(itemKey, list);
      byCategory.set(catKey, byItem);
    }

    const result: CategoryGroup[] = [];
    for (const category of categories) {
      const byItem = byCategory.get(category.id);
      if (!byItem || byItem.size === 0) continue;

      const itemGroups: ItemGroup[] = Array.from(byItem.entries())
        .map(([itemName, itemRequests]) => ({ itemName, requests: itemRequests }))
        .sort((a, b) => a.itemName.localeCompare(b.itemName));

      const firstReq = itemGroups[0]?.requests[0];
      result.push({
        categoryId:   category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryDate: formatGroupDate(firstReq?.createdAt),
        items:        itemGroups,
      });
    }

    const uncatByItem = byCategory.get(UNCATEGORIZED_ID);
    if (uncatByItem && uncatByItem.size > 0) {
      const itemGroups: ItemGroup[] = Array.from(uncatByItem.entries())
        .map(([itemName, itemRequests]) => ({ itemName, requests: itemRequests }))
        .sort((a, b) => a.itemName.localeCompare(b.itemName));
      const firstReq = itemGroups[0]?.requests[0];
      result.push({
        categoryId:   UNCATEGORIZED_ID,
        categoryName: "Uncategorized",
        categoryIcon: undefined,
        categoryDate: formatGroupDate(firstReq?.createdAt),
        items:        itemGroups,
      });
    }

    result.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return result;
  }, [requests, categories]);

  return (
    <View style={{ width: TABLE_WIDTH }}>
      {groups.map((group, groupIndex) => {
        const measuredHeight = tableAreaHeights[group.categoryId] ?? 0;
        const isFirstGroup = groupIndex === 0;

        return (
          <View key={group.categoryId} style={styles.groupBlock}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupHeaderText}>
                {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
              </Text>
              {group.categoryDate ? (
                <Text style={styles.groupHeaderDate}>{group.categoryDate}</Text>
              ) : null}
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
              {isFirstGroup && (
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.headerCell, { width: COLS.sn }]}>S.N.</Text>
                  <Text style={[styles.headerCell, { width: COLS.item }]}>Item Name</Text>
                  <Text style={[styles.headerCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                  <Text style={[styles.headerCell, styles.centerCell, { width: COLS.req }]}>Req.Qty</Text>
                  <Text style={[styles.headerCell, styles.centerCell, { width: COLS.issued }]}>Issued</Text>
                  <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                  <Text style={[styles.headerCell, { width: COLS.date }]}>Required Date</Text>
                  <Text style={[styles.headerCell, { width: COLS.note }]}>Notes</Text>
                  <Text style={[styles.headerCell, { width: COLS.status }]}>Status</Text>
                  <Text style={[styles.headerCell, { width: COLS.by }]}>Requested By</Text>
                  <Text style={[styles.headerCell, { width: COLS.chevron }]}></Text>
                </View>
              )}

              {group.items.map((itemGroup, itemIndex) => {
                const itemGroupHeight = itemGroup.requests.reduce((sum, req) => {
                  const allocationCount = (batchAllocationsByRequestId.get(req.id) ?? []).length;
                  return sum + getRequestRowCount(allocationCount) * ROW_HEIGHT;
                }, 0);
                const isEvenRow = itemIndex % 2 === 1;

                return (
                  <View
                    key={itemGroup.itemName}
                    style={[
                      styles.itemGroupRow,
                      { minHeight: itemGroupHeight },
                      isEvenRow && styles.itemGroupRowAlt,
                    ]}
                  >
                    <View style={[styles.leftStrip, { width: COLS.sn + COLS.item, minHeight: itemGroupHeight }]}>
                      <Text style={[styles.cell, { width: COLS.sn }]}>{itemIndex + 1}</Text>
                      <Text style={[styles.cell, styles.itemCell, { width: COLS.item }]}>{itemGroup.itemName}</Text>
                    </View>

                    <View style={styles.rightRequestRows}>
                      {itemGroup.requests.map((req, reqIdx) => {
                        const statusColor = STATUS_COLORS[req.status];
                        const allocations = batchAllocationsByRequestId.get(req.id) ?? [];
                        const rows = allocations.length > 0 ? allocations : [null];
                        const requestBlockHeight = rows.length * ROW_HEIGHT;

                        return (
                          <TouchableOpacity
                            key={req.id}
                            style={[
                              styles.requestBlock,
                              { minHeight: requestBlockHeight },
                              reqIdx < itemGroup.requests.length - 1 && styles.requestRowDivider,
                            ]}
                            onPress={() => onRowPress(req)}
                            activeOpacity={0.6}
                          >
                            {/* Batch column — per-batch rows */}
                            <View style={{ width: COLS.batch }}>
                              {rows.map((alloc, rowIdx) => (
                                <View
                                  key={alloc ? alloc.batchId : "no-batch"}
                                  style={[
                                    styles.batchLineRow,
                                    { height: ROW_HEIGHT },
                                    rowIdx < rows.length - 1 && styles.batchRowDivider,
                                  ]}
                                >
                                  <Text style={styles.cell}>{alloc ? alloc.batchNo : "—"}</Text>
                                </View>
                              ))}
                            </View>

                            {/* Req.Qty — request-level, vertically centered */}
                            <View style={[styles.requestLevelCell, { width: COLS.req, minHeight: requestBlockHeight }]}>
                              <Text style={[styles.cell, styles.centerCell]}>{req.orderQuantity}</Text>
                            </View>

                            {/* Issued — per-batch rows */}
                            <View style={{ width: COLS.issued }}>
                              {rows.map((alloc, rowIdx) => (
                                <View
                                  key={alloc ? alloc.batchId : "no-batch"}
                                  style={[
                                    styles.batchLineRow,
                                    { height: ROW_HEIGHT },
                                    rowIdx < rows.length - 1 && styles.batchRowDivider,
                                  ]}
                                >
                                  <Text style={[styles.cell, styles.centerCell]}>
                                    {alloc ? alloc.quantity : (req.issuedQuantity !== undefined ? req.issuedQuantity : "—")}
                                  </Text>
                                </View>
                              ))}
                            </View>

                            {/* Unit — request-level */}
                            <View style={[styles.requestLevelCell, { width: COLS.unit, minHeight: requestBlockHeight }]}>
                              <Text style={[styles.cell, styles.centerCell]}>{req.unit}</Text>
                            </View>

                            {/* Required Date — request-level */}
                            <View style={[styles.requestLevelCell, { width: COLS.date, minHeight: requestBlockHeight, alignItems: "flex-start" }]}>
                              <Text style={styles.cell}>{req.requiredDate}</Text>
                            </View>

                            {/* Notes — request-level */}
                            <View style={[styles.requestLevelCell, { width: COLS.note, minHeight: requestBlockHeight, alignItems: "flex-start" }]}>
                              <Text style={styles.cell}>{req.note || "—"}</Text>
                            </View>

                            {/* Status — request-level */}
                            <View style={[styles.requestLevelCell, styles.statusCellWrap, { width: COLS.status, minHeight: requestBlockHeight }]}>
                              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                              <Text style={[styles.cell, { color: statusColor, fontWeight: "700" }]}>{req.status}</Text>
                            </View>

                            {/* Requested By — request-level */}
                            <View style={[styles.requestLevelCell, { width: COLS.by, minHeight: requestBlockHeight, alignItems: "flex-start" }]}>
                              <Text style={styles.cell}>{req.requestedBy || "—"}</Text>
                            </View>

                            <View style={[styles.requestLevelCell, { width: COLS.chevron, minHeight: requestBlockHeight }]}>
                              <MaterialIcons name="chevron-right" size={16} color="#dc2626" />
                            </View>
                          </TouchableOpacity>
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
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groupBlock: {
    borderWidth: 1, borderColor: "#475569",
  },
  groupHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#0369a1", paddingVertical: 7, paddingHorizontal: 10,
  },
  groupHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },
  groupHeaderDate: { color: "#dbeafe", fontWeight: "700", fontSize: 12 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#fef9c3",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8,
  },
  headerCell: { fontSize: 12, fontWeight: "800", color: "#1e293b", paddingHorizontal: 3 },
  centerCell: { textAlign: "center" },
  itemGroupRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5, borderBottomColor: "#475569",
  },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 4,
  },
  cell: { fontSize: 11, color: "#334155", paddingHorizontal: 3 },
  itemCell: { fontWeight: "700", color: "#0f172a" },
  rightRequestRows: { flex: 1 },
  requestBlock: { flexDirection: "row" },
  requestRowDivider: {
    borderBottomWidth: 1.5, borderBottomColor: "#475569",
  },
  batchLineRow: { justifyContent: "center", paddingHorizontal: 3 },
  batchRowDivider: {
    borderBottomWidth: 1, borderBottomColor: "#94a3b8",
  },
  requestLevelCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  statusCellWrap: { flexDirection: "row", gap: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
});