// ============================================
// SERVORA ERP — HistoricalInventoryTable Component
// ✅ PURE DISPLAY — renders the ERP inventory table only. Receives
//    already-filtered/sorted/grouped data and a precomputed status
//    Map from HistoricalInventoryTableView (the controller). It does
//    NOT calculate stock, status, filters or sorting — it only shows:
//    batch.quantity (Opening), batch.issues, batch.closingQuantity
//    (Closing), item.historicalStock (Total QTY) and the given statuses.
// ✅ Letterhead is rendered INSIDE the table's bordered block as its
//    first row (confirmed decision), with "INVENTORY REPORT" + date.
// ✅ Layout — total width 900px in Today mode (870px in Historical,
//    Edit column hidden). Batch/Lot No. and Item Name WRAP onto
//    multiple lines (long batch numbers of 25–30 chars are common);
//    rows grow to fit, item-level columns (Total/Status/Edit) stay
//    vertically centered across the whole item row.
// ✅ Column divider positions are derived from the column width list
//    (no hand-maintained offsets), drawn as absolute lines using the
//    measured table-area height per category.
// ✅ Wrapped in a horizontal ScrollView so a narrow window scrolls the
//    TABLE only, never the whole page.
// ✅ Batch archive/restore indicators (diagonal strike, "Archived" /
//    "Restored [date]"), received-today highlight, data-issue badge,
//    paired Issue lines — all UNCHANGED from the previous single file.
// ============================================

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { HistoricalItemStock } from "../hooks/useHistoricalInventory";

export interface HistoricalCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        HistoricalItemStock[];
}

export type ItemStatusKind = "outOfStock" | "lowStock" | "expiring" | "expired";

const STATUS_STYLE: Record<ItemStatusKind, { label: string; color: string; bg: string }> = {
  outOfStock: { label: "Out of Stock", color: "#b91c1c", bg: "#fef2f2" },
  lowStock:   { label: "Low Stock",    color: "#b45309", bg: "#fffbeb" },
  expiring:   { label: "Expiring",     color: "#c2410c", bg: "#fff7ed" },
  expired:    { label: "Expired",      color: "#7f1d1d", bg: "#fee2e2" },
};

const ROW_HEIGHT = 26;

// ── Column widths (Today mode total = 900px) ──
const LEFT_COLS = { sn: 30, item: 120 };
const RIGHT_COLS = {
  date: 72, batch: 95, receivedQty: 50, opening: 50, issue: 150, closing: 50, unit: 40, expiry: 72,
};
const TOTAL_COL = 55;
const STATUS_COL = 86;
const ARROW_COL = 30;

const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item;
const TABLE_WIDTH_TODAY =
  LEFT_WIDTH +
  RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty + RIGHT_COLS.opening +
  RIGHT_COLS.issue + RIGHT_COLS.closing + RIGHT_COLS.unit + RIGHT_COLS.expiry +
  TOTAL_COL + STATUS_COL + ARROW_COL;

export function getHistoricalTableWidth(isHistorical: boolean): number {
  return isHistorical ? TABLE_WIDTH_TODAY - ARROW_COL : TABLE_WIDTH_TODAY;
}

// Column widths in visual order, Edit column excluded (it is always
// the LAST column when present). Divider x = running sum.
const COLUMN_WIDTHS_IN_ORDER = [
  LEFT_COLS.sn, LEFT_COLS.item,
  RIGHT_COLS.date, RIGHT_COLS.batch, RIGHT_COLS.receivedQty, RIGHT_COLS.opening,
  RIGHT_COLS.issue, RIGHT_COLS.closing, RIGHT_COLS.unit, RIGHT_COLS.expiry,
  TOTAL_COL, STATUS_COL,
];

function buildDividerPositions(includeArrowCol: boolean): number[] {
  const positions: number[] = [];
  let x = 0;
  // A divider after every column except the table's LAST column.
  const lastIndex = includeArrowCol ? COLUMN_WIDTHS_IN_ORDER.length : COLUMN_WIDTHS_IN_ORDER.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    x += COLUMN_WIDTHS_IN_ORDER[i];
    positions.push(x);
  }
  return positions;
}

