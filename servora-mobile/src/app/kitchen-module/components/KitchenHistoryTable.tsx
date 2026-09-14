// ============================================
// SERVORA ERP — KitchenHistoryTable Component
// ✅ Kitchen's OWN view of its request history — replaces
//    RequestCard.tsx's card-per-request layout with a professional
//    table, matching the design language already established in
//    HistoricalInventoryTableView.tsx / KitchenRequestTable.tsx
//    (Store's own daily table).
// ✅ Category-grouped (category header shows the date on the
//    right), Item Name merged/vertically-centered per item.
// 🔒 CONFIRMED COLUMN ORDER: S.N. / Item Name / Lot/Batch No. /
//    Closing Stock / Req.Qty / Unit / Required Date / Status.
//    No "Requested By" column — this is Kitchen's own view of
//    requests it made, unlike Store's table which shows multiple
//    requesters.
// ✅ Closing Stock and Req.Qty are REQUEST-level (the value Kitchen
//    entered when creating the request) — merged/vertically
//    centered across that request's own batch rows, exactly
//    matching Kitchen Req.Qty's treatment in
//    MonthlyReportScreen.tsx/KitchenRequestTable.tsx.
// ✅ Lot/Batch No. is BATCH-level — one row per actual allocation,
//    populated only once Store has ISSUED the request (a request
//    with no allocations yet — PENDING/APPROVED/REJECTED — renders
//    as exactly one row with "—" for Lot/Batch No.).
// ✅ batchAllocationsByRequestId is passed in as a prop (fetched by
//    the caller, RequestHistoryScreen.tsx, via the SAME
//    getMovementsByReference()-based pattern already used in
//    MonthlyReportScreen.tsx — no new fetch pattern introduced here,
//    this component is purely presentational).
// ✅ Item grouping key = inventoryId when present, else
//    `itemName::unit` fallback — matches MonthlyReportScreen.tsx's
//    own grouping key exactly, so two different Inventory items that
//    happen to share a display name are never silently merged.
// ✅ Status column also shows rejectionNote (small red line) for
//    REJECTED requests that have one, matching
//    KitchenRequestTable.tsx's own treatment.
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { IngredientRequest } from "../types/kitchen-types";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { Category } from "../../../modules/inventory-module/types/category";
import { STATUS_COLORS } from "../../store-module/utils/store-formatters";

const ROW_HEIGHT = 26;
const COLS = { sn: 35, item: 180, batch: 160, closing: 95, req: 75, unit: 60, date: 95, status: 100 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.batch + COLS.closing + COLS.req + COLS.unit + COLS.date + COLS.status;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.closing; positions.push(x);
  x += COLS.req; positions.push(x);
  x += COLS.unit; positions.push(x);
  x += COLS.date; positions.push(x);
  return positions;
})();

const UNCATEGORIZED_ID = "__uncategorized__";

interface KitchenHistoryTableProps {
  requests:                     IngredientRequest[];
  batchAllocationsByRequestId:  Map<string, BatchAllocationRecord[]>;
  categories:                   Category[];
  categoryDate:                 string;
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

function getRequestRowCount(allocationCount: number): number {
  return allocationCount > 0 ? allocationCount : 1;
}

export function KitchenHistoryTable({ requests, batchAllocationsByRequestId, categories, categoryDate }: KitchenHistoryTableProps) {
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

  const groups = useMemo<CategoryGroup[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, Map<string, IngredientRequest[]>>();

    for (const req of requests) {
      const catKey = req.categoryId && categoryById.has(req.categoryId) ? req.categoryId : UNCATEGORIZED_ID;
      const byItem = byCategory.get(catKey) ?? new Map<string, IngredientRequest[]>();
      const itemKey = req.inventoryId ? req.inventoryId : `${req.itemName}::${req.unit}`;
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
              {categoryDate ? <Text style={styles.groupHeaderDate}>{categoryDate}</Text> : null}
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
                  <Text style={[styles.headerCell, styles.centerCell, { width: COLS.closing }]}>Closing Stock</Text>
                  <Text style={[styles.headerCell, styles.centerCell, { width: COLS.req }]}>Req.Qty</Text>
                  <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                  <Text style={[styles.headerCell, { width: COLS.date }]}>Required Date</Text>
                  <Text style={[styles.headerCell, { width: COLS.status }]}>Status</Text>
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
                    key={itemGroup.itemKey}
                    style={[styles.itemGroupRow, { minHeight: itemGroupHeight }, isEvenRow && styles.itemGroupRowAlt]}
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
                          <View
                            key={req.id}
                            style={[
                              styles.requestBlock,
                              { minHeight: requestBlockHeight },
                              reqIdx < itemGroup.requests.length - 1 && styles.requestRowDivider,
                            ]}
                          >
                            {/* Lot/Batch No. — BATCH-level, per-allocation rows */}
                            <View style={{ width: COLS.batch }}>
                              {rows.map((alloc, rowIdx) => (
                                <View
                                  key={alloc ? alloc.batchId : "no-batch"}
                                  style={[styles.batchLineRow, { height: ROW_HEIGHT }, rowIdx < rows.length - 1 && styles.batchRowDivider]}
                                >
                                  <Text style={styles.cell} numberOfLines={1} ellipsizeMode="tail">{alloc ? alloc.batchNo : "—"}</Text>
                                </View>
                              ))}
                            </View>

                            {/* Closing Stock — REQUEST-level, merged */}
                            <View style={[styles.requestLevelCell, { width: COLS.closing, minHeight: requestBlockHeight }]}>
                              <Text style={[styles.cell, styles.centerCell]}>{req.closingStock} {req.unit}</Text>
                            </View>

                            {/* Req.Qty — REQUEST-level, merged */}
                            <View style={[styles.requestLevelCell, { width: COLS.req, minHeight: requestBlockHeight }]}>
                              <Text style={[styles.cell, styles.centerCell]}>{req.orderQuantity}</Text>
                            </View>

                            {/* Unit — REQUEST-level, merged */}
                            <View style={[styles.requestLevelCell, { width: COLS.unit, minHeight: requestBlockHeight }]}>
                              <Text style={[styles.cell, styles.centerCell]}>{req.unit}</Text>
                            </View>

                            {/* Required Date — REQUEST-level, merged */}
                            <View style={[styles.requestLevelCell, { width: COLS.date, minHeight: requestBlockHeight, alignItems: "flex-start" }]}>
                              <Text style={styles.cell}>{req.requiredDate}</Text>
                            </View>

                            {/* Status — REQUEST-level, merged */}
                            <View style={[styles.requestLevelCell, { width: COLS.status, minHeight: requestBlockHeight }]}>
                              <View style={styles.statusCellWrap}>
                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                <Text style={[styles.cell, { color: statusColor, fontWeight: "700" }]}>{req.status}</Text>
                              </View>
                              {req.status === "REJECTED" && req.rejectionNote ? (
                                <Text style={styles.rejectionNoteText} numberOfLines={2}>{req.rejectionNote}</Text>
                              ) : null}
                            </View>
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
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groupBlock: { borderWidth: 1, borderColor: "#475569", marginBottom: 0 },
  groupHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#0369a1", paddingVertical: 6, paddingHorizontal: 10,
  },
  groupHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },
  groupHeaderDate: { color: "#dbeafe", fontWeight: "700", fontSize: 12 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#fef9c3",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 6,
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
  batchLineRow: { justifyContent: "center", paddingHorizontal: 3, paddingVertical: 2 },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  requestLevelCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  statusCellWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  rejectionNoteText: { fontSize: 9, color: "#dc2626", fontWeight: "600", marginTop: 2, textAlign: "center" },
});