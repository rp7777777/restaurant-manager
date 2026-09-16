// ============================================
// SERVORA ERP — KitchenRequestTable Component
// ✅ UI-ONLY REDESIGN — professional light-blue/white/navy SaaS ERP
//    visual language: requester info card, blue/green category
//    accents, compact light table header, flat status, sharp thin
//    grid lines, light-blue View button.
// ✅ Item grouping key prefers inventoryId over itemName-only.
// ✅ "Kitchen Closing Stock" column — request-level, merged, shows
//    req.closingStock (Kitchen's own physical count at request time).
// ✅ NEW — "Kitchen Available Total" column added between Store
//    Issued and Unit — calculated as closingStock + sum of all
//    actual batch allocation quantities for that request (NOT
//    closingStock + req.issuedQuantity — uses the real allocations
//    array so the total reflects actual issued stock, same
//    allocation-only principle as the Store Issued column itself).
//    REQUEST-level (merged/vertically centered), since it's one
//    total per request, not a per-batch value. If no allocations
//    exist yet (request not yet ISSUED), this equals closingStock
//    alone — correct, since Store hasn't given anything yet.
// ✅ "Item Name" column width reduced (250 -> 170) to make room for
//    the new column within the existing layout.
// 🔒 ZERO OTHER business logic changes: requestedBy -> category ->
//    item -> request -> batch-allocation grouping, date formatting
//    functions, request-level vs batch-level cell merging,
//    rejectionNote display, onRowPress, and the existing Store
//    Issued issuedQuantity fallback (pre-existing, intentionally
//    preserved — used ONLY for the Store Issued column's own
//    display, NOT for the new Kitchen Available Total calculation)
//    — all unchanged.
// 🔒 FINAL column order: S.N. / Item Name / Lot/Batch No. / Kitchen
//    Closing Stock / Kitchen Req.Qty / Store Issued / Kitchen
//    Available Total / Unit / Status / View (chevron).
// ✅ Column header row shown ONLY ONCE — first category block of the
//    first requester group (unchanged).
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { Category } from "../../../modules/inventory-module/types/category";
import { STATUS_COLORS } from "../utils/store-formatters";

const ROW_HEIGHT = 24;
const COLS = { sn: 35, item: 170, batch: 150, closing: 80, req: 70, issued: 70, available: 75, unit: 55, status: 90, chevron: 45 };
const TABLE_WIDTH = COLS.sn + COLS.item + COLS.batch + COLS.closing + COLS.req + COLS.issued + COLS.available + COLS.unit + COLS.status + COLS.chevron;

const DIVIDER_X_POSITIONS = (() => {
  const positions: number[] = [];
  let x = 0;
  x += COLS.sn; positions.push(x);
  x += COLS.item; positions.push(x);
  x += COLS.batch; positions.push(x);
  x += COLS.closing; positions.push(x);
  x += COLS.req; positions.push(x);
  x += COLS.issued; positions.push(x);
  x += COLS.available; positions.push(x);
  x += COLS.unit; positions.push(x);
  x += COLS.status; positions.push(x);
  return positions;
})();

const CATEGORY_ACCENTS = [
  { bg: "#2563eb", bgLight: "#eff6ff" },
  { bg: "#059669", bgLight: "#ecfdf5" },
];

const UNCATEGORIZED_ID = "__uncategorized__";

