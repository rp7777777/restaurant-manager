// ============================================
// SERVORA ERP — KitchenRequestTable Component
// ✅ Generic onRowPress(req) callback.
// ✅ Grouping: requestedBy -> category -> item -> individual
//    requests -> batch allocation rows. A second requester produces
//    its own separate table block.
// ✅ Requester header — entire band is standard Excel-style bright
//    yellow (#FFFF00) background. Top line: "Requested by: [name]"
//    (left) and the currently-viewed day (liveDateLabel, always a
//    formatted date, no label prefix) on the SAME line, right-
//    aligned. Below that, LEFT-aligned stacked bold lines:
//    "Requested Date: [createdAt]", "Required Date: [requiredDate,
//    now consistently formatted]", "Note: [note, red text]".
// ✅ "Requested By" column REMOVED entirely from the table (already
//    shown once at the requester-header level — was previously
//    duplicated on every single row).
// ✅ NEW — table width fixed at exactly 900px (COLS values tuned:
//    sn 40 + item 250 + batch 200 + req 90 + issued 90 + unit 70 +
//    status 100 + chevron 60 = 900).
// ✅ Column headers renamed: "Req.Qty" -> "Kitchen Req.Qty", "Issued"
//    -> "Store Issued" (clearer about which side each quantity
//    represents).
// ✅ "Notes" and "Required Date" columns removed from the table
//    itself (shown once in the requester header instead).
// ✅ FINAL column order: S.N. / Item Name / Lot/Batch No. / Kitchen
//    Req.Qty / Store Issued / Unit / Status / View (chevron).
// ✅ Column header row shown ONLY ONCE — the first category block of
//    the first requester group.
// ✅ "Item Name" merged/vertically-centered per item. "Kitchen
//    Req.Qty"/"Unit" are REQUEST-LEVEL — only "Lot/Batch No."/"Store
//    Issued" are truly per-batch.
// ✅ Status column also shows rejectionNote for REJECTED requests.
// ✅ Row click: ONLY the "View" chevron opens the detail/action modal.
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
const COLS = { sn: 40, item: 250, batch: 200, req: 90, issued: 90, unit: 70, status: 100, chevron: 60 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.batch + COLS.req + COLS.issued + COLS.unit + COLS.status + COLS.chevron;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.req; positions.push(x);
  x += COLS.issued; positions.push(x);
  x += COLS.unit; positions.push(x);
  x += COLS.status; positions.push(x);
  return positions;
})();

const UNCATEGORIZED_ID = "__uncategorized__";

interface KitchenRequestTableProps {
  requests:                     IngredientRequest[];
  batchAllocationsByRequestId:  Map<string, BatchAllocationRecord[]>;
  categories:                   Category[];
  liveDateLabel:                string;
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
  items:        ItemGroup[];
}

interface RequesterGroup {
  requestedBy:   string;
  requestedDate: string;
  requiredDate:  string;
  note:          string;
  categories:    CategoryGroup[];
}

