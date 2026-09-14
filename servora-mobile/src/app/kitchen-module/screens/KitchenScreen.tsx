// ============================================
// SERVORA ERP — KitchenScreen
// ✅ Thin top-level controller — header, Pending/Approved/Total
//    stats, and composes NewRequestScreen / RequestHistoryScreen.
// ✅ NEW — categories fetched via useCategoriesForPicker (same hook
//    used throughout Inventory/Store), passed down to
//    RequestHistoryScreen for KitchenHistoryTable's category
//    grouping.
// ✅ NEW — stat cards (Pending/Approved/Total) are now clickable,
//    filtering RequestHistoryScreen's table by status
//    (statusFilter). "Approved" card maps to status === "APPROVED"
//    only (NOT "APPROVED" || "ISSUED" — the card's own COUNT still
//    combines both, matching the existing approvedCount semantics,
//    but the FILTER is precise to APPROVED alone so clicking it
//    doesn't silently also show ISSUED rows under an "Approved"
//    label). Clicking the already-active card again clears the
//    filter (toggle to null, showing all statuses for that date).
// ✅ NEW — category filter dropdown (same button+list pattern as
//    MonthlyReportScreen.tsx/Store's daily dropdown — normal
//    document flow, not absolutely positioned, so it pushes content
//    down rather than overlaying).
// ✅ restaurantId now passed to RequestHistoryScreen (needed there
//    for the batch allocation fetch).
// FROZEN
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
import { useCategoriesForPicker } from "../../../modules/inventory-module/hooks/useCategoriesForPicker";
import { IngredientRequest } from "../types/kitchen-types";
import NewRequestScreen from "./NewRequestScreen";
import RequestHistoryScreen from "./RequestHistoryScreen";

type StatusFilter = IngredientRequest["status"] | null;

export default function KitchenScreen() {
  const { theme, restaurantId } = useApp();
  const { requests, loading } = useKitchenRequests(restaurantId);
  const { categories } = useCategoriesForPicker(restaurantId);

  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED" || r.status === "ISSUED").length;

  const selectedCategoryName = categoryFilter
    ? categories.find((c) => c.id === categoryFilter)?.name ?? "All Categories"
    : "All Categories";

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
        {/* Stats — now clickable */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[
              styles.statCard, { backgroundColor: theme.card },
              statusFilter === "PENDING" && styles.statCardActive,
            ]}
            onPress={() => setStatusFilter((s) => s === "PENDING" ? null : "PENDING")}
          >
            <MaterialIcons name="schedule" size={22} color="#f59e0b" />
            <Text style={[styles.statValue, { color: "#f59e0b" }]}>{pendingCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.statCard, { backgroundColor: theme.card },
              statusFilter === "APPROVED" && styles.statCardActive,
            ]}
            onPress={() => setStatusFilter((s) => s === "APPROVED" ? null : "APPROVED")}
          >
            <MaterialIcons name="done-all" size={22} color="#10b981" />
            <Text style={[styles.statValue, { color: "#10b981" }]}>{approvedCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Approved</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.statCard, { backgroundColor: theme.card },
              statusFilter === null && styles.statCardActive,
            ]}
            onPress={() => setStatusFilter(null)}
          >
            <MaterialIcons name="list-alt" size={22} color="#3b82f6" />
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>{requests.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
          </TouchableOpacity>
        </View>

        {/* Category filter dropdown */}
        {categories.length > 0 && (
          <View style={styles.categoryDropdownWrap}>
            <TouchableOpacity style={styles.categoryDropdownButton} onPress={() => setShowCategoryDropdown((v) => !v)}>
              <Text style={styles.categoryDropdownButtonText}>{selectedCategoryName}</Text>
              <MaterialIcons name={showCategoryDropdown ? "expand-less" : "expand-more"} size={20} color="#059669" />
            </TouchableOpacity>
            {showCategoryDropdown && (
              <ScrollView style={styles.categoryDropdownList} nestedScrollEnabled>
                <TouchableOpacity style={styles.categoryDropdownItem} onPress={() => { setCategoryFilter(null); setShowCategoryDropdown(false); }}>
                  <Text style={styles.categoryDropdownItemText}>All Categories</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity key={cat.id} style={styles.categoryDropdownItem} onPress={() => { setCategoryFilter(cat.id); setShowCategoryDropdown(false); }}>
                    <Text style={styles.categoryDropdownItemText}>{cat.icon} {cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* New Request Form — shown/hidden via the header toggle */}
        {showForm && (
          <NewRequestScreen
            restaurantId={restaurantId}
            theme={theme}
            onSent={() => setShowForm(false)}
          />
        )}

        {/* Request History */}
        <RequestHistoryScreen
          requests={requests}
          loading={loading}
          theme={theme}
          restaurantId={restaurantId}
          categories={categories}
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
        />
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
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4, borderWidth: 2, borderColor: "transparent" },
  statCardActive: { borderColor: "#3b82f6" },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600" },
  categoryDropdownWrap: { width: 220, marginBottom: 14 },
  categoryDropdownButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1.5, borderColor: "#059669", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff",
  },
  categoryDropdownButtonText: { fontSize: 13, color: "#1e293b", fontWeight: "600" },
  categoryDropdownList: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 220, backgroundColor: "#ffffff", width: 220,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  categoryDropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  categoryDropdownItemText: { fontSize: 13, color: "#1e293b" },
});