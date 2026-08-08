// ============================================
// SERVORA ERP — InventoryToolbar Component
// ✅ EVOLUTIONARY EXTRACTION — this is the exact header + "Add
//    Item" button + "Seed Defaults" banner JSX that previously
//    lived inline inside InventoryScreen.tsx's render body.
// ✅ Pure presentation — no state, no Firestore calls. All data
//    (permission flag, seeding state, category count) and handlers
//    are passed in as props from InventoryScreen.tsx.
// ✅ Seed banner visibility logic (`shouldShowSeedBanner`) computed
//    by the parent screen.
// ✅ Prop names are specific rather than generic —
//    shouldShowSeedBanner / onSeedStoreDefaults, anticipating other
//    future "seed X defaults" flows.
// ✅ header's paddingBottom reduced from the implicit 16 (via
//    padding: 16 shorthand) to 4 — tightens the gap to InventoryStats.
// ✅ NEW — "Batch Report" button added alongside "Add Item", both
//    inside a headerActions row (right side of the header). Opens
//    InventoryBatchReport (the category-grouped, restaurant-wide
//    batch view) — this button itself owns no modal state; it only
//    reports the tap via onOpenBatchReport, exactly mirroring how
//    onAddItem already works. The actual visible/onClose state for
//    the report modal is owned by InventoryScreen.tsx, consistent
//    with every other modal in this module.
// ✅ Batch Report is visible to any user who can view Inventory
//    (not gated behind canEditInventory like Add Item) since it's a
//    read-only report — viewing batch history doesn't require edit
//    permission.
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface InventoryToolbarProps {
  canEditInventory:       boolean;
  onAddItem:              () => void;
  onOpenBatchReport:      () => void;
  shouldShowSeedBanner:   boolean;
  seeding:                boolean;
  onSeedStoreDefaults:    () => void;
}

export function InventoryToolbar({
  canEditInventory, onAddItem, onOpenBatchReport, shouldShowSeedBanner, seeding, onSeedStoreDefaults,
}: InventoryToolbarProps) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.headerActions}>
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

      {/* ✅ Seed Defaults — only when no categories exist yet */}
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