interface KitchenRequestTableProps {
  requests:                     IngredientRequest[];
  batchAllocationsByRequestId:  Map<string, BatchAllocationRecord[]>;
  categories:                   Category[];
  liveDateLabel:                string;
  onRowPress:                   (req: IngredientRequest) => void;
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
        const itemKey = req.inventoryId ? req.inventoryId : `${req.itemName}::${req.unit}`;
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
          .map(([itemKey, itemRequests]) => ({ itemKey, itemName: itemRequests[0].itemName, requests: itemRequests }))
          .sort((a, b) => a.itemName.localeCompare(b.itemName));
        categoryGroups.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items: itemGroups });
      }
      const uncatByItem = byCategory.get(UNCATEGORIZED_ID);
      if (uncatByItem && uncatByItem.size > 0) {
        const itemGroups: ItemGroup[] = Array.from(uncatByItem.entries())
          .map(([itemKey, itemRequests]) => ({ itemKey, itemName: itemRequests[0].itemName, requests: itemRequests }))
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
  let categoryAccentIndex = 0;

  return (
    <View style={{ width: TABLE_WIDTH }}>
      {requesterGroups.map((requesterGroup) => (
        <View key={requesterGroup.requestedBy} style={styles.requesterBlock}>
          <View style={styles.requesterCard}>
            <View style={styles.requesterCardRow}>
              <View style={styles.requesterIconCircle}>
                <MaterialIcons name="person" size={16} color="#fff" />
              </View>
              <Text style={styles.requesterName}>
                Requested by: <Text style={styles.requesterNameBold}>{requesterGroup.requestedBy}</Text>
              </Text>
              <View style={styles.spacer} />
              <View style={styles.liveDateBadge}>
                <MaterialIcons name="event" size={13} color="#1e3a8a" />
                <Text style={styles.liveDateBadgeText}>{liveDateLabel}</Text>
              </View>
            </View>
            <View style={styles.requesterMetaRow}>
              {requesterGroup.requestedDate ? (
                <View style={styles.requesterMetaItem}>
                  <MaterialIcons name="event" size={13} color="#2563eb" />
                  <View>
                    <Text style={styles.requesterMetaLabel}>Requested Date:</Text>
                    <Text style={styles.requesterMetaValue}>{requesterGroup.requestedDate}</Text>
                  </View>
                </View>
              ) : null}
              {requesterGroup.requiredDate ? (
                <View style={styles.requesterMetaItem}>
                  <MaterialIcons name="event" size={13} color="#2563eb" />
                  <View>
                    <Text style={styles.requesterMetaLabel}>Required Date:</Text>
                    <Text style={styles.requesterMetaValueGreen}>{requesterGroup.requiredDate}</Text>
                  </View>
                </View>
              ) : null}
              {requesterGroup.note ? (
                <View style={styles.requesterMetaItem}>
                  <MaterialIcons name="description" size={13} color="#2563eb" />
                  <View>
                    <Text style={styles.requesterMetaLabel}>Note:</Text>
                    <Text style={styles.requesterMetaValueNote}>{requesterGroup.note}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {requesterGroup.categories.map((group) => {
            const measuredHeight = tableAreaHeights[`${requesterGroup.requestedBy}::${group.categoryId}`] ?? 0;
            const showColumnHeader = !hasShownColumnHeader;
            if (showColumnHeader) hasShownColumnHeader = true;
            const accent = CATEGORY_ACCENTS[categoryAccentIndex % CATEGORY_ACCENTS.length];
            categoryAccentIndex += 1;
            const itemCount = group.items.length;

            return (
              <View key={group.categoryId} style={styles.groupBlock}>
                <View style={[styles.categoryHeader, { backgroundColor: accent.bg }]}>
                  <Text style={styles.categoryHeaderText}>
                    {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                  </Text>
                  <Text style={styles.categoryHeaderCount}>{itemCount} item{itemCount === 1 ? "" : "s"}</Text>
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
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.closing }]}>Kitchen Closing Stock</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.req }]}>Kitchen Req.Qty</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.issued }]}>Store Issued</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.available }]}>Kitchen Available Total</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.unit }]}>Unit</Text>
                      <Text style={[styles.headerCell, { width: COLS.status }]}>Status</Text>
                      <Text style={[styles.headerCell, styles.centerCell, { width: COLS.chevron }]}>View</Text>
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
                            const availableTotal = req.closingStock + allocations.reduce((sum, a) => sum + a.quantity, 0);

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

                                <View style={[styles.requestLevelCell, { width: COLS.closing, minHeight: requestBlockHeight }]}>
                                  <Text style={[styles.cell, styles.centerCell]}>{req.closingStock}</Text>
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

                                <View style={[styles.requestLevelCell, { width: COLS.available, minHeight: requestBlockHeight }]}>
                                  <Text style={[styles.cell, styles.centerCell, styles.availableCellText]}>{availableTotal}</Text>
                                </View>

                                <View style={[styles.requestLevelCell, { width: COLS.unit, minHeight: requestBlockHeight }]}>
                                  <Text style={[styles.cell, styles.centerCell]}>{req.unit}</Text>
                                </View>

                                <View style={[styles.requestLevelCell, { width: COLS.status, minHeight: requestBlockHeight, alignItems: "flex-start" }]}>
                                  <View style={styles.statusRow}>
                                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                    <Text style={[styles.statusText, { color: statusColor }]}>{req.status}</Text>
                                  </View>
                                  {req.status === "REJECTED" && req.rejectionNote ? (
                                    <Text style={styles.rejectionNoteText} numberOfLines={2}>{req.rejectionNote}</Text>
                                  ) : null}
                                </View>

                                <View style={[styles.requestLevelCell, { width: COLS.chevron, minHeight: requestBlockHeight }]}>
                                  <TouchableOpacity style={styles.viewBtn} onPress={() => onRowPress(req)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <MaterialIcons name="chevron-right" size={16} color="#2563eb" />
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
  requesterBlock: {
    marginBottom: 10, borderRadius: 5, overflow: "hidden",
    borderWidth: 1.5, borderColor: "#334155",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },

  requesterCard: {
    backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingTop: 3, paddingBottom: 7, gap: 5,
  },
  requesterCardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  requesterIconCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#2563eb",
    alignItems: "center", justifyContent: "center",
  },
  requesterName: { fontSize: 14, color: "#1e293b", fontWeight: "600" },
  requesterNameBold: { fontWeight: "800", color: "#0f172a" },
  spacer: { flex: 1 },
  liveDateBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#bfdbfe", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  liveDateBadgeText: { fontSize: 12, fontWeight: "800", color: "#1e3a8a" },
  requesterMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  requesterMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  requesterMetaLabel: { fontSize: 10, color: "#64748b", fontWeight: "600" },
  requesterMetaValue: { fontSize: 12, color: "#0f172a", fontWeight: "800" },
  requesterMetaValueNote: { fontSize: 12, color: "#dc2626", fontWeight: "800" },
  requesterMetaValueGreen: { fontSize: 12, color: "#059669", fontWeight: "800" },

  groupBlock: { borderTopWidth: 1, borderTopColor: "#94a3b8" },
  categoryHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 4, paddingHorizontal: 14, minHeight: 20,
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },
  categoryHeaderCount: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 11 },

  tableArea: { position: "relative", backgroundColor: "#fff" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 1.35, borderBottomColor: "#334155", paddingVertical: 3, minHeight: 20, alignItems: "center",
  },
  headerCell: { fontSize: 12, fontWeight: "800", color: "#334155", paddingHorizontal: 6 },
  centerCell: { textAlign: "center" },
  itemGroupRow: {
    flexDirection: "row",
    borderBottomWidth: 1, borderBottomColor: "#94a3b8",
  },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 0,
  },
  cell: { fontSize: 12, color: "#334155", paddingHorizontal: 6 },
  itemCell: { fontWeight: "700", color: "#0f172a", fontSize: 13 },
  rightRequestRows: { flex: 1 },
  requestBlock: { flexDirection: "row" },
  requestRowDivider: {
    borderBottomWidth: 1, borderBottomColor: "#94a3b8",
  },
  batchLineRow: { justifyContent: "center", paddingHorizontal: 6, paddingVertical: 2 },
  batchRowDivider: {
    borderBottomWidth: 1, borderBottomColor: "#cbd5e1",
  },
  requestLevelCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  availableCellText: { fontWeight: "800", color: "#0f172a" },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },

  rejectionNoteText: { fontSize: 9, color: "#dc2626", fontWeight: "600", marginTop: 2 },
  viewBtn: {
    width: 26, height: 26, borderRadius: 6, backgroundColor: "#eff6ff",
    alignItems: "center", justifyContent: "center",
  },
});