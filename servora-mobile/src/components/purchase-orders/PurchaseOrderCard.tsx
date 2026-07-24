// ============================================
// SERVORA ERP — PurchaseOrderCard Component
// ✅ Pure presentation — displays one PurchaseOrder in the list.
// ✅ Shows supplier name (resolved via a lookup map passed in from
//    the screen, since PurchaseOrder only stores supplierId) —
//    same pattern as InventoryCard resolving categoryId → Category.
// ✅ Status badge — one color per PurchaseOrderStatus so the whole
//    list is scannable at a glance without opening any PO.
// PHASE 8.2
// ============================================

import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { PurchaseOrder, PurchaseOrderStatus } from "../../modules/purchase-order-module/types/purchase-order";
import { Supplier } from "../../modules/supplier-module/types/supplier";

interface PurchaseOrderCardProps {
  order:    PurchaseOrder;
  supplier: Supplier | undefined;
  fmt:      (n: number) => string;
  onPress:  () => void;
}

const STATUS_STYLE: Record<PurchaseOrderStatus, { bg: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  DRAFT:     { bg: "#64748b", icon: "edit-note" },
  PENDING:   { bg: "#d97706", icon: "hourglass-top" },
  APPROVED:  { bg: "#0369a1", icon: "check-circle" },
  RECEIVED:  { bg: "#059669", icon: "inventory" },
  CANCELLED: { bg: "#dc2626", icon: "cancel" },
};

function PurchaseOrderCard({ order, supplier, fmt, onPress }: PurchaseOrderCardProps) {
  const statusStyle = STATUS_STYLE[order.status];
  const itemCount = order.items.length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.topRow}>
        <View style={styles.nameSection}>
          <Text style={styles.poNumber} numberOfLines={1}>{order.poNumber}</Text>
          <Text style={styles.supplierName} numberOfLines={1}>
            {supplier?.name ?? "Unknown supplier"}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
      </View>

      <View style={styles.middleRow}>
        <Text style={styles.itemCountText}>
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </Text>
        <Text style={styles.totalText}>{fmt(order.totalAmount)}</Text>
      </View>

      {order.expectedDeliveryDate && order.status !== "RECEIVED" && order.status !== "CANCELLED" && (
        <Text style={styles.deliveryText}>
          Expected: {order.expectedDeliveryDate}
        </Text>
      )}

      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <MaterialIcons name={statusStyle.icon} size={11} color="#fff" />
          <Text style={styles.statusBadgeText}>{order.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor:   "#fff",
    borderRadius:      12,
    padding:           12,
    marginBottom:      8,
    borderWidth:       1,
    borderColor:       "#e2e8f0",
  },
  topRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  nameSection:    { flex: 1, gap: 2 },
  poNumber:       { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  supplierName:   { fontSize: 12, color: "#64748b", fontWeight: "600" },
  middleRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      8,
  },
  itemCountText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  totalText:     { fontSize: 14, fontWeight: "700", color: "#059669" },
  deliveryText:  { fontSize: 11, color: "#94a3b8", marginTop: 6, fontWeight: "600" },
  badgeRow:      { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  statusBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
  },
  statusBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});

export default memo(PurchaseOrderCard);