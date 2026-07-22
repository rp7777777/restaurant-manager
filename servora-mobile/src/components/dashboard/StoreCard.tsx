// ============================================
// SERVORA ERP — StoreCard Component
// ✅ Displays the hybrid Store Summary (incremental + on-demand
//    counts) from useStoreSummary() — Low Stock, Pending Kitchen
//    Requests, Approved Purchase Orders, Expiring Soon, Expired,
//    Stock Value.
// ✅ Tapping the card navigates to the Store module.
// ✅ Pure presentation — no Firestore/business logic here (the hook
//    owns that).
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, StyleSheet,
  Platform, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons }  from "@expo/vector-icons";
import { StoreSummaryData } from "../../modules/store-module/hooks/useStoreSummary";

const isWeb = Platform.OS === "web";

interface StoreCardProps {
  data:      StoreSummaryData;
  loading:   boolean;
  fmt:       (n: number) => string;
  onPress?:  () => void;
}

interface StatusRowProps {
  icon:  keyof typeof MaterialIcons.glyphMap;
  color: string;
  label: string;
  value: number;
}

const StatusRow = memo(function StatusRow({ icon, color, label, value }: StatusRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <MaterialIcons name={icon} size={16} color={color} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, value > 0 && { color }]}>{value}</Text>
    </View>
  );
});

function StoreCard({ data, loading, fmt, onPress }: StoreCardProps) {
  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={styles.cardTouchable}
    >
      <LinearGradient colors={["#0f172a", "#1e293b"]} style={styles.card}>
        <View style={styles.cardTop}>
          <MaterialIcons name="inventory-2" size={22} color="#FFD700" />
          <Text style={styles.cardTitle}>Store Status</Text>
          {loading && <ActivityIndicator size="small" color="#FFD700" />}
          {onPress && (
            <MaterialIcons
              name="chevron-right"
              size={20}
              color="rgba(255,255,255,0.5)"
              style={styles.chevron}
            />
          )}
        </View>

        <View style={styles.rowsContainer}>
          <StatusRow
            icon="warning"
            color="#ef4444"
            label="Low Stock"
            value={data.lowStockCount}
          />
          <StatusRow
            icon="restaurant"
            color="#f59e0b"
            label="Pending Requests"
            value={data.pendingKitchenRequests}
          />
          <StatusRow
            icon="local-shipping"
            color="#22c55e"
            label="Approved PO"
            value={data.approvedPurchaseOrders}
          />
          <StatusRow
            icon="schedule"
            color="#fb923c"
            label="Expiring Soon"
            value={data.expiringSoon}
          />
          <StatusRow
            icon="dangerous"
            color="#dc2626"
            label="Expired"
            value={data.expired}
          />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Stock Value</Text>
          <Text style={styles.footerValue}>{fmt(data.totalStockValue)}</Text>
        </View>
      </LinearGradient>
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  cardTouchable: { marginBottom: 14 },
  card: {
    borderRadius: 16,
    padding:      14,
    gap:          6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  cardTitle: {
    color: "#fff", fontSize: 13,
    fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5,
  },
  chevron: { marginLeft: "auto" },
  rowsContainer: { gap: 6, marginTop: 6 },
  row: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    backgroundColor:   "rgba(255,255,255,0.06)",
    borderRadius:      8,
    paddingHorizontal: 10,
    paddingVertical:   7,
  },
  rowLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  rowValue: { color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "800" },
  footerRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      6,
    paddingTop:     8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  footerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  footerValue: { color: "#4ade80", fontSize: 15, fontWeight: "900" },
});

export default memo(StoreCard);