const DIVIDER_X_POSITIONS_TODAY = buildDividerPositions(true);
const DIVIDER_X_POSITIONS_HISTORICAL = buildDividerPositions(false);

const CATEGORY_ACCENTS_HISTORICAL = [{ bg: "#1e3a5f" }, { bg: "#0f766e" }];
const CATEGORY_ACCENTS_TODAY = [{ bg: "#059669" }, { bg: "#0d9488" }];

function getBatchRowHeight(issueCount: number): number {
  if (issueCount <= 2) return ROW_HEIGHT;
  const lineCount = Math.ceil(issueCount / 2);
  return ROW_HEIGHT * lineCount;
}

interface HistoricalInventoryTableProps {
  groups:                HistoricalCategoryGroup[];
  isHistorical:          boolean;
  selectedDate:          string;
  reportDateLabel:       string;
  inventoryItemById:     Map<string, InventoryItem>;
  statusesByInventoryId: Map<string, ItemStatusKind[]>;
  onItemPress:           (item: InventoryItem) => void;
  restaurantName?:       string;
  restaurantAddress?:    string;
  restaurantPhone?:      string;
  restaurantEmail?:      string;
  restaurantVatNumber?:  string;
}

export function HistoricalInventoryTable({
  groups, isHistorical, selectedDate, reportDateLabel,
  inventoryItemById, statusesByInventoryId, onItemPress,
  restaurantName, restaurantAddress, restaurantPhone, restaurantEmail, restaurantVatNumber,
}: HistoricalInventoryTableProps) {
  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});

  const tableWidth = getHistoricalTableWidth(isHistorical);
  const categoryAccents = isHistorical ? CATEGORY_ACCENTS_HISTORICAL : CATEGORY_ACCENTS_TODAY;
  const dividerXPositions = isHistorical ? DIVIDER_X_POSITIONS_HISTORICAL : DIVIDER_X_POSITIONS_TODAY;

  const letterheadMetaParts: string[] = [];
  if (restaurantPhone) letterheadMetaParts.push(`Phone: ${restaurantPhone}`);
  if (restaurantEmail) letterheadMetaParts.push(`Email: ${restaurantEmail}`);
  if (restaurantVatNumber) letterheadMetaParts.push(`VAT: ${restaurantVatNumber}`);

  const hasLetterheadData = Boolean(restaurantName || restaurantAddress || letterheadMetaParts.length > 0);

  let hasShownColumnHeader = false;
  let categoryAccentIndex = 0;

  return (
    <ScrollView
      horizontal
      style={[styles.tableHScroll, { maxWidth: tableWidth + 2 }]}
      showsHorizontalScrollIndicator
    >
      <View style={[styles.tableOuterBlock, { width: tableWidth }]}>
        {hasLetterheadData && (
          <View style={styles.letterheadCard}>
            <View style={styles.letterheadIconCircle}>
              <MaterialIcons name="storefront" size={16} color="#fff" />
            </View>
            <View style={styles.letterheadTextGroup}>
              {restaurantName ? <Text style={styles.letterheadName}>{restaurantName}</Text> : null}
              {restaurantAddress ? <Text style={styles.letterheadAddress}>{restaurantAddress}</Text> : null}
              {letterheadMetaParts.length > 0 ? (
                <Text style={styles.letterheadMeta}>{letterheadMetaParts.join("   •   ")}</Text>
              ) : null}
            </View>
            <View style={styles.letterheadReportGroup}>
              <Text style={styles.letterheadReportTitle}>INVENTORY REPORT</Text>
              <Text style={styles.letterheadReportDate}>{reportDateLabel}</Text>
            </View>
          </View>
        )}

        {groups.map((group) => {
          const groupHeights = group.items.map((item) =>
            item.batches.reduce((sum, b) => sum + getBatchRowHeight(b.issues.length), 0)
          );
          const key = group.categoryId;
          const measuredHeight = tableAreaHeights[key] ?? 0;
          const accent = categoryAccents[categoryAccentIndex % categoryAccents.length];
          categoryAccentIndex += 1;
          const showColumnHeader = !hasShownColumnHeader;
          if (showColumnHeader) hasShownColumnHeader = true;

          return (
            <View key={key}>
              <View style={[styles.categoryHeader, { backgroundColor: accent.bg }]}>
                <View style={styles.categoryHeaderLeft}>
                  <Text style={styles.categoryHeaderText}>
                    {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                  </Text>
                  <Text style={styles.categoryHeaderCount}>
                    {group.items.length} {group.items.length === 1 ? "item" : "items"}
                  </Text>
                </View>
                <Text style={styles.categoryHeaderDate}>{reportDateLabel}</Text>
              </View>

              <View
                style={styles.tableArea}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  setTableAreaHeights((prev) =>
                    prev[key] === h ? prev : { ...prev, [key]: h }
                  );
                }}
              >
                {showColumnHeader && (
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.sn }]}>S.N.</Text>
                    <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.item }]}>Item Name</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.date }]}>Received Date</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.batch }]}>Lot/Batch No.</Text>
                    <Text style={[styles.tableHeaderCell, styles.headerCenter, { width: RIGHT_COLS.receivedQty }]}>Received Qty</Text>
                    <Text style={[styles.tableHeaderCell, styles.headerCenter, { width: RIGHT_COLS.opening }]}>Opening</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.issue }]}>Issue</Text>
                    <Text style={[styles.tableHeaderCell, styles.headerCenter, { width: RIGHT_COLS.closing }]}>Closing</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                    <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry</Text>
                    <Text style={[styles.tableHeaderCell, styles.headerCenter, { width: TOTAL_COL }]}>Total QTY</Text>
                    <Text style={[styles.tableHeaderCell, { width: STATUS_COL }]}>Status</Text>
                    {!isHistorical && (
                      <Text style={[styles.tableHeaderCell, styles.headerCenter, { width: ARROW_COL }]}>Edit</Text>
                    )}
                  </View>
                )}

                {group.items.map((item, itemIndex) => {
                  const groupHeight = groupHeights[itemIndex];
                  const realItem = inventoryItemById.get(item.inventoryId);
                  const isEvenRow = itemIndex % 2 === 1;
                  const itemStatuses = statusesByInventoryId.get(item.inventoryId) ?? [];

                  return (
                    <View
                      key={item.inventoryId}
                      style={[
                        styles.itemGroupRow,
                        { minHeight: groupHeight },
                        isEvenRow && styles.itemGroupRowAlt,
                      ]}
                    >
                      <View style={[styles.leftStrip, { width: LEFT_WIDTH, minHeight: groupHeight }, isEvenRow && styles.leftStripAlt]}>
                        <Text style={[styles.leftStripCell, { width: LEFT_COLS.sn }]}>{itemIndex + 1}</Text>
                        <View style={{ width: LEFT_COLS.item }}>
                          <Text style={[styles.leftStripCell, styles.itemNameCell]}>{item.itemName}</Text>
                          {item.hasInconsistency && (
                            <View style={styles.inconsistencyBadge}>
                              <MaterialIcons name="warning" size={10} color="#b45309" />
                              <Text style={styles.inconsistencyText}>data issue</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.rightBatchRows}>
                        {item.batches.map((batch, batchIndex) => {
                          const batchRowHeight = getBatchRowHeight(batch.issues.length);
                          const wasReceivedToday = batch.receivedDate === selectedDate;
                          const isArchivedToday = batch.isBatchArchived && batch.batchArchivedDate === selectedDate;
                          const isRestoredToday = batch.isBatchRestoredToday;

                          return (
                            <View
                              key={batch.batchId}
                              style={[
                                styles.batchRow,
                                { minHeight: batchRowHeight },
                                batchIndex < item.batches.length - 1 && styles.batchRowDivider,
                              ]}
                            >
                              <Text style={[
                                styles.tableCell,
                                { width: RIGHT_COLS.date },
                                wasReceivedToday && styles.receivedDateHighlight,
                              ]}>
                                {batch.receivedDate}
                              </Text>
                              <View style={{ width: RIGHT_COLS.batch, position: "relative", justifyContent: "center" }}>
                                <Text style={[
                                  styles.tableCell,
                                  styles.batchNoCell,
                                  isArchivedToday && styles.archivedBatchNoText,
                                  isRestoredToday && styles.restoredBatchNoText,
                                ]}>
                                  {batch.batchNo}
                                </Text>
                                {isArchivedToday && <View style={styles.diagonalStrike} pointerEvents="none" />}
                              </View>
                              <Text style={[styles.tableCell, styles.receivedQtyCell, { width: RIGHT_COLS.receivedQty }]}>
                                {wasReceivedToday ? String(batch.originalQuantity) : "—"}
                              </Text>
                              <Text style={[styles.tableCell, styles.openingQtyCell, { width: RIGHT_COLS.opening }]}>
                                {batch.quantity}
                              </Text>
                              <View style={{ width: RIGHT_COLS.issue }}>
                                {isArchivedToday && (
                                  <Text style={[styles.tableCell, styles.archivedIndicatorText]}>Archived</Text>
                                )}
                                {isRestoredToday && (
                                  <Text style={[styles.tableCell, styles.restoredIndicatorText]}>Restored {batch.batchRestoredDate}</Text>
                                )}
                                {batch.issues.length === 0 ? (
                                  !isArchivedToday && !isRestoredToday && <Text style={[styles.tableCell, styles.issueCell]}>—</Text>
                                ) : batch.issues.length <= 2 ? (
                                  <Text style={[styles.tableCell, styles.issueCell]} numberOfLines={1}>
                                    {batch.issues.map((iss) => `${iss.quantity} ${batch.unit} ${iss.source}`).join(" • ")}
                                  </Text>
                                ) : (
                                  Array.from({ length: Math.ceil(batch.issues.length / 2) }).map((_, lineIdx) => {
                                    const pair = batch.issues.slice(lineIdx * 2, lineIdx * 2 + 2);
                                    return (
                                      <Text key={lineIdx} style={[styles.tableCell, styles.issueCell, styles.issueMultiLine]} numberOfLines={1}>
                                        {pair.map((iss) => `${iss.quantity} ${batch.unit} ${iss.source}`).join(" / ")}
                                      </Text>
                                    );
                                  })
                                )}
                              </View>
                              <Text style={[styles.tableCell, styles.closingQtyCell, { width: RIGHT_COLS.closing }]}>
                                {batch.closingQuantity}
                              </Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                              <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
                            </View>
                          );
                        })}
                      </View>

                      <View style={[styles.centeredCol, { width: TOTAL_COL, minHeight: groupHeight }]}>
                        <Text style={styles.totalCell}>{String(item.historicalStock)}</Text>
                      </View>

                      <View style={[styles.statusCol, { width: STATUS_COL, minHeight: groupHeight }]}>
                        {itemStatuses.length === 0 ? (
                          <Text style={styles.statusNone}>—</Text>
                        ) : (
                          itemStatuses.map((kind) => (
                            <View
                              key={kind}
                              style={[styles.statusBadge, { backgroundColor: STATUS_STYLE[kind].bg }]}
                            >
                              <Text style={[styles.statusBadgeText, { color: STATUS_STYLE[kind].color }]}>
                                {STATUS_STYLE[kind].label}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>

                      {!isHistorical && (
                        <View style={[styles.centeredCol, { width: ARROW_COL, minHeight: groupHeight }]}>
                          {realItem && (
                            <TouchableOpacity onPress={() => onItemPress(realItem)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <MaterialIcons name="chevron-right" size={16} color="#dc2626" />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                {measuredHeight > 0 && dividerXPositions.map((x) => (
                  <View
                    key={x}
                    pointerEvents="none"
                    style={[styles.columnDivider, { left: x, height: measuredHeight }]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tableHScroll: { width: "100%", flexGrow: 0 },
  tableOuterBlock: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 6, overflow: "hidden", backgroundColor: "#fff",
  },
  letterheadCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#cbd5e1",
  },
  letterheadIconCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#2563eb",
    alignItems: "center", justifyContent: "center",
  },
  letterheadTextGroup: { flex: 1 },
  letterheadName: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  letterheadAddress: { fontSize: 12, color: "#475569", marginTop: 1 },
  letterheadMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  letterheadReportGroup: { alignItems: "flex-end", justifyContent: "center", paddingLeft: 12 },
  letterheadReportTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a", letterSpacing: 1.2 },
  letterheadReportDate: { fontSize: 11, fontWeight: "600", color: "#475569", marginTop: 2 },
  categoryHeader: {
    paddingVertical: 4, paddingHorizontal: 10, minHeight: 26,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  categoryHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.6 },
  categoryHeaderCount: { color: "#e2e8f0", fontWeight: "600", fontSize: 11 },
  categoryHeaderDate: { color: "#fff", fontWeight: "700", fontSize: 12 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#eef2f7",
    borderBottomWidth: 1, borderBottomColor: "#cbd5e1", paddingVertical: 6,
  },
  tableHeaderCell: { fontSize: 11, fontWeight: "700", color: "#1e293b", paddingHorizontal: 4 },
  headerCenter: { textAlign: "center" },
  itemGroupRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#cbd5e1" },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingVertical: 4,
  },
  leftStripAlt: { backgroundColor: "#f8fafc" },
  leftStripCell: { fontSize: 11, color: "#475569", paddingHorizontal: 4 },
  itemNameCell: { fontWeight: "700", color: "#0f172a", fontSize: 11 },
  inconsistencyBadge: {
    flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 3, marginLeft: 4, backgroundColor: "#fef3c7", borderRadius: 3, alignSelf: "flex-start",
  },
  inconsistencyText: { fontSize: 7, color: "#92400e", fontWeight: "700" },
  rightBatchRows: { flex: 1 },
  batchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3 },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableCell: { fontSize: 11, color: "#334155", paddingHorizontal: 4 },
  batchNoCell: { flexShrink: 1 },
  receivedDateHighlight: { color: "#0f172a", fontWeight: "800" },
  receivedQtyCell: { color: "#475569", fontWeight: "700", textAlign: "center" },
  openingQtyCell: { fontWeight: "600", color: "#475569", textAlign: "center" },
  closingQtyCell: { fontWeight: "800", color: "#0f172a", textAlign: "center" },
  issueCell: { color: "#b91c1c", fontWeight: "600" },
  issueMultiLine: { marginBottom: 1 },
  centeredCol: { justifyContent: "center", alignItems: "center" },
  totalCell: { fontWeight: "800", fontSize: 11, color: "#0f172a", textAlign: "center" },
  statusCol: { justifyContent: "center", alignItems: "flex-start", gap: 2, paddingHorizontal: 4, paddingVertical: 2 },
  statusBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },
  statusNone: { fontSize: 11, color: "#94a3b8", paddingHorizontal: 2 },
  archivedBatchNoText: { color: "#94a3b8" },
  restoredBatchNoText: { color: "#059669" },
  diagonalStrike: {
    position: "absolute", left: 0, right: 0, top: "50%",
    height: 1.5, backgroundColor: "#dc2626",
    transform: [{ rotate: "-8deg" }],
  },
  archivedIndicatorText: { color: "#dc2626", fontWeight: "800", fontStyle: "italic" },
  restoredIndicatorText: { color: "#059669", fontWeight: "800", fontStyle: "italic" },
  columnDivider: {
    position: "absolute", top: 0, width: 1, backgroundColor: "#dbe3ec",
  },
});