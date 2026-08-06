// ============================================
// SERVORA ERP — ItemDetailsDrawer Component
// ✅ New entry point for viewing an inventory item — Row tap now
//    opens THIS drawer instead of directly opening Edit. Matches
//    standard ERP UX (SAP/Oracle/Dynamics/Odoo/NetSuite): viewing
//    an item shouldn't require entering edit mode. Edit itself is
//    now one action among several, reached via the "Edit" button
//    below.
// ✅ Actions: Edit (opens InventoryModal), Adjust Stock (opens
//    StockAdjustmentModal), Duplicate, Archive/Restore. All state
//    for "which modal is open" stays owned by InventoryScreen.tsx —
//    this drawer only renders the item's details and calls the
//    handlers passed in as props, exactly like every other
//    component in this module.
// ✅ Duplicate/Archive/Restore call inventory-service.ts directly
//    (not through a dedicated hook) — these are simple one-shot
//    calls with no complex validation or multi-field form state,
//    unlike Stock Adjustment which has several input fields and
//    warranted its own hook (useStockAdjustment.ts).
// ✅ Archive requires confirmation (Platform-safe pattern, matching
//    the existing delete confirmation in InventoryScreen.tsx) since
//    it changes the item's visibility everywhere immediately.
// ✅ Duplicate does NOT require confirmation — it's non-destructive.
// ✅ Delete is intentionally NOT included here — it already has its
//    own guard and confirmation flow inside InventoryModal's header.
// ✅ busy guards EVERY action button (Edit/Adjust Stock included,
//    not just Duplicate/Archive) — prevents opening a second modal
//    while a duplicate/archive call is still in flight.
// ✅ Edit/Adjust Stock close this drawer FIRST, then call the
//    handler — opening the next modal while this sheet is still
//    animating open underneath it looked awkward; closing first
//    gives a clean single-sheet transition.
// ✅ Duplicate name collision: `${itemName} ${suffix}` (e.g.
//    "Chicken (Copy)") can collide if duplicated more than once —
//    inventory-repository.ts does NOT enforce itemName uniqueness
//    (only categoryId/departmentId names are checked for
//    duplicates, not item names), so this is not currently blocked,
//    just a cosmetic naming collision. Not fixed here — a real fix
//    (auto-incrementing "Copy 2", "Copy 3"...) belongs in
//    duplicateInventoryItem() itself, not duplicated into every
//    caller. Flagged for a future pass on inventory-service.ts.
// ✅ restaurantId guarded before every write, matching every other
//    write path in this module (repository functions all guard
//    this too — belt-and-suspenders, since a component-level guard
//    gives a cleaner no-op than waiting for the repository to throw).
// FROZEN
// ============================================

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem, classifyExpiry, resolveExpiryAlertDays } from "../types/inventory";
import { Category } from "../types/category";
import {
  duplicateInventoryItem, archiveInventoryItem, restoreInventoryItem,
} from "../services/inventory-service";

const isWeb = Platform.OS === "web";

interface ItemDetailsDrawerProps {
  visible:                           boolean;
  item:                              InventoryItem | undefined;
  category:                          Category | undefined;
  restaurantId:                      string;
  todayISO:                          string;
  restaurantDefaultExpiryAlertDays?: number;
  fmt:                               (n: number) => string;
  canEditInventory:                  boolean;
  onClose:                           () => void;
  onEdit:                            (item: InventoryItem) => void;
  onAdjustStock:                     (item: InventoryItem) => void;
  duplicateNameSuffix:               string; // e.g. "(Copy)" — supplied by caller so this component stays language-agnostic
}

