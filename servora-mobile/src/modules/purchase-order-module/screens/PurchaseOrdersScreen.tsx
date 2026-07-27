// ============================================
// SERVORA ERP — PurchaseOrdersScreen
// ✅ Composition only — hooks provide data, components render.
//    Mirrors InventoryScreen.tsx's structure exactly.
// ✅ Tapping a card opens PurchaseOrderDetailScreen (Phase 8.2c) —
//    replaces the earlier console.log placeholder.
// ✅ Supplier lookup built once (useMemo) — same pattern as
//    InventoryScreen's categoryMap.
// PHASE 8.2c
// ============================================

import React, { useMemo, useCallback, useState, useEffect } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { usePurchaseOrders } from "../hooks/usePurchaseOrders";
import {
  usePurchaseOrderFilters,
  PurchaseOrderStatusFilter,
  PurchaseOrderSortOption,
} from "../hooks/usePurchaseOrderFilters";
import { useSuppliers } from "../../supplier-module/hooks/useSuppliers";
import { PurchaseOrder } from "../types/purchase-order";
import PurchaseOrderCard from "../../../components/purchase-orders/PurchaseOrderCard";
import PurchaseOrderForm from "./PurchaseOrderForm";
import PurchaseOrderDetailScreen from "./PurchaseOrderDetailScreen";

const STATUS_FILTER_OPTIONS: { value: PurchaseOrderStatusFilter; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "DRAFT",     label: "Draft" },
  { value: "PENDING",   label: "Pending" },
  { value: "APPROVED",  label: "Approved" },
  { value: "RECEIVED",  label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SORT_OPTIONS: { value: PurchaseOrderSortOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "date-desc",    label: "Newest",   icon: "schedule" },
  { value: "total-desc",   label: "Total",    icon: "attach-money" },
  { value: "poNumber-asc", label: "PO #",     icon: "sort-by-alpha" },
];

export default function PurchaseOrdersScreen() {
  const { restaurantId, fmt, userProfile } = useApp();
  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  const { orders, loading: ordersLoading, error: ordersError } = usePurchaseOrders(restaurantId);
  const {
    filters, filteredOrders,
    setSearchQuery, setStatus, setSort,
  } = usePurchaseOrderFilters(orders);
  const { suppliers, loading: suppliersLoading } = useSuppliers(restaurantId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  // ✅ Bumped every time the form opens, forcing React to remount
  // PurchaseOrderForm (and therefore reset usePurchaseOrderForm's
  // internal state) — explicit reset-on-open rather than relying
  // on unmount timing, which stays correct even if this later
  // becomes a Modal that doesn't fully unmount between opens.
  const [formKey, setFormKey] = useState(0);

  const supplierMap = useMemo(() => {
    return new Map(suppliers.map((s) => [s.id, s]));
  }, [suppliers]);

  // ✅ Kept as an id (not the whole PurchaseOrder object) — the
  // list's live subscription (usePurchaseOrders) keeps orders[]
  // fresh, so re-deriving the current object from that array on
  // every render means the Detail screen always reflects the
  // latest data (e.g. right after Approve/Receive) without needing
  // its own separate fetch or a manual "refresh" callback.
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const openOrder = useCallback((order: PurchaseOrder) => {
    setSelectedOrderId(order.id);
  }, []);

  const openCreateForm = useCallback(() => {
    setFormKey((k) => k + 1);
    setShowCreateForm(true);
  }, []);

  const loading = ordersLoading || suppliersLoading;

  const selectedOrder = selectedOrderId
    ? orders.find((o) => o.id === selectedOrderId)
    : undefined;

  // ✅ If the selected order vanishes from the live list (e.g.
  // deleted elsewhere) fall back to the list — done in an effect,
  // not directly in the render body, since calling setState while
  // rendering is unsafe in React.
  useEffect(() => {
    if (selectedOrderId && !selectedOrder) {
      setSelectedOrderId(null);
    }
  }, [selectedOrderId, selectedOrder]);

  // ✅ The Create form replaces the whole screen while open (own
  // scroll view, own header) rather than rendering as a modal on
  // top of the list — simpler for Phase 8.2b, matches how
  // InventoryScreen's create/edit currently swaps content in place.
  if (showCreateForm) {
    return (
      <PurchaseOrderForm
        key={formKey}
        onSaved={() => setShowCreateForm(false)}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  if (selectedOrder) {
    return (
      <PurchaseOrderDetailScreen
        order={selectedOrder}
        supplier={supplierMap.get(selectedOrder.supplierId)}
        fmt={fmt}
        onBack={() => setSelectedOrderId(null)}
        onChanged={() => {}}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Purchase Orders</Text>
        {isManager && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreateForm}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>New PO</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={filters.searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search PO number..."
        />
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.filterChip,
              filters.status === opt.value && styles.filterChipActive,
            ]}
            onPress={() => setStatus(opt.value)}
          >
            <Text style={[
              styles.filterChipText,
              filters.status === opt.value && styles.filterChipTextActive,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.sortChip,
              filters.sort === opt.value && styles.sortChipActive,
            ]}
            onPress={() => setSort(opt.value)}
          >
            <MaterialIcons
              name={opt.icon}
              size={13}
              color={filters.sort === opt.value ? "#fff" : "#64748b"}
            />
            <Text style={[
              styles.sortChipText,
              filters.sort === opt.value && styles.sortChipTextActive,
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {ordersError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{ordersError}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0369a1" style={{ marginTop: 40 }} />
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="receipt-long" size={40} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>
            {orders.length === 0 ? "No purchase orders yet" : "No orders match your filters"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          windowSize={7}
          renderItem={({ item }) => (
            <PurchaseOrderCard
              order={item}
              supplier={supplierMap.get(item.supplierId)}
              fmt={fmt}
              onPress={() => openOrder(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0369a1", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10, flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#e2e8f0",
  },
  filterChipActive: { backgroundColor: "#0369a1" },
  filterChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  filterChipTextActive: { color: "#fff" },
  sortRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, marginTop: 10,
  },
  sortLabel: { fontSize: 12, fontWeight: "700", color: "#94a3b8", marginRight: 2 },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  sortChipActive: { backgroundColor: "#0369a1" },
  sortChipText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  sortChipTextActive: { color: "#fff" },
  errorBanner: {
    backgroundColor: "#fef2f2", margin: 16, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  list: { padding: 16 },
});