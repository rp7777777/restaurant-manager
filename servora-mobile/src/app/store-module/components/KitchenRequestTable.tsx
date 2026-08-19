// ============================================
// SERVORA ERP — KitchenRequestTable Component
// ✅ Generic onRowPress(req) callback — this component has NO
//    knowledge of what tapping a row should DO; that decision lives
//    entirely in the parent (index.tsx). PENDING/APPROVED/ISSUED/
//    REJECTED rows are all clickable — status-specific handling is
//    the parent's job (PendingActionModal / IssueKitchenRequestModal
//    / RequestDetailModal), never duplicated here.
// ✅ FIX — header comment corrected to match the ACTUAL column
//    order: S.N. / Item / Batch / Req. Qty / Issued / By / Required
//    / Notes / Status / › (chevron). Status sits right before
//    chevron, AFTER Notes — the previous comment wording was
//    ambiguous about this exact placement.
// ✅ Batch column — shows the batch(es) a Kitchen Issue actually
//    drew from, via batchAllocations (a Map keyed by request id,
//    populated by useStoreRequests' targeted
//    getMovementsByReference() lookup). Not ISSUED yet (or lookup
//    still resolving) → "—". Single batch → "B-102: 5 kg". Multi-
//    batch FEFO issue → every batch on its own line (e.g.
//    "B-102: 3 kg" / "B-108: 2 kg") — never collapses to one.
// ✅ FIX — batch line now includes the unit (req.unit), not just the
//    bare number — "B-102: 3 kg" instead of "B-102: 3", removing
//    ambiguity about what the quantity is measured in.
// ✅ FIX — list key is now `${a.batchId}-${index}` instead of just
//    a.batchId. If a single Kitchen Issue somehow produced more than
//    one allocation record against the SAME batchId (an edge case,
//    but not one this component should assume can never happen),
//    a bare batchId key would collide and React would warn/behave
//    unpredictably. The index suffix guarantees uniqueness within
//    this cell regardless.
// ✅ chevron-right (›) at the end of every row — visual affordance
//    that the row is tappable.
// ✅ Notes column — shows BOTH the request note and the issue note,
//    each explicitly labeled, neither masks the other.
// ✅ No date/status filtering here — renders exactly whatever
//    `requests` array it's given; the parent is responsible for
//    having already scoped it to the selected date.
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { STATUS_COLORS, ROW_HEIGHT } from "../utils/store-formatters";

const COLS = { sn: 26, item: 90, batch: 90, req: 58, issued: 58, by: 78, date: 76, note: 130, status: 76, chevron: 22 };
const TABLE_WIDTH =
  COLS.sn + COLS.item + COLS.batch + COLS.req + COLS.issued + COLS.by + COLS.date + COLS.note + COLS.status + COLS.chevron;

interface KitchenRequestTableProps {
  requests:                     IngredientRequest[];
  batchAllocationsByRequestId:  Map<string, BatchAllocationRecord[]>;
  onRowPress:                   (req: IngredientRequest) => void;
}

export function KitchenRequestTable({ requests, batchAllocationsByRequestId, onRowPress }: KitchenRequestTableProps) {
  return (
    <View style={[styles.tableBlock, { width: TABLE_WIDTH }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={{ width: TABLE_WIDTH }}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.headerCell, { width: COLS.sn }]}>S.N.</Text>
            <Text style={[styles.headerCell, { width: COLS.item }]}>Item</Text>
            <Text style={[styles.headerCell, { width: COLS.batch }]}>Batch</Text>
            <Text style={[styles.headerCell, { width: COLS.req }]}>Req. Qty</Text>
            <Text style={[styles.headerCell, { width: COLS.issued }]}>Issued</Text>
            <Text style={[styles.headerCell, { width: COLS.by }]}>By</Text>
            <Text style={[styles.headerCell, { width: COLS.date }]}>Required</Text>
            <Text style={[styles.headerCell, { width: COLS.note }]}>Notes</Text>
            <Text style={[styles.headerCell, { width: COLS.status }]}>Status</Text>
            <Text style={[styles.headerCell, { width: COLS.chevron }]}></Text>
          </View>

          {requests.map((req, idx) => {
            const statusColor = STATUS_COLORS[req.status];
            const allocations = batchAllocationsByRequestId.get(req.id) ?? [];

            return (
              <TouchableOpacity
                key={req.id}
                style={[styles.dataRow, { minHeight: ROW_HEIGHT }]}
                onPress={() => onRowPress(req)}
                activeOpacity={0.6}
              >
                <Text style={[styles.cell, { width: COLS.sn }]}>{idx + 1}</Text>
                <Text style={[styles.cell, styles.itemCell, { width: COLS.item }]} numberOfLines={1}>{req.itemName}</Text>

                <View style={[styles.batchCellWrap, { width: COLS.batch }]}>
                  {allocations.length > 0 ? (
                    allocations.map((a, index) => (
                      <Text key={`${a.batchId}-${index}`} style={styles.batchLine} numberOfLines={1}>
                        {a.batchNo}: {a.quantity} {req.unit}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.cell}>—</Text>
                  )}
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

                <View style={[styles.statusCellWrap, { width: COLS.status }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.cell, { color: statusColor, fontWeight: "700" }]}>{req.status}</Text>
                </View>

                <View style={[styles.chevronCell, { width: COLS.chevron }]}>
                  <MaterialIcons name="chevron-right" size={16} color="#94a3b8" />
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
  batchCellWrap: { paddingHorizontal: 3, gap: 1 },
  batchLine: { fontSize: 8, color: "#475569", fontWeight: "600" },
  statusCellWrap: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  noteCellWrap: { paddingHorizontal: 3, gap: 1 },
  noteLine: { fontSize: 8, color: "#64748b" },
  chevronCell: { alignItems: "center", justifyContent: "center" },
});