// ============================================
// SERVORA ERP — KitchenScreen
// ✅ Thin top-level controller — header, stats, date navigation, and
//    composes NewRequestScreen / RequestHistoryScreen.
// ✅ Stat cards match Store's own StoreStats pattern exactly:
//    compact horizontal row (icon+value+label), height 30px,
//    Total/Pending/Approved/Issued/Rejected, day-scoped
//    (selectedDate, not restaurant-wide totals).
// ✅ selectedDate/day-navigation (useRequestHistory) owned HERE
//    (lifted up from RequestHistoryScreen) so stat cards and the
//    table share the same date state. Date navigator shows ONLY
//    "Today" for the current date, or ONLY the formatted date for
//    other days (not both together).
// ✅ NEW — Monthly Report REUSES store-module's own
//    MonthlyReportScreen component wholesale (same summary cards,
//    category dropdown, live date range, batch-level rows, item/
//    request-level totals) — no new component built. Kitchen and
//    Store both report on the exact same underlying `requests`
//    (IngredientRequest) collection, just from their own screen's
//    entry point. Overlay is a sibling of the ScrollView (Fragment
//    wrapper), NOT nested inside it — matching Store's own fix for
//    the overlay-height-clipped-by-parent-ScrollView issue.
// ✅ Stat cards + category dropdown + Monthly Report button all
//    hidden while the New Request form is open.
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
import { useRequestHistory } from "../hooks/useRequestHistory";
import { useCategoriesForPicker } from "../../../modules/inventory-module/hooks/useCategoriesForPicker";
import { IngredientRequest } from "../types/kitchen-types";
import { formatSelectedDate } from "../utils/kitchen-format";
import { MonthlyReportScreen } from "../../store-module/components/MonthlyReportScreen";
import NewRequestScreen from "./NewRequestScreen";
import RequestHistoryScreen from "./RequestHistoryScreen";

type StatusFilter = IngredientRequest["status"] | null;

export default function KitchenScreen() {
  const { theme, restaurantId } = useApp();
  const { requests, loading } = useKitchenRequests(restaurantId);
  const { categories } = useCategoriesForPicker(restaurantId);
  const { selectedDate, historyRequests, goToPrevDay, goToNextDay, isToday } = useRequestHistory(requests);

  const [showForm, setShowForm] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const totalCount    = historyRequests.length;
  const pendingCount  = historyRequests.filter((r) => r.status === "PENDING").length;
  const approvedCount = historyRequests.filter((r) => r.status === "APPROVED").length;
  const issuedCount   = historyRequests.filter((r) => r.status === "ISSUED").length;
  const rejectedCount = historyRequests.filter((r) => r.status === "REJECTED").length;

  const selectedCategoryName = categoryFilter
    ? categories.find((c) => c.id === categoryFilter)?.name ?? "All Categories"
    : "All Categories";

  return (
    <>
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

        {!showForm && (
          <TouchableOpacity style={styles.monthlyReportBtn} onPress={() => setShowMonthlyReport(true)}>
            <MaterialIcons name="bar-chart" size={16} color="#0369a1" />
            <Text style={styles.monthlyReportBtnText}>Monthly Report</Text>
          </TouchableOpacity>
        )}

        <View style={styles.body}>
          {!showForm && (
            <>
              {/* Date Navigator */}
              <View style={[styles.dateNav, { backgroundColor: theme.card }]}>
                <TouchableOpacity onPress={goToPrevDay} style={styles.dateNavArrow}>
                  <MaterialIcons name="chevron-left" size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.dateNavLabel, { color: theme.text }]}>
                  {isToday ? "Today" : formatSelectedDate(selectedDate)}
                </Text>
                <TouchableOpacity onPress={goToNextDay} style={styles.dateNavArrow}>
                  <MaterialIcons name="chevron-right" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Stat cards — compact, matching StoreStats.tsx exactly */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
                <TouchableOpacity
                  style={[styles.statCard, { backgroundColor: theme.card }, statusFilter === null && { borderColor: "#64748b", borderWidth: 2 }]}
                  onPress={() => setStatusFilter(null)}
                >
                  <MaterialIcons name="list-alt" size={13} color="#64748b" />
                  <Text style={[styles.statValue, { color: "#64748b" }]}>{totalCount}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statCard, { backgroundColor: theme.card }, statusFilter === "PENDING" && { borderColor: "#f59e0b", borderWidth: 2 }]}
                  onPress={() => setStatusFilter((s) => s === "PENDING" ? null : "PENDING")}
                >
                  <MaterialIcons name="schedule" size={13} color="#f59e0b" />
                  <Text style={[styles.statValue, { color: "#f59e0b" }]}>{pendingCount}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statCard, { backgroundColor: theme.card }, statusFilter === "APPROVED" && { borderColor: "#3b82f6", borderWidth: 2 }]}
                  onPress={() => setStatusFilter((s) => s === "APPROVED" ? null : "APPROVED")}
                >
                  <MaterialIcons name="check-circle" size={13} color="#3b82f6" />
                  <Text style={[styles.statValue, { color: "#3b82f6" }]}>{approvedCount}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Approved</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statCard, { backgroundColor: theme.card }, statusFilter === "ISSUED" && { borderColor: "#10b981", borderWidth: 2 }]}
                  onPress={() => setStatusFilter((s) => s === "ISSUED" ? null : "ISSUED")}
                >
                  <MaterialIcons name="done-all" size={13} color="#10b981" />
                  <Text style={[styles.statValue, { color: "#10b981" }]}>{issuedCount}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Issued</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statCard, { backgroundColor: theme.card }, statusFilter === "REJECTED" && { borderColor: "#ef4444", borderWidth: 2 }]}
                  onPress={() => setStatusFilter((s) => s === "REJECTED" ? null : "REJECTED")}
                >
                  <MaterialIcons name="cancel" size={13} color="#ef4444" />
                  <Text style={[styles.statValue, { color: "#ef4444" }]}>{rejectedCount}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Rejected</Text>
                </TouchableOpacity>
              </ScrollView>

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
            </>
          )}

          {/* New Request Form */}
          {showForm && (
            <NewRequestScreen
              restaurantId={restaurantId}
              theme={theme}
              onSent={() => setShowForm(false)}
            />
          )}

          {/* Request History */}
          <RequestHistoryScreen
            historyRequests={historyRequests}
            selectedDate={selectedDate}
            loading={loading}
            theme={theme}
            restaurantId={restaurantId}
            categories={categories}
            statusFilter={statusFilter}
            categoryFilter={categoryFilter}
          />
        </View>
      </ScrollView>

      {showMonthlyReport && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
          <MonthlyReportScreen
            requests={requests}
            categories={categories}
            onClose={() => setShowMonthlyReport(false)}
          />
        </View>
      )}
    </>
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
  monthlyReportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    marginHorizontal: 14, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: "#0369a1", backgroundColor: "#eff6ff",
  },
  monthlyReportBtnText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
  body: { padding: 14 },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 10, paddingVertical: 8, marginBottom: 10,
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 13, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 10 },
  statCard: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 30,
    borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 9,
  },
  statValue: { fontSize: 12, fontWeight: "800" },
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