export function ItemDetailsDrawer({
  visible, item, category, restaurantId, todayISO, restaurantDefaultExpiryAlertDays,
  fmt, canEditInventory, onClose, onEdit, onAdjustStock, duplicateNameSuffix,
}: ItemDetailsDrawerProps) {
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const resolvedDays = resolveExpiryAlertDays(
    item.expiryAlertDaysOverride,
    category?.expiryAlertDays,
    restaurantDefaultExpiryAlertDays,
  );
  const expiryStatus = classifyExpiry(item.expiryDate, todayISO, resolvedDays);
  const isActive = item.isActive ?? true;

  const handleEditPress = () => {
    if (busy) return;
    onClose();
    onEdit(item);
  };

  const handleAdjustStockPress = () => {
    if (busy) return;
    onClose();
    onAdjustStock(item);
  };

  const handleDuplicate = async () => {
    if (busy || !restaurantId) return;
    setBusy(true);
    try {
      await duplicateInventoryItem(restaurantId, item, `${item.itemName} ${duplicateNameSuffix}`);
      const msg = `"${item.itemName} ${duplicateNameSuffix}" created.`;
      if (isWeb) window.alert(msg);
      else Alert.alert("Item Duplicated", msg);
      onClose();
    } catch (err: any) {
      const msg = err?.message ?? "Failed to duplicate item";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  };

  const doArchiveOrRestore = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      if (isActive) {
        await archiveInventoryItem(restaurantId, item.id);
      } else {
        await restoreInventoryItem(restaurantId, item.id);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message ?? "Failed to update item";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveToggle = () => {
    if (busy || !restaurantId) return;

    if (!isActive) {
      // Restoring is non-destructive — no confirmation needed.
      doArchiveOrRestore();
      return;
    }

    const message = `Archive "${item.itemName}"? It will be hidden from pickers and forms but its history is kept. You can restore it later.`;
    if (isWeb) {
      if (window.confirm(message)) doArchiveOrRestore();
    } else {
      Alert.alert("Archive Item", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", style: "destructive", onPress: doArchiveOrRestore },
      ]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{item.itemName}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            {!isActive && (
              <View style={styles.archivedBanner}>
                <MaterialIcons name="archive" size={14} color="#92400e" />
                <Text style={styles.archivedBannerText}>This item is archived</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Basic Information</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Category</Text>
              <Text style={styles.rowValue}>{category ? `${category.icon ?? ""} ${category.name}` : "—"}</Text>
            </View>
            {item.sku && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>SKU</Text>
                <Text style={styles.rowValue}>{item.sku}</Text>
              </View>
            )}
            {item.barcode && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Barcode</Text>
                <Text style={styles.rowValue}>{item.barcode}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Stock</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Current Stock</Text>
              <Text style={[styles.rowValue, item.isLowStock && styles.warnValue]}>
                {item.currentStock} {item.unit}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Minimum Stock</Text>
              <Text style={styles.rowValue}>{item.minStock} {item.unit}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Unit Cost</Text>
              <Text style={styles.rowValue}>{fmt(item.unitCost)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Inventory Value</Text>
              <Text style={styles.rowValue}>{fmt(item.totalValue)}</Text>
            </View>
            {item.storageLocation && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Storage Location</Text>
                <Text style={styles.rowValue}>{item.storageLocation}</Text>
              </View>
            )}

            {(item.expiryDate || item.batchNo) && (
              <>
                <Text style={styles.sectionLabel}>Expiry</Text>
                {item.expiryDate && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Expiry Date</Text>
                    <Text style={[
                      styles.rowValue,
                      (expiryStatus === "expired" || expiryStatus === "expiringSoon") && styles.warnValue,
                    ]}>
                      {item.expiryDate}
                    </Text>
                  </View>
                )}
                {item.batchNo && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Batch Number</Text>
                    <Text style={styles.rowValue}>{item.batchNo}</Text>
                  </View>
                )}
              </>
            )}

            {item.notes && (
              <>
                <Text style={styles.sectionLabel}>Notes</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </>
            )}
          </ScrollView>

          {busy && (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color="#0369a1" />
              <Text style={styles.busyText}>Working...</Text>
            </View>
          )}

          <View style={styles.actionGrid}>
            {canEditInventory && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleEditPress} disabled={busy}>
                <MaterialIcons name="edit" size={18} color="#0369a1" />
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {canEditInventory && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleAdjustStockPress} disabled={busy}>
                <MaterialIcons name="tune" size={18} color="#0369a1" />
                <Text style={styles.actionBtnText}>Adjust Stock</Text>
              </TouchableOpacity>
            )}
            {canEditInventory && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleDuplicate} disabled={busy}>
                <MaterialIcons name="content-copy" size={18} color="#0369a1" />
                <Text style={styles.actionBtnText}>Duplicate</Text>
              </TouchableOpacity>
            )}
            {canEditInventory && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleArchiveToggle} disabled={busy}>
                <MaterialIcons name={isActive ? "archive" : "unarchive"} size={18} color="#0369a1" />
                <Text style={styles.actionBtnText}>{isActive ? "Archive" : "Restore"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: "85%", paddingBottom: Platform.OS === "web" ? 16 : 24,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 16, fontWeight: "800", color: "#1e293b", flex: 1, marginRight: 12 },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  archivedBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fffbeb", padding: 8, borderRadius: 6, marginBottom: 8,
  },
  archivedBannerText: { color: "#92400e", fontSize: 12, fontWeight: "600" },
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: "#94a3b8",
    textTransform: "uppercase", marginTop: 16, marginBottom: 6,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  rowLabel: { fontSize: 13, color: "#64748b" },
  rowValue: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  warnValue: { color: "#d97706" },
  notesText: { fontSize: 13, color: "#334155", lineHeight: 18 },
  busyRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 8,
  },
  busyText: { fontSize: 12, fontWeight: "600", color: "#0369a1" },
  actionGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    paddingHorizontal: 16, paddingTop: 8,
  },
  actionBtn: {
    flexGrow: 1, flexBasis: "48%",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#e0f2fe",
  },
  actionBtnText: { fontSize: 13, fontWeight: "700", color: "#0369a1" },
});