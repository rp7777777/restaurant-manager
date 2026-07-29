// ============================================
// SERVORA ERP — StoreCard Component
// ✅ Displays the hybrid Store Summary (incremental + on-demand
//    counts) from useStoreSummary() — Low Stock, Pending Kitchen
//    Requests, Approved Purchase Orders, Expiring Soon, Expired,
//    Stock Value.
// ✅ EACH row can now navigate independently (onLowStockPress,
//    onExpiringSoonPress, onExpiredPress) — previously the whole
//    card had one onPress that always went to /store-module
//    regardless of which row was tapped. All three per-row props
//    are optional; the whole-card onPress remains as a fallback for
//    the header/chevron tap area and rows without their own
//    handler, so existing callers that only pass onPress keep
//    working unchanged.
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
  onPress?:  () => void;               // fallback — whole-card tap / header
  onLowStockPress?:     () => void;    // "Low Stock" row
  onExpiringSoonPress?: () => void;    // "Expiring Soon" row
  onExpiredPress?:      () => void;    // "Expired" row
}

interface StatusRowProps {
  icon:     keyof typeof MaterialIcons.glyphMap;
  color:    string;
  label:    string;
  value:    number;
  onPress?: () => void;
}

const StatusRow = memo(function StatusRow({ icon, color, label, value, onPress }: StatusRowProps) {
  const RowWrapper = onPress ? TouchableOpacity : View;
  return (
    <RowWrapper
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <MaterialIcons name={icon} size={16} color={color} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, value > 0 && { color }]}>{value}</Text>
        {onPress && (
          <MaterialIcons name="chevron-right" size={14} color="rgba(255,255,255,0.35)" />
        )}
      </View>
    </RowWrapper>
  );
});

function StoreCard({
  data, loading, fmt, onPress,
  onLowStockPress, onExpiringSoonPress, onExpiredPress,
}: StoreCardProps) {
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
            onPress={onLowStockPress}
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
            onPress={onExpiringSoonPress}
          />
          <StatusRow
            icon="dangerous"
            color="#dc2626"
            label="Expired"
            value={data.expired}
            onPress={onExpiredPress}
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
 cardTouchable: { flex: 1, marginBottom: 14 },
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
  rowRight: { flexDirection: "row", alignItems: "center", gap: 2 },
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