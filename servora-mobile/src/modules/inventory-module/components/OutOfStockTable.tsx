// ============================================
// SERVORA ERP — OutOfStockTable Component
// ✅ PURE DISPLAY — the dedicated "Out of Stock" table shown when the
//    Out of Stock stat card filter is active (Today mode only).
//    Receives already-built, category-grouped rows from
//    HistoricalInventoryTableView (the controller) — which items are
//    out of stock and their depletedSince date are decided THERE,
//    not here.
// ✅ Rendering moved UNCHANGED from HistoricalInventoryTableView.tsx:
//    one bordered block per category, S.N. | Item Name | Date | Note.
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export interface OutOfStockRow {
  inventoryId:   string;
  itemName:      string;
  categoryId:    string;
  depletedSince: string | null;
}

export interface OutOfStockGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        OutOfStockRow[];
}

const OOS_TABLE_WIDTH = 900;
const OOS_COLS = { sn: 50, item: 260, date: 160, note: 180 };
const ROW_HEIGHT = 26;

interface OutOfStockTableProps {
  groups:          OutOfStockGroup[];
  headerBg:        string;
  reportDateLabel: string;
}

export function OutOfStockTable({ groups, headerBg, reportDateLabel }: OutOfStockTableProps) {
  if (groups.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="check-circle" size={40} color="#cbd5e1" />
        <Text style={styles.emptyStateText}>No out-of-stock items</Text>
      </View>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <View key={group.categoryId} style={[styles.categoryBlock, { width: OOS_TABLE_WIDTH }]}>
          <View style={[styles.categoryHeader, { backgroundColor: headerBg }]}>
            <Text style={styles.categoryHeaderText}>
              {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
            </Text>
            <Text style={styles.categoryHeaderDate}>{reportDateLabel}</Text>
          </View>
          <View style={styles.oosTableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: OOS_COLS.sn }]}>S.N.</Text>
            <Text style={[styles.tableHeaderCell, { width: OOS_COLS.item }]}>Item Name</Text>
            <Text style={[styles.tableHeaderCell, { width: OOS_COLS.date }]}>Date</Text>
            <Text style={[styles.tableHeaderCell, { width: OOS_COLS.note }]}>Note</Text>
          </View>
          {group.items.map((item, itemIndex) => (
            <View
              key={item.inventoryId}
              style={[styles.oosRow, itemIndex % 2 === 1 && styles.rowAlt]}
            >
              <Text style={[styles.cell, { width: OOS_COLS.sn }]}>{itemIndex + 1}</Text>
              <Text style={[styles.itemNameCell, { width: OOS_COLS.item }]}>{item.itemName}</Text>
              <Text style={[styles.cell, { width: OOS_COLS.date }]}>{item.depletedSince ?? "—"}</Text>
              <Text style={[styles.oosNoteText, { width: OOS_COLS.note }]}>Out of stock</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  categoryBlock: {
    marginBottom: 16, borderWidth: 1.5, borderColor: "#475569", borderRadius: 4, overflow: "hidden",
  },
  categoryHeader: {
    paddingVertical: 4, paddingHorizontal: 10, minHeight: 26,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.6 },
  categoryHeaderDate: { color: "#fff", fontWeight: "700", fontSize: 12 },
  oosTableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8, paddingHorizontal: 10,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: "700", color: "#1e293b", paddingHorizontal: 4, letterSpacing: 0.3 },
  oosRow: {
    flexDirection: "row", alignItems: "center",
    minHeight: ROW_HEIGHT,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 2, borderBottomColor: "#1e293b",
  },
  rowAlt: { backgroundColor: "#f8fafc" },
  cell: { fontSize: 11, color: "#475569", paddingHorizontal: 4 },
  itemNameCell: { fontWeight: "700", color: "#0f172a", fontSize: 11 },
  oosNoteText: { fontSize: 10, color: "#dc2626", fontWeight: "700" },
});