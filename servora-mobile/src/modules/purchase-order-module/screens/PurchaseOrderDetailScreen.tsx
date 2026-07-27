// ============================================
// SERVORA ERP — PurchaseOrderDetailScreen
// ✅ Phase 8.2c — replaces the console.log placeholder that
//    PurchaseOrdersScreen's card tap used to call.
// ✅ Takes the PurchaseOrder directly as a prop rather than
//    re-subscribing to Firestore — the list screen (parent) already
//    holds a live subscription via usePurchaseOrders, so this avoids
//    a second redundant listener for the same data. If this screen
//    is ever reached via deep-link/URL instead of always through
//    the list, that's the trigger to add its own fetch-by-id.
// ✅ Status → action mapping:
//    DRAFT/PENDING → "Approve" button (PENDING skipped in the UI —
//      the Create form always creates as DRAFT, and there's no
//      separate "submit for approval" step yet, so Approve moves
//      DRAFT straight to APPROVED. PENDING remains a valid backend
//      state for future use, just not one this screen's button
//      produces today.)
//    APPROVED       → "Receive Goods" button (opens ReceiveGoodsForm)
//    RECEIVED/CANCELLED → terminal, no actions
// ✅ "Cancel PO" available from any non-terminal state — mirrors
//    VALID_TRANSITIONS in the FROZEN repository (DRAFT/PENDING/
//    APPROVED can all transition to CANCELLED).
// ✅ Approve/Cancel both go through purchase-order-service.ts
//    (approvePurchaseOrder/cancelPurchaseOrder) rather than calling
//    the repository directly — a stable place to later add an
//    approvedBy/approvedAt stamp, notifications, or an audit log
//    without touching the FROZEN repository or this screen again.
// ✅ Both actions confirm via Alert.alert first — neither is
//    reversible from this screen (VALID_TRANSITIONS never allows
//    APPROVED back to DRAFT, or un-cancelling), so a stray tap
//    shouldn't be able to do either silently.
// PHASE 8.2c
// ============================================

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { approvePurchaseOrder, cancelPurchaseOrder } from "../services/purchase-order-service";
import { PurchaseOrder } from "../types/purchase-order";
import { Supplier } from "../../supplier-module/types/supplier";
import ReceiveGoodsForm from "./ReceiveGoodsForm";

interface PurchaseOrderDetailScreenProps {
  order:     PurchaseOrder;
  supplier:  Supplier | undefined;
  fmt:       (n: number) => string;
  onBack:    () => void;
  onChanged: () => void;  // called after a successful status change, so the parent can refresh/close
}

const STATUS_STYLE: Record<string, { bg: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  DRAFT:     { bg: "#64748b", icon: "edit-note" },
  PENDING:   { bg: "#d97706", icon: "hourglass-top" },
  APPROVED:  { bg: "#0369a1", icon: "check-circle" },
  RECEIVED:  { bg: "#059669", icon: "inventory" },
  CANCELLED: { bg: "#dc2626", icon: "cancel" },
};

