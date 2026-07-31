// ============================================
// SERVORA ERP — SuppliersScreen
// ✅ Real Firestore data via useSuppliers (FROZEN hook) — replaces
//    the old app/suppliers.tsx implementation, which used a plain
//    local useState<any[]>([]) array with no Firestore connection
//    at all (data was lost on refresh and never reached the PO
//    form's supplier picker, which reads from this same hook).
// ✅ Simple client-side name search — no separate filters hook,
//    since Supplier has far fewer fields/states than Purchase
//    Orders or Inventory to filter by.
// ✅ Tapping a card opens the SAME SupplierForm in edit mode
//    (existing prop set) — Create and Edit share one form/hook.
// PHASE 8.3
// ============================================

import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { usePermission } from "../../../hooks/usePermission";
import { useSuppliers } from "../hooks/useSuppliers";
import { Supplier } from "../types/supplier";
import SupplierCard from "../../../components/suppliers/SupplierCard";
import SupplierForm from "./SupplierForm";

type FormMode =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; supplier: Supplier };

export default function SuppliersScreen() {
  const { restaurantId } = useApp();
  // ✅ RBAC Phase 1 — Suppliers pairs with Purchase Orders
  const canEditPurchaseOrders = usePermission("edit_purchase_orders");

  const { suppliers, loading, error } = useSuppliers(restaurantId);
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState<FormMode>({ mode: "closed" });
  // ✅ Same remount-for-fresh-state trick as PurchaseOrdersScreen —
  // bumped every time the form opens so leftover text from a
  // previous Add/Edit never lingers into the next one.
  const [formKey, setFormKey] = useState(0);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.supplierCode.toLowerCase().includes(q) ||
        (s.companyName?.toLowerCase().includes(q) ?? false)
    );
  }, [suppliers, searchQuery]);

  const openCreate = useCallback(() => {
    setFormKey((k) => k + 1);
    setFormState({ mode: "create" });
  }, []);

  const openEdit = useCallback((supplier: Supplier) => {
    setFormKey((k) => k + 1);
    setFormState({ mode: "edit", supplier });
  }, []);

  const closeForm = useCallback(() => {
    setFormState({ mode: "closed" });
  }, []);

  if (formState.mode !== "closed") {
    return (
      <SupplierForm
        key={formKey}
        existing={formState.mode === "edit" ? formState.supplier : undefined}
        onSaved={closeForm}
        onCancel={closeForm}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Suppliers</Text>
        {canEditPurchaseOrders && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>New Supplier</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search name, code, or company..."
        />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0369a1" style={{ marginTop: 40 }} />
      ) : filteredSuppliers.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="local-shipping" size={40} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>
            {suppliers.length === 0 ? "No suppliers yet" : "No suppliers match your search"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSuppliers}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SupplierCard supplier={item} onPress={() => openEdit(item)} />
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
  errorBanner: {
    backgroundColor: "#fef2f2", margin: 16, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  list: { padding: 16 },
});