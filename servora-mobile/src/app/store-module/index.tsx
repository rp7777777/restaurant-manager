// ============================================
// SERVORA ERP — Store Module (Kitchen Request Management)
// ✅ FINAL ORCHESTRATOR — subscription/state wiring (via
//    useStoreRequests), status-based routing decisions (which modal
//    opens on row tap), and calls to kitchen-request-service.ts's
//    workflow functions. All presentation lives in components/; all
//    business logic lives in kitchen-module/services/
//    kitchen-request-service.ts.
// ✅ Row-tap routing (via KitchenRequestTable's generic onRowPress):
//      PENDING  → PendingActionModal (Approve/Reject/Cancel)
//      APPROVED → IssueKitchenRequestModal (FEFO issue flow)
//      ISSUED   → RequestDetailModal (read-only)
//      REJECTED → RequestDetailModal (read-only)
// ✅ Single-date model (StoreDateNavigator) — no tab system.
// ✅ Stats (StoreStats) reflect the CURRENTLY-VIEWED DATE only, with
//    an "All" card and click-to-filter (StoreStatusFilter).
// ✅ batchAllocationsByRequestId (from useStoreRequests) passed
//    through to KitchenRequestTable for the Lot/Batch No. column.
// ✅ categories fetched via useCategoriesForPicker, passed to
//    KitchenRequestTable for category-wise grouping.
// ✅ FIX — Monthly Report overlay moved OUTSIDE the main ScrollView
//    (now a sibling inside a top-level Fragment, not nested inside
//    it). Previously, StyleSheet.absoluteFill was applied to a View
//    nested INSIDE the ScrollView — absoluteFill only fills its
//    nearest positioned ancestor, and a ScrollView's content area is
//    sized to its CONTENT height, not the full viewport, so the
//    overlay was clipped to however tall the Store screen's content
//    happened to be, leaving old Store content visible below it.
//    Moving the overlay to be a sibling of the ScrollView (both
//    direct children of the top-level Fragment) lets absoluteFill
//    correctly fill the actual screen viewport.
// FROZEN
// ============================================

