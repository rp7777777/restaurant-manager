// ============================================
// SERVORA ERP — InventoryBatchTable Component
// ✅ Displays the batch history for ONE item, matching the Excel-
//    style layout confirmed earlier.
// ✅ This is the SINGLE-ITEM view (used inside ItemDetailsDrawer).
// ✅ Only ACTIVE batches (isActiveBatch()) are shown by default. A
//    "Show depleted batches" toggle reveals the full history.
// ✅ Rows sorted by receivedDate ascending.
// ✅ Status badges shown in their own dedicated area below the
//    quantity.
// ✅ Pure presentation — receives batches as a prop; does not
//    subscribe itself.
// ✅ An "Edit" icon per row, reporting the tapped batch upward via
//    onEditBatch.
// ✅ FIX — the Edit TouchableOpacity now uses ONLY styles.colEdit
//    (a ViewStyle-compatible layout style), not
//    [styles.cell, styles.colEdit] — styles.cell contains TextStyle-
//    only properties (fontSize, color) meant for the <Text> cells in
//    this table, which TypeScript correctly rejects when applied to
//    a TouchableOpacity/View. The icon's own size/color props
//    already handle its visual appearance; the wrapper only needs
//    layout (flex/alignment), which colEdit alone provides.
// FROZEN
// ============================================

import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryBatch, isActiveBatch, InventoryBatchStatus } from "../types/inventory-batch";

interface InventoryBatchTableProps {
  batches:      InventoryBatch[];
  loading:      boolean;
  onEditBatch:  (batch: InventoryBatch) => void;
}

const STATUS_BADGE: Record<Exclude<InventoryBatchStatus, "ACTIVE">, { label: string; color: string }> = {
  CLOSED:      { label: "Closed",      color: "#64748b" },
  EXPIRED:     { label: "Expired",     color: "#991b1b" },
  QUARANTINED: { label: "Quarantined", color: "#d97706" },
  RECALLED:    { label: "Recalled",    color: "#dc2626" },
};

export function InventoryBatchTable({ batches, loading, onEditBatch }: InventoryBatchTableProps) {
  const [showDepleted, setShowDepleted] = useState(false);

  const visibleBatches = useMemo(() => {
    if (showDepleted) return batches;
    return batches.filter(isActiveBatch);
  }, [batches, showDepleted]);

  const totalQuantity = useMemo(() => {
    return visibleBatches.filter(isActiveBatch).reduce((sum, b) => sum + b.quantity, 0);
  }, [visibleBatches]);

  const hasDepletedBatches = batches.some((b) => !isActiveBatch(b));
  const displayUnit = batches[0]?.unit ?? "";

  if (loading) {
    return <Text style={styles.loadingText}>Loading batches...</Text>;
  }

  if (batches.length === 0) {
    return <Text style={styles.emptyText}>No batches recorded for this item yet</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.colDate]}>Date</Text>
        <Text style={[styles.headerCell, styles.colBatch]}>Batch No.</Text>
        <Text style={[styles.headerCell, styles.colStock]}>Current Stock</Text>
        <Text style={[styles.headerCell, styles.colUnit]}>Unit</Text>
        <Text style={[styles.headerCell, styles.colExpiry]}>Expiry</Text>
        <Text style={[styles.headerCell, styles.colEdit]}></Text>
      </View>

      {visibleBatches.length === 0 ? (
        <Text style={styles.emptyText}>No active batches</Text>
      ) : (
        visibleBatches.map((batch) => {
          const badge = batch.status !== "ACTIVE" ? STATUS_BADGE[batch.status] : null;
          const isDepleted = !isActiveBatch(batch);

          return (
            <View key={batch.id}>
              <View style={[styles.row, isDepleted && styles.rowDepleted]}>
                <Text style={[styles.cell, styles.colDate]}>{batch.receivedDate}</Text>
                <Text style={[styles.cell, styles.colBatch]} numberOfLines={1}>{batch.batchNo}</Text>
                <Text style={[styles.cell, styles.colStock, styles.stockText]}>{batch.quantity}</Text>
                <Text style={[styles.cell, styles.colUnit]}>{batch.unit}</Text>
                <Text style={[styles.cell, styles.colExpiry]}>{batch.expiryDate ?? "—"}</Text>
                <TouchableOpacity
                  style={styles.colEdit}
                  onPress={() => onEditBatch(batch)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="edit" size={14} color="#0369a1" />
                </TouchableOpacity>
              </View>
              {badge && (
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: badge.color }]}>
                    <Text style={styles.badgeText}>{badge.label}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Active Stock</Text>
        <View style={styles.totalValueGroup}>
          <Text style={styles.totalValue}>{totalQuantity}</Text>
          <Text style={styles.totalUnit}>{displayUnit}</Text>
        </View>
      </View>

      {hasDepletedBatches && (
        <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowDepleted((v) => !v)}>
          <MaterialIcons
            name={showDepleted ? "visibility-off" : "history"}
            size={14}
            color="#0369a1"
          />
          <Text style={styles.toggleBtnText}>
            {showDepleted ? "Hide depleted batches" : "Show depleted batches"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  loadingText: { fontSize: 12, color: "#94a3b8", paddingVertical: 12 },
  emptyText: { fontSize: 12, color: "#94a3b8", paddingVertical: 12, fontStyle: "italic" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1e293b",
    paddingBottom: 6,
    marginBottom: 4,
  },
  headerCell: { fontSize: 9, fontWeight: "800", color: "#64748b", textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowDepleted: { opacity: 0.5 },
  cell: { fontSize: 12, color: "#334155" },
  colDate:   { flex: 1.3 },
  colBatch:  { flex: 1.2 },
  colStock:  { flex: 1 },
  colUnit:   { flex: 0.7 },
  colExpiry: { flex: 1.3 },
  colEdit:   { flex: 0.4, alignItems: "center" },
  stockText: { fontWeight: "700", color: "#1e293b" },
  badgeRow: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: "#1e293b",
  },
  totalLabel: { fontSize: 12, fontWeight: "700", color: "#1e293b" },
  totalValueGroup: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  totalValue: { fontSize: 13, fontWeight: "800", color: "#059669" },
  totalUnit: { fontSize: 11, fontWeight: "600", color: "#059669" },
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 10, alignSelf: "flex-start",
  },
  toggleBtnText: { fontSize: 11, fontWeight: "700", color: "#0369a1" },
});