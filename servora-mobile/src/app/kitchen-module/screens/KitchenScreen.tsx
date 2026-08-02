// ============================================
// SERVORA ERP — KitchenScreen
// ✅ Thin top-level controller — header, Pending/Approved/Total
//    stats, and composes NewRequestScreen / RequestHistoryScreen.
//    Mirrors how PurchaseOrdersScreen.tsx composes its own pieces
//    (list vs create-form) rather than owning form/history logic
//    itself.
// ✅ Moved from the old kitchen-module/index.tsx's outer JSX —
//    header, stats row, and the showForm toggle behavior.
// ============================================

import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Platform, StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useKitchenRequests } from "../hooks/useKitchenRequests";
import NewRequestScreen from "./NewRequestScreen";
import RequestHistoryScreen from "./RequestHistoryScreen";

export default function KitchenScreen() {
  const { theme, restaurantId } = useApp();
  const { requests, loading } = useKitchenRequests(restaurantId);

  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED" || r.status === "ISSUED").length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>KITCHEN</Text>
            <Text style={styles.headerSub}>Ingredient Request</Text>
          </View>
          <TouchableOpacity
            style={styles.newRequestBtn}
            onPress={() => setShowForm(!showForm)}
          >
            <MaterialIcons name={showForm ? "close" : "add-shopping-cart"} size={20} color="#00154f" />
            <Text style={styles.newRequestBtnText}>
              {showForm ? "Cancel" : "New Request"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="schedule" size={22} color="#f59e0b" />
            <Text style={[styles.statValue, { color: "#f59e0b" }]}>{pendingCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="done-all" size={22} color="#10b981" />
            <Text style={[styles.statValue, { color: "#10b981" }]}>{approvedCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Approved</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="list-alt" size={22} color="#3b82f6" />
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>{requests.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
          </View>
        </View>

        {/* New Request Form — shown/hidden via the header toggle */}
        {showForm && (
          <NewRequestScreen
            restaurantId={restaurantId}
            theme={theme}
            onSent={() => setShowForm(false)}
          />
        )}

        {/* Request History */}
        <RequestHistoryScreen requests={requests} loading={loading} theme={theme} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24, paddingHorizontal: 20,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  newRequestBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFD700", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  newRequestBtnText: { color: "#00154f", fontSize: 12, fontWeight: "800" },
  body: { padding: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600" },
});