import React, { useState, useMemo } from "react";
import {
  ScrollView, StyleSheet, ActivityIndicator, Text, View,
  RefreshControl, Platform, Alert, TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../context/AppContext";
import { auth } from "../../firebase";
import {
  approveKitchenRequest, rejectKitchenRequest, issueKitchenRequest,
} from "../kitchen-module/services/kitchen-request-service";
import { IngredientRequest } from "../kitchen-module/types/kitchen-types";
import { useInventory } from "../../modules/inventory-module/hooks/useInventory";
import { useCategoriesForPicker } from "../../modules/inventory-module/hooks/useCategoriesForPicker";
import { useStoreRequests } from "./hooks/useStoreRequests";
import { StoreHeader } from "./components/StoreHeader";
import { StoreStats, StoreStatusFilter } from "./components/StoreStats";
import { StoreDateNavigator } from "./components/StoreDateNavigator";
import { KitchenRequestTable } from "./components/KitchenRequestTable";
import { PendingActionModal } from "./components/PendingActionModal";
import { IssueKitchenRequestModal } from "./components/IssueKitchenRequestModal";
import { RequestDetailModal } from "./components/RequestDetailModal";
import { MonthlyReportScreen } from "./components/MonthlyReportScreen";
import { shiftDate } from "./utils/store-formatters";

export default function StoreScreen() {
  const { theme, restaurantId, userProfile } = useApp();
  const { items: inventoryItems } = useInventory(restaurantId);
  const { categories } = useCategoriesForPicker(restaurantId);

  const {
    requests, displayRequests, loading, refreshing, onRefresh,
    today, selectedDate, setSelectedDate, batchAllocationsByRequestId,
  } = useStoreRequests(restaurantId);

  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StoreStatusFilter>(null);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);

  const [pendingTarget, setPendingTarget] = useState<IngredientRequest | null>(null);
  const [issueTarget, setIssueTarget] = useState<IngredientRequest | null>(null);
  const [detailTarget, setDetailTarget] = useState<IngredientRequest | null>(null);

  const actorName = userProfile?.name?.trim() || auth.currentUser?.email || "Store";

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleRowPress = (req: IngredientRequest) => {
    if (req.status === "PENDING") setPendingTarget(req);
    else if (req.status === "APPROVED") setIssueTarget(req);
    else setDetailTarget(req);
  };

  const handleApprove = async () => {
    if (!pendingTarget || !restaurantId) return;
    setProcessing(true);
    try {
      await approveKitchenRequest(restaurantId, pendingTarget.id, actorName);
      setPendingTarget(null);
      showAlert("✅ Approved", `${pendingTarget.itemName} request approved`);
    } catch (err: any) {
      showAlert("Error", err?.message ?? "Failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!pendingTarget || !restaurantId) return;
    setProcessing(true);
    try {
      await rejectKitchenRequest(restaurantId, pendingTarget.id, actorName);
      setPendingTarget(null);
    } catch (err: any) {
      showAlert("Error", err?.message ?? "Failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleIssueConfirm = async (params: { quantity: number; inventoryId: string; note: string }) => {
    if (!issueTarget || !restaurantId) return;
    setProcessing(true);
    try {
      await issueKitchenRequest({
        restaurantId,
        requestId: issueTarget.id,
        inventoryId: params.inventoryId,
        quantity: params.quantity,
        issuerName: actorName,
        issueNote: params.note || undefined,
      });
      const msg = `${params.quantity} ${issueTarget.unit} of ${issueTarget.itemName} issued!\nInventory auto-updated via FEFO.`;
      setIssueTarget(null);
      showAlert("✅ Issued", msg);
    } catch (err: any) {
      showAlert("Error", err?.message ?? "Failed to issue");
    } finally {
      setProcessing(false);
    }
  };

  const totalCount    = displayRequests.length;
  const pendingCount  = displayRequests.filter((r) => r.status === "PENDING").length;
  const approvedCount = displayRequests.filter((r) => r.status === "APPROVED").length;
  const issuedCount   = displayRequests.filter((r) => r.status === "ISSUED").length;
  const rejectedCount = displayRequests.filter((r) => r.status === "REJECTED").length;

  const filteredDisplayRequests = useMemo(() => {
    if (!statusFilter) return displayRequests;
    return displayRequests.filter((r) => r.status === statusFilter);
  }, [displayRequests, statusFilter]);

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.bg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        <StoreHeader pendingCount={pendingCount} />

        <TouchableOpacity style={styles.monthlyReportBtn} onPress={() => setShowMonthlyReport(true)}>
          <MaterialIcons name="bar-chart" size={16} color="#0369a1" />
          <Text style={styles.monthlyReportBtnText}>Monthly Report</Text>
        </TouchableOpacity>

        <View style={styles.body}>
          <StoreStats
            totalCount={totalCount}
            pendingCount={pendingCount}
            approvedCount={approvedCount}
            issuedCount={issuedCount}
            rejectedCount={rejectedCount}
            cardBg={theme.card}
            textSecondary={theme.textSecondary}
            activeStatus={statusFilter}
            onStatusPress={setStatusFilter}
          />

          <StoreDateNavigator
            selectedDate={selectedDate}
            today={today}
            textColor={theme.text}
            onPrev={() => setSelectedDate((d) => shiftDate(d, -1))}
            onNext={() => setSelectedDate((d) => shiftDate(d, 1))}
          />

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          ) : filteredDisplayRequests.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
              <MaterialIcons name="inventory" size={40} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No requests for this date
              </Text>
            </View>
          ) : (
            <KitchenRequestTable
              requests={filteredDisplayRequests}
              batchAllocationsByRequestId={batchAllocationsByRequestId}
              categories={categories}
              onRowPress={handleRowPress}
            />
          )}
        </View>

        <PendingActionModal
          visible={!!pendingTarget}
          request={pendingTarget}
          processing={processing}
          theme={theme}
          onApprove={handleApprove}
          onReject={handleReject}
          onCancel={() => setPendingTarget(null)}
        />

        <IssueKitchenRequestModal
          visible={!!issueTarget}
          request={issueTarget}
          inventoryItems={inventoryItems}
          processing={processing}
          theme={theme}
          onClose={() => setIssueTarget(null)}
          onConfirm={handleIssueConfirm}
        />

        <RequestDetailModal
          visible={!!detailTarget}
          request={detailTarget}
          theme={theme}
          onClose={() => setDetailTarget(null)}
        />
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
  body: { padding: 12 },
  emptyBox: { alignItems: "center", padding: 40, borderRadius: 10, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: "600" },
  monthlyReportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: "#0369a1", backgroundColor: "#eff6ff",
  },
  monthlyReportBtnText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
});