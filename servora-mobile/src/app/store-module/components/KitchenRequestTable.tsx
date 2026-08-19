// ============================================
// SERVORA ERP — KitchenRequestTable Component
// ✅ EVOLUTIONARY EXTRACTION + REDESIGN — Excel-style compact table,
//    moved from index.tsx and updated per the confirmed new
//    interaction model: EVERY row is now tappable (previously only
//    APPROVED rows were, and that behavior was later removed
//    entirely in favor of a separate Actions section — this
//    redesign reintroduces row-tap, but for ALL statuses).
// ✅ Generic onRowPress(req) callback — this component has NO
//    knowledge of what tapping a row should DO. It doesn't know
//    "PENDING → show approve/reject" or "APPROVED → open issue
//    modal" or "ISSUED/REJECTED → show read-only detail" — that
//    status-specific decision making lives entirely in the parent
//    (index.tsx). This keeps the table reusable and means adding a
//    future status or changing what a tap does never requires
//    touching this file.
// ✅ Same column set as before: S.N. / Item / Status / Req. Qty /
//    Issued / By / Required / Notes — same Excel-row-height sizing
//    (COLS/ROW_HEIGHT/TABLE_WIDTH from store-formatters.ts, reused,
//    not duplicated).
// ✅ Notes column shows BOTH the request note and the issue note,
//    each explicitly labeled ("Req: ..." / "Issue: ...") — neither
//    masks the other.
// ✅ No date filtering, no status filtering — this component renders
//    exactly whatever `requests` array it's given; the parent
//    (via useStoreRequests' displayRequests) is responsible for
//    already having scoped it to the selected date.
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { STATUS_COLORS, ROW_HEIGHT, COLS, TABLE_WIDTH } from "../utils/store-formatters";

interface KitchenRequestTableProps {
  requests:    IngredientRequest[];
  onRowPress:  (req: IngredientRequest) => void;
}

export function KitchenRequestTable({ requests, onRowPress }: KitchenRequestTableProps) {
  return (
    <View style={[styles.tableBlock, { width: TABLE_WIDTH }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={{ width: TABLE_WIDTH }}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.headerCell, { width: COLS.sn }]}>S.N.</Text>
            <Text style={[styles.headerCell, { width: COLS.item }]}>Item</Text>
            <Text style={[styles.headerCell, { width: COLS.status }]}>Status</Text>
            <Text style={[styles.headerCell, { width: COLS.req }]}>Req. Qty</Text>
            <Text style={[styles.headerCell, { width: COLS.issued }]}>Issued</Text>
            <Text style={[styles.headerCell, { width: COLS.by }]}>By</Text>
            <Text style={[styles.headerCell, { width: COLS.date }]}>Required</Text>
            <Text style={[styles.headerCell, { width: COLS.note }]}>Notes</Text>
          </View>

          {requests.map((req, idx) => {
            const statusColor = STATUS_COLORS[req.status];
            return (
              <TouchableOpacity
                key={req.id}
                style={[styles.dataRow, { minHeight: ROW_HEIGHT }]}
                onPress={() => onRowPress(req)}
                activeOpacity={0.6}
              >
                <Text style={[styles.cell, { width: COLS.sn }]}>{idx + 1}</Text>
                <Text style={[styles.cell, styles.itemCell, { width: COLS.item }]} numberOfLines={1}>{req.itemName}</Text>
                <View style={[styles.statusCellWrap, { width: COLS.status }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.cell, { color: statusColor, fontWeight: "700" }]}>{req.status}</Text>
                </View>
                <Text style={[styles.cell, { width: COLS.req }]}>{req.orderQuantity} {req.unit}</Text>
                <Text style={[styles.cell, { width: COLS.issued }]}>
                  {req.issuedQuantity !== undefined ? `${req.issuedQuantity} ${req.unit}` : "—"}
                </Text>
                <Text style={[styles.cell, { width: COLS.by }]} numberOfLines={1}>{req.requestedBy}</Text>
                <Text style={[styles.cell, { width: COLS.date }]}>{req.requiredDate}</Text>
                <View style={[styles.noteCellWrap, { width: COLS.note }]}>
                  {req.note ? (
                    <Text style={styles.noteLine} numberOfLines={1}>Req: {req.note}</Text>
                  ) : null}
                  {req.issueNote ? (
                    <Text style={styles.noteLine} numberOfLines={1}>Issue: {req.issueNote}</Text>
                  ) : null}
                  {!req.note && !req.issueNote ? <Text style={styles.noteLine}>—</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tableBlock: {
    borderWidth: 1, borderColor: "#1e293b", borderRadius: 6, overflow: "hidden", marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#fef9c3",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 4,
  },
  headerCell: { fontSize: 9, fontWeight: "800", color: "#1e293b", paddingHorizontal: 3 },
  dataRow: {
    flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fff",
  },
  cell: { fontSize: 9, color: "#334155", paddingHorizontal: 3 },
  itemCell: { fontWeight: "700" },
  statusCellWrap: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  noteCellWrap: { paddingHorizontal: 3, gap: 1 },
  noteLine: { fontSize: 8, color: "#64748b" },
});