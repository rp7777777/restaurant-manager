// ============================================
// SERVORA ERP — InventoryToolbar Component
// ✅ EVOLUTIONARY EXTRACTION — this is the exact header + "Add
//    Item" button + "Seed Defaults" banner JSX that previously
//    lived inline inside InventoryScreen.tsx's render body.
// ✅ Pure presentation — no state, no Firestore calls.
// ✅ Prop names are specific rather than generic —
//    shouldShowSeedBanner / onSeedStoreDefaults.
// ✅ header's paddingBottom tightened.
// ✅ "Batch Report" button alongside "Add Item" — opens
//    InventoryBatchReport.
// ✅ NEW — "Archived" button added, opening ArchivedItemsModal.
//    Visible to any user who can view Inventory (not gated behind
//    canEditInventory) since it's primarily a viewing action —
//    Restore itself (inside the modal) is where any permission
//    check would matter, matching how Batch Report is similarly
//    ungated here.
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface InventoryToolbarProps {
  canEditInventory:       boolean;
  onAddItem:              () => void;
  onOpenBatchReport:      () => void;
  onOpenArchivedItems:    () => void;
  shouldShowSeedBanner:   boolean;
  seeding:                boolean;
  onSeedStoreDefaults:    () => void;
}

export function InventoryToolbar({
  canEditInventory, onAddItem, onOpenBatchReport, onOpenArchivedItems,
  shouldShowSeedBanner, seeding, onSeedStoreDefaults,
}: InventoryToolbarProps) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.archivedBtn} onPress={onOpenArchivedItems}>
            <MaterialIcons name="archive" size={16} color="#64748b" />
            <Text style={styles.archivedBtnText}>Archived</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchReportBtn} onPress={onOpenBatchReport}>
            <MaterialIcons name="receipt-long" size={16} color="#0369a1" />
            <Text style={styles.batchReportBtnText}>Batch Report</Text>
          </TouchableOpacity>
          {canEditInventory && (
            <TouchableOpacity style={styles.addBtn} onPress={onAddItem}>
              <MaterialIcons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {shouldShowSeedBanner && (
        <TouchableOpacity
          style={[styles.seedBanner, seeding && { opacity: 0.7 }]}
          onPress={onSeedStoreDefaults}
          disabled={seeding}
        >
          {seeding
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialIcons name="auto-awesome" size={16} color="#fff" />
          }
          <Text style={styles.seedBannerText}>
            {seeding ? "Setting up..." : "No categories yet — Tap to set up default categories"}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "web" ? 20 : 48,
    paddingBottom: 4,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  archivedBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  archivedBtnText: { color: "#64748b", fontWeight: "700", fontSize: 13 },
  batchReportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#e0f2fe", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  batchReportBtnText: { color: "#0369a1", fontWeight: "700", fontSize: 13 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0369a1", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  seedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    backgroundColor: "#7c3aed", marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 10, borderRadius: 10,
  },
  seedBannerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});