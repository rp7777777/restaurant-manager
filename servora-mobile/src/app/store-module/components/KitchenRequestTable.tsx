// ============================================
// SERVORA ERP — KitchenRequestTable Component
// ✅ Generic onRowPress(req) callback — status-specific handling
//    lives in the parent (index.tsx), never duplicated here.
// ✅ Grouped by requestedBy name (matching MovementHistoryModal.tsx's
//    category-grouping pattern) — one group header per unique
//    requester, all their items listed underneath.
// ✅ FIX — group header now shows the requester's name on the left
//    AND the request date on the right (e.g. "Requested by: Rabi"
//    ... "2026-08-20"), using the group's first item's createdAt —
//    all items in a single "Send Request" action share essentially
//    the same createdAt moment, so the first item's date represents
//    the group's request date accurately.
// ✅ FIX — Batch column ("Lot/Batch No." header, matching
//    InventoryTableView.tsx's own column naming convention) now
//    shows ONLY the batch number(s) — e.g. "water1245" — not
//    "water1245: 3 pac". Quantity/unit were redundant here since
//    they're already shown in their own Req. Qty / Issued / Unit
//    columns; mixing quantity into the batch number text made the
//    column visually noisy and inconsistent with how Inventory's own
//    table presents Lot/Batch No. (number only).
// ✅ Unit column unchanged — shows each item's unit of measure
//    (kg/pcs/bottle/etc.) as its own column.
// ✅ Notes column — original Kitchen request note only (req.note),
//    never the Store keeper's issue-time note.
// ✅ chevron-right (›) at the end of every row.
// ✅ Column order: S.N. / Item / Lot/Batch No. / Unit / Req. Qty /
//    Issued / Required / Notes / Status / ›.
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { STATUS_COLORS, ROW_HEIGHT } from "../utils/store-formatters";

const COLS = { sn: 26, item: 90, batch: 80, unit: 50, req: 58, issued: 58, date: 76, note: 130, status: 76, chevron: 22 };
const TABLE_WIDTH =
  COLS.sn + COLS.item + COLS.batch + COLS.unit + COLS.req + COLS.issued + COLS.date + COLS.note + COLS.status + COLS.chevron;

interface KitchenRequestTableProps {
  requests:                     IngredientRequest[];
  batchAllocationsByRequestId:  Map<string, BatchAllocationRecord[]>;
  onRowPress:                   (req: IngredientRequest) => void;
}

interface RequesterGroup {
  requestedBy: string;
  requestDate: string;
  items:       IngredientRequest[];
}

function formatGroupDate(ts: unknown): string {
  if (!ts) return "";
  try {
    const d = (ts as any).toDate ? (ts as any).toDate() : new Date(ts as any);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

export function KitchenRequestTable({ requests, batchAllocationsByRequestId, onRowPress }: KitchenRequestTableProps) {
  const groups = useMemo<RequesterGroup[]>(() => {
    const byName = new Map<string, IngredientRequest[]>();
    for (const req of requests) {
      const key = req.requestedBy || "Unknown";
      const list = byName.get(key) ?? [];
      list.push(req);
      byName.set(key, list);
    }
    return Array.from(byName.entries())
      .map(([requestedBy, items]) => ({
        requestedBy,
        requestDate: formatGroupDate(items[0]?.createdAt),
        items,
      }))
      .sort((a, b) => a.requestedBy.localeCompare(b.requestedBy));
  }, [requests]);

  return (
    <>
      {groups.map((group) => (
        <View key={group.requestedBy} style={[styles.groupBlock, { width: TABLE_WIDTH }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ width: TABLE_WIDTH }}>
              <View style={styles.groupHeader}>
                <View style={styles.groupHeaderLeft}>
                  <MaterialIcons name="person" size={13} color="#fff" />
                  <Text style={styles.groupHeaderText}>Requested by: {group.requestedBy}</Text>
                </View>
                {group.requestDate ? (
                  <Text style={styles.groupHeaderDate}>{group.requestDate}</Text>
                ) : null}
              </View>

              <View style={styles.tableHeaderRow}>
                <Text style={[styles.headerCell, { width: COLS.sn }]}>S.N.</Text>
                <Text style={[styles.headerCell, { width: COLS.item }]}>Item</Text>
                <Text style={[styles.headerCell, { width: COLS.batch }]}>Lot/Batch No.</Text>
                <Text style={[styles.headerCell, { width: COLS.unit }]}>Unit</Text>
                <Text style={[styles.headerCell, { width: COLS.req }]}>Req. Qty</Text>
                <Text style={[styles.headerCell, { width: COLS.issued }]}>Issued</Text>
                <Text style={[styles.headerCell, { width: COLS.date }]}>Required</Text>
                <Text style={[styles.headerCell, { width: COLS.note }]}>Notes</Text>
                <Text style={[styles.headerCell, { width: COLS.status }]}>Status</Text>
                <Text style={[styles.headerCell, { width: COLS.chevron }]}></Text>
              </View>

              {group.items.map((req, idx) => {
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
                            {a.batchNo}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.cell}>—</Text>
                      )}
                    </View>

                    <Text style={[styles.cell, { width: COLS.unit }]}>{req.unit}</Text>
                    <Text style={[styles.cell, { width: COLS.req }]}>{req.orderQuantity}</Text>
                    <Text style={[styles.cell, { width: COLS.issued }]}>
                      {req.issuedQuantity !== undefined ? req.issuedQuantity : "—"}
                    </Text>
                    <Text style={[styles.cell, { width: COLS.date }]}>{req.requiredDate}</Text>

                    <Text style={[styles.cell, { width: COLS.note }]} numberOfLines={2}>
                      {req.note || "—"}
                    </Text>

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
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  groupBlock: {
    marginBottom: 16,
    borderWidth: 1, borderColor: "#1e293b", borderRadius: 6, overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0369a1", paddingVertical: 6, paddingHorizontal: 10,
  },
  groupHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  groupHeaderText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.3 },
  groupHeaderDate: { color: "#dbeafe", fontWeight: "700", fontSize: 10 },
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
  chevronCell: { alignItems: "center", justifyContent: "center" },
});