export default function PurchaseOrderDetailScreen({
  order, supplier, fmt, onBack, onChanged,
}: PurchaseOrderDetailScreenProps) {
  const { restaurantId } = useApp();
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusStyle = STATUS_STYLE[order.status];

  const doApprove = useCallback(async () => {
    if (!restaurantId) return;
    setError(null);
    setBusy(true);
    try {
      await approvePurchaseOrder(restaurantId, order.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  }, [restaurantId, order.id, onChanged]);

  const doCancel = useCallback(async () => {
    if (!restaurantId) return;
    setError(null);
    setBusy(true);
    try {
      await cancelPurchaseOrder(restaurantId, order.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setBusy(false);
    }
  }, [restaurantId, order.id, onChanged]);

  const handleApprove = useCallback(() => {
    const message = `${order.poNumber}${supplier ? ` — Supplier: ${supplier.name}` : ""}\n\nYou can still receive goods afterward.`;
    // ✅ Alert.alert() doesn't reliably render on react-native-web
    // (it silently no-ops in some setups) — window.confirm() is the
    // web-native equivalent and always works in a browser.
    if (Platform.OS === "web") {
      if (window.confirm(`Approve Purchase Order?\n\n${message}`)) {
        doApprove();
      }
      return;
    }
    Alert.alert(
      "Approve Purchase Order?",
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Approve", onPress: doApprove },
      ]
    );
  }, [order.poNumber, supplier, doApprove]);

  const handleCancel = useCallback(() => {
    const message = `This will cancel ${order.poNumber}. This cannot be undone.`;
    if (Platform.OS === "web") {
      if (window.confirm(`Cancel Purchase Order?\n\n${message}`)) {
        doCancel();
      }
      return;
    }
    Alert.alert(
      "Cancel Purchase Order?",
      message,
      [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: doCancel },
      ]
    );
  }, [order.poNumber, doCancel]);

  if (showReceiveForm) {
    return (
      <ReceiveGoodsForm
        order={order}
        onDone={() => { setShowReceiveForm(false); onChanged(); }}
        onCancel={() => setShowReceiveForm(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>{order.poNumber}</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <MaterialIcons name={statusStyle.icon} size={13} color="#fff" />
          <Text style={styles.statusBadgeText}>{order.status}</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Supplier</Text>
          <Text style={styles.infoValue}>{supplier?.name ?? "Unknown supplier"}</Text>
        </View>
        {order.expectedDeliveryDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expected Delivery</Text>
            <Text style={styles.infoValue}>{order.expectedDeliveryDate}</Text>
          </View>
        )}
        {order.receivedDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Received</Text>
            <Text style={styles.infoValue}>{order.receivedDate}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Items ({order.items.length})</Text>
      {order.items.map((item) => (
        <View key={item.lineId} style={styles.itemRow}>
          <View style={styles.itemTopRow}>
            <Text style={styles.itemName}>{item.itemName}</Text>
            <Text style={styles.itemLineTotal}>{fmt(item.lineTotal)}</Text>
          </View>
          <Text style={styles.itemDetail}>
            {item.quantity} {item.unit} × {fmt(item.unitCost)}
          </Text>
          {order.status === "RECEIVED" && item.receivedQty !== undefined && (
            <View style={styles.receivedInfo}>
              <MaterialIcons name="inventory" size={12} color="#059669" />
              <Text style={styles.receivedInfoText}>
                Received: {item.receivedQty} {item.unit}
                {item.lotNumber ? ` · Lot ${item.lotNumber}` : ""}
                {item.expiryDate ? ` · Exp ${item.expiryDate}` : ""}
              </Text>
            </View>
          )}
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{fmt(order.totalAmount)}</Text>
      </View>

      {(order.status === "DRAFT" || order.status === "PENDING") && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.cancelBtn, busy && { opacity: 0.6 }]}
            onPress={handleCancel}
            disabled={busy}
          >
            <Text style={styles.cancelBtnText}>Cancel PO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={handleApprove}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>{busy ? "Approving..." : "Approve"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {order.status === "APPROVED" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.cancelBtn, busy && { opacity: 0.6 }]}
            onPress={handleCancel}
            disabled={busy}
          >
            <Text style={styles.cancelBtnText}>Cancel PO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setShowReceiveForm(true)}
          >
            <MaterialIcons name="local-shipping" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Receive Goods</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingTop: Platform.OS === "web" ? 20 : 40, marginBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 8, marginBottom: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "600", flex: 1 },
  badgeRow: { flexDirection: "row", marginBottom: 12 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  statusBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  infoBox: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  infoValue: { fontSize: 13, color: "#1e293b", fontWeight: "700" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
  itemRow: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  itemTopRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  itemLineTotal: { fontSize: 14, fontWeight: "800", color: "#059669" },
  itemDetail: { fontSize: 12, color: "#64748b", marginTop: 4 },
  receivedInfo: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6,
  },
  receivedInfoText: { fontSize: 11, color: "#059669", fontWeight: "600" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: "#0369a1",
  },
  totalLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#fff" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 40 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: "#dc2626", alignItems: "center",
  },
  cancelBtnText: { color: "#dc2626", fontWeight: "700" },
  primaryBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    paddingVertical: 12, borderRadius: 8,
    backgroundColor: "#0369a1",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
});