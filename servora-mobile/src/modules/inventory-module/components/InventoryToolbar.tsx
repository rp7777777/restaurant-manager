// ============================================
// SERVORA ERP — InventoryToolbar Component
// ✅ EVOLUTIONARY EXTRACTION — this is the exact header + "Add
//    Item" button + "Seed Defaults" banner JSX that previously
//    lived inline inside InventoryScreen.tsx's render body.
//    Behavior/styling unchanged; only the layer moved (matches the
//    Screen → Component pattern used throughout this restructuring).
// ✅ Pure presentation — no state, no Firestore calls. All data
//    (permission flag, seeding state, category count) and handlers
//    are passed in as props from InventoryScreen.tsx, which keeps
//    the existing hooks (usePermission, useCategoriesForPicker,
//    seedDefaultStoreTaxonomy) in the screen where they already
//    live.
// ✅ Seed banner visibility logic (`!categoriesLoading &&
//    categories.length === 0 && canEditInventory`) stays exactly as
//    it was — shown only when no categories exist yet, manager-only.
// ✅ Prop names are specific rather than generic — shouldShowSeedBanner
//    (not showSeedBanner) and onSeedStoreDefaults (not
//    onSeedDefaults), anticipating that Servora will likely grow
//    other "seed X defaults" flows (tax, employees, kitchen presets)
//    that would otherwise collide with a too-generic name.
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
    padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48,
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