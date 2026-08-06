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
// ✅ FIX — header's paddingBottom reduced from the implicit 16
//    (via padding: 16 shorthand) to 4. Combined with InventoryStats'
//    own marginTop, the original spacing stacked to ~26px of empty
//    vertical gap between "Inventory" and the stats row — this
//    tightens it to a normal ~14px section gap without touching any
//    other side's padding.
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface InventoryToolbarProps {
  canEditInventory:       boolean;
  onAddItem:              () => void;
  shouldShowSeedBanner:   boolean;
  seeding:                boolean;
  onSeedStoreDefaults:    () => void;
}

export function InventoryToolbar({
  canEditInventory, onAddItem, shouldShowSeedBanner, seeding, onSeedStoreDefaults,
}: InventoryToolbarProps) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        {canEditInventory && (
          <TouchableOpacity style={styles.addBtn} onPress={onAddItem}>
            <MaterialIcons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
        )}
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