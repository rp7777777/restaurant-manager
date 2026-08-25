// ============================================
// SERVORA ERP — SuppliersScreen
// ✅ Real Firestore data via useSuppliers (FROZEN hook).
// ✅ Simple client-side name search.
// ✅ Tapping a card opens the SAME SupplierForm in edit mode.
// ✅ MAJOR FIX — auto-open detection moved from a URL query param
//    (?autoOpen=create, read via useEffect/useFocusEffect) to a
//    Context-level flag (InventoryFormDraftContext's
//    requestAutoOpenSupplierForm/consumeAutoOpenSupplierForm),
//    checked DIRECTLY during this component's render body — not
//    inside any effect. Root cause of the real bug this replaces:
//    on web, Expo Router's mount/focus lifecycle meant neither a
//    mount-only useEffect([]) nor a useFocusEffect reliably observed
//    the query param at the exact moment this screen needed to react
//    to it — sometimes the effect had already run before the param
//    existed, sometimes focus fired before the param was attached,
//    producing a real "first tap does nothing, second tap works"
//    bug. A Context ref read synchronously during render has no such
//    timing dependency: by the time this function body executes,
//    requestAutoOpenSupplierForm() (called by InventoryForm.tsx
//    BEFORE navigating) has unconditionally already run, so the flag
//    is simply present, no race possible.
// ✅ handleSaved receives the optional supplierId from SupplierForm's
//    onSaved signature; records it via markSupplierCreated() before
//    navigating away when this was an auto-opened create.
// ✅ router.replace("/inventory-module") instead of router.back().
// PHASE 8.3
// ============================================

import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useApp } from "../../../context/AppContext";
import { usePermission } from "../../../hooks/usePermission";
import { useSuppliers } from "../hooks/useSuppliers";
import { Supplier } from "../types/supplier";
import SupplierCard from "../../../components/suppliers/SupplierCard";
import SupplierForm from "./SupplierForm";
import { useInventoryFormDraft } from "../../inventory-module/context/InventoryFormDraftContext";

type FormMode =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; supplier: Supplier };

export default function SuppliersScreen() {
  const { restaurantId } = useApp();
  const canEditPurchaseOrders = usePermission("edit_purchase_orders");
  const router = useRouter();
  const { markSupplierCreated, consumeAutoOpenSupplierForm } = useInventoryFormDraft();

  const { suppliers, loading, error } = useSuppliers(restaurantId);
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ FIX — checked ONCE, directly in render body, via lazy useState
  // initializer. This runs synchronously on this component's FIRST
  // render — no effect, no lifecycle timing dependency. If
  // InventoryForm.tsx called requestAutoOpenSupplierForm() before
  // navigating here (which it always does, synchronously, before
  // router.push()), that flag is unconditionally already true by the
  // time this initializer runs.
  const [formState, setFormState] = useState<FormMode>(() => {
    return consumeAutoOpenSupplierForm() ? { mode: "create" } : { mode: "closed" };
  });
  const [formKey, setFormKey] = useState(0);

  const wasAutoOpened = useRef(formState.mode === "create");

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
    wasAutoOpened.current = false;
    setFormKey((k) => k + 1);
    setFormState({ mode: "create" });
  }, []);

  const openEdit = useCallback((supplier: Supplier) => {
    wasAutoOpened.current = false;
    setFormKey((k) => k + 1);
    setFormState({ mode: "edit", supplier });
  }, []);

  const handleSaved = useCallback((supplierId?: string) => {
    const shouldGoBack = wasAutoOpened.current;
    wasAutoOpened.current = false;
    if (shouldGoBack && supplierId) {
      markSupplierCreated(supplierId);
    }
    setFormState({ mode: "closed" });
    if (shouldGoBack) {
      router.replace("/inventory-module");
    }
  }, [router, markSupplierCreated]);

  const closeForm = useCallback(() => {
    wasAutoOpened.current = false;
    setFormState({ mode: "closed" });
  }, []);

  if (formState.mode !== "closed") {
    return (
      <SupplierForm
        key={formKey}
        existing={formState.mode === "edit" ? formState.supplier : undefined}
        onSaved={handleSaved}
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