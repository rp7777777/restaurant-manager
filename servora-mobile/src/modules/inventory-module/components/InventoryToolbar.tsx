// ============================================
// SERVORA ERP — InventoryToolbar Component
// ✅ EVOLUTIONARY EXTRACTION — header + "Add Item" button + "Seed
//    Defaults" banner, originally inline in InventoryScreen.tsx.
// ✅ Pure presentation — no state, no Firestore calls.
// ✅ "Batch Report" and "Archived" buttons alongside "Add Item".
// ✅ "Movement History" button, opening MovementHistoryModal.
// ✅ FIX — "History" button now has its own distinct highlight color
//    (indigo, #4f46e5) instead of the same plain grey as "Archived"
//    — previously the two buttons were visually indistinguishable
//    at a glance, making it harder to spot History quickly. The
//    indigo tint ties it visually to MovementHistoryModal's own
//    "history" iconography without needing to touch that FROZEN
//    file.
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface InventoryToolbarProps {
  canEditInventory:         boolean;
  onAddItem:                () => void;
  onOpenBatchReport:        () => void;
  onOpenArchivedItems:      () => void;
  onOpenMovementHistory:    () => void;
  shouldShowSeedBanner:     boolean;
  seeding:                  boolean;
  onSeedStoreDefaults:      () => void;
}

export function InventoryToolbar({
  canEditInventory, onAddItem, onOpenBatchReport, onOpenArchivedItems, onOpenMovementHistory,
  shouldShowSeedBanner, seeding, onSeedStoreDefaults,
}: InventoryToolbarProps) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.historyBtn} onPress={onOpenMovementHistory}>
          <MaterialIcons name="history" size={16} color="#4f46e5" />
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenArchivedItems}>
          <MaterialIcons name="archive" size={16} color="#64748b" />
          <Text style={styles.secondaryBtnText}>Archived</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenBatchReport}>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "web" ? 20 : 48,
    paddingBottom: 4,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  actionRow: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingTop: 8,
  },
  historyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#eef2ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: "#c7d2fe",
  },
  historyBtnText: { color: "#4f46e5", fontWeight: "700", fontSize: 13 },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  secondaryBtnText: { color: "#64748b", fontWeight: "700", fontSize: 13 },
  batchReportBtnText: { color: "#0369a1", fontWeight: "700", fontSize: 13 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0369a1", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    marginLeft: "auto",
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  seedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    backgroundColor: "#7c3aed", marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 10, borderRadius: 10,
  },
  seedBannerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});