function formatGroupDate(ts: unknown): string {
  if (!ts) return "";
  try {
    const d = (ts as any).toDate ? (ts as any).toDate() : new Date(ts as any);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function formatRequiredDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function getRequestRowCount(allocationCount: number): number {
  return allocationCount > 0 ? allocationCount : 1;
}

export function KitchenRequestTable({ requests, batchAllocationsByRequestId, categories, liveDateLabel, onRowPress }: KitchenRequestTableProps) {
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

  const requesterGroups = useMemo<RequesterGroup[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const byRequester = new Map<string, IngredientRequest[]>();
    for (const req of requests) {
      const key = req.requestedBy || "Unknown";
      const list = byRequester.get(key) ?? [];
      list.push(req);
      byRequester.set(key, list);
    }

    const result: RequesterGroup[] = [];
    for (const [requestedBy, requesterRequests] of byRequester.entries()) {
      const byCategory = new Map<string, Map<string, IngredientRequest[]>>();
      for (const req of requesterRequests) {
        const catKey = req.categoryId && categoryById.has(req.categoryId) ? req.categoryId : UNCATEGORIZED_ID;
        const byItem = byCategory.get(catKey) ?? new Map<string, IngredientRequest[]>();
        const itemKey = req.itemName;
        const list = byItem.get(itemKey) ?? [];
        list.push(req);
        byItem.set(itemKey, list);
        byCategory.set(catKey, byItem);
      }

      const categoryGroups: CategoryGroup[] = [];
      for (const category of categories) {
        const byItem = byCategory.get(category.id);
        if (!byItem || byItem.size === 0) continue;
        const itemGroups: ItemGroup[] = Array.from(byItem.entries())
          .map(([itemName, itemRequests]) => ({ itemName, requests: itemRequests }))
          .sort((a, b) => a.itemName.localeCompare(b.itemName));
        categoryGroups.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items: itemGroups });
      }
      const uncatByItem = byCategory.get(UNCATEGORIZED_ID);
      if (uncatByItem && uncatByItem.size > 0) {
        const itemGroups: ItemGroup[] = Array.from(uncatByItem.entries())
          .map(([itemName, itemRequests]) => ({ itemName, requests: itemRequests }))
          .sort((a, b) => a.itemName.localeCompare(b.itemName));
        categoryGroups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: itemGroups });
      }
      categoryGroups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

      const firstReq = requesterRequests[0];
      result.push({
        requestedBy,
        requestedDate: formatGroupDate(firstReq?.createdAt),
        requiredDate:  formatRequiredDate(firstReq?.requiredDate ?? ""),
        note:          firstReq?.note ?? "",
        categories:    categoryGroups,
      });
    }

    result.sort((a, b) => a.requestedBy.localeCompare(b.requestedBy));
    return result;
  }, [requests, categories]);

  let hasShownColumnHeader = false;

  return (
    <View style={{ width: TABLE_WIDTH }}>
      {requesterGroups.map((requesterGroup) => (
        <View key={requesterGroup.requestedBy} style={styles.requesterBlock}>
          <View style={styles.requesterHeader}>
            <View style={styles.requesterHeaderTop}>
              <View style={styles.requesterHeaderRow}>
                <MaterialIcons name="person" size={14} color="#1e293b" />
                <Text style={styles.requesterHeaderText}>Requested by: {requesterGroup.requestedBy}</Text>
              </View>
              <Text style={styles.liveDateText}>{liveDateLabel}</Text>
            </View>
            {requesterGroup.requestedDate ? (
              <Text style={styles.requesterHeaderSubText}>Requested Date: {requesterGroup.requestedDate}</Text>
            ) : null}
            {requesterGroup.requiredDate ? (
              <Text style={styles.requesterHeaderSubText}>Required Date: {requesterGroup.requiredDate}</Text>
            ) : null}
            {requesterGroup.note ? (
              <Text style={styles.requesterHeaderNoteText}>Note: {requesterGroup.note}</Text>
            ) : null}
          </View>

          {requesterGroup.categories.map((group) => {
            const measuredHeight = tableAreaHeights[`${requesterGroup.requestedBy}::${group.categoryId}`] ?? 0;
            const showColumnHeader = !hasShownColumnHeader;
            if (showColumnHeader) hasShownColumnHeader = true;

            return (
              <View key={group.categoryId} style={styles.groupBlock}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryHeaderText}>
                    {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                  </Text>
                </View>

                <View
                  style={styles.tableArea}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    const key = `${requesterGroup.requestedBy}::${group.categoryId}`;
                    setTableAreaHeights((prev) =>
                      prev[key] === h ? prev : { ...prev, [key]: h }
                    );
                  }}
                >
                  {showColumnHeader && (
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.headerCell, { width: COLS.sn }]}>S.N.</Text>
                      <Text style={[styles.headerCell, { width: COLS.item }]}>Item Name</Text>
                      <Text style={[styles.headerCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.req }]}>Kitchen Req.Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.issued }]}>Store Issued</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                      <Text style={[styles.headerCell, { width: COLS.status }]}>Status</Text>
                      <Text style={[styles.headerCell, { width: COLS.chevron }]}>View</Text>
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
                                      style={[
                                        styles.batchLineRow,
                                        { height: ROW_HEIGHT },
                                        rowIdx < rows.length - 1 && styles.batchRowDivider,
                                      ]}
                                    >
                                      <Text style={styles.cell} numberOfLines={1} ellipsizeMode="tail">{alloc ? alloc.batchNo : "—"}</Text>
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

                                <View style={[styles.requestLevelCell, { width: COLS.unit, minHeight: requestBlockHeight }]}>
                                  <Text style={[styles.cell, styles.centerCell]}>{req.unit}</Text>
                                </View>

                                <View style={[styles.requestLevelCell, { width: COLS.status, minHeight: requestBlockHeight }]}>
                                  <View style={styles.statusCellWrap}>
                                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                    <Text style={[styles.cell, { color: statusColor, fontWeight: "700" }]}>{req.status}</Text>
                                  </View>
                                  {req.status === "REJECTED" && req.rejectionNote ? (
                                    <Text style={styles.rejectionNoteText} numberOfLines={2}>{req.rejectionNote}</Text>
                                  ) : null}
                                </View>

                                <View style={[styles.requestLevelCell, { width: COLS.chevron, minHeight: requestBlockHeight }]}>
                                  <TouchableOpacity onPress={() => onRowPress(req)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <MaterialIcons name="chevron-right" size={16} color="#dc2626" />
                                  </TouchableOpacity>
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  requesterBlock: { marginBottom: 16, borderWidth: 1.5, borderColor: "#1e293b", borderRadius: 4, overflow: "hidden" },
  requesterHeader: {
    backgroundColor: "#FFFF00", paddingVertical: 8, paddingHorizontal: 10, gap: 2,
  },
  requesterHeaderTop: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 2,
  },
  requesterHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  requesterHeaderText: { color: "#1e293b", fontWeight: "700", fontSize: 13, letterSpacing: 0.3 },
  requesterHeaderSubText: { color: "#1e293b", fontWeight: "700", fontSize: 11 },
  requesterHeaderNoteText: { color: "#FF0000", fontWeight: "700", fontSize: 11 },
  liveDateText: { color: "#1e293b", fontWeight: "800", fontSize: 12 },
  groupBlock: { borderTopWidth: 1, borderTopColor: "#475569" },
  categoryHeader: {
    backgroundColor: "#0369a1", paddingVertical: 6, paddingHorizontal: 10,
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.3 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#fef9c3",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 2,
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
  batchLineRow: { justifyContent: "center", paddingHorizontal: 3, paddingVertical: 2 },
  batchRowDivider: {
    borderBottomWidth: 1, borderBottomColor: "#94a3b8",
  },
  requestLevelCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  statusCellWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  rejectionNoteText: { fontSize: 9, color: "#dc2626", fontWeight: "600", marginTop: 2, textAlign: "center" },
});