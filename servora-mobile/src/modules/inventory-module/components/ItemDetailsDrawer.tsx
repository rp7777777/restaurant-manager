// ============================================
// SERVORA ERP — ItemDetailsDrawer Component
// ✅ New entry point for viewing an inventory item — Row tap opens
//    THIS drawer instead of directly opening Edit.
// ✅ Actions: Edit (item-level fields), Adjust Stock, Archive/
//    Restore, Receive Batch. "Duplicate" removed.
// ✅ busy guards EVERY action button.
// ✅ Batch Table wiring: useBatchesForItem(restaurantId, item.id).
//    Batch-level corrections happen via the per-row "Edit" (pencil
//    + text) → EditBatchModal.
// ✅ Action grid pinned OUTSIDE the ScrollView, always visible at
//    the bottom of the sheet.
// ✅ NEW — InventoryBatchTable's "no batches yet" empty state is
//    now tappable, wired to the SAME handleReceiveBatchPress used
//    by the drawer's own "Receive Batch" action button — a single
//    handler, two entry points (the dedicated action button, and
//    the in-context prompt inside the batch section itself), both
//    doing exactly the same thing (close this drawer, open
//    ReceiveBatchModal via the parent's onReceiveBatch).
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
  archiveInventoryItem, restoreInventoryItem,
} from "../services/inventory-service";
import { useBatchesForItem } from "../hooks/useBatchesForItem";
import { InventoryBatchTable } from "./InventoryBatchTable";
import { InventoryBatch } from "../types/inventory-batch";
import { EditBatchModal } from "./EditBatchModal";

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
  allItems:                          InventoryItem[];
  actorName:                         string;
  onClose:                           () => void;
  onEdit:                            (item: InventoryItem) => void;
  onAdjustStock:                     (item: InventoryItem) => void;
  onReceiveBatch:                    (item: InventoryItem) => void;
  duplicateNameSuffix:               string;
}

export function ItemDetailsDrawer({
  visible, item, category, restaurantId, todayISO, restaurantDefaultExpiryAlertDays,
  fmt, canEditInventory, allItems, actorName, onClose, onEdit, onAdjustStock, onReceiveBatch,
}: ItemDetailsDrawerProps) {
  const [busy, setBusy] = useState(false);
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | undefined>(undefined);

  const { batches, loading: batchesLoading } = useBatchesForItem(restaurantId, item?.id);

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

  const handleReceiveBatchPress = () => {
    if (busy) return;
    onClose();
    onReceiveBatch(item);
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
    <>
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
                {/* ✅ FIX — computed live (currentStock × unitCost)
                    instead of reading the stored item.totalValue
                    field. Root cause of the "€NaN" bug: totalValue
                    is a denormalized snapshot field that isn't
                    guaranteed to be recomputed by every code path
                    that changes currentStock (e.g. the DEV
                    reconciliation script that fixed the "beer"/
                    "water" stale-stock issue updated currentStock
                    directly but never touched totalValue, leaving it
                    undefined on any item it modified). Computing
                    live from the two source values that are always
                    present and correct (currentStock, unitCost)
                    eliminates this entire class of staleness —
                    there's no snapshot left to go stale. */}
                <Text style={styles.rowValue}>{fmt(item.currentStock * item.unitCost)}</Text>
              </View>
              {item.storageLocation && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Storage Location</Text>
                  <Text style={styles.rowValue}>{item.storageLocation}</Text>
                </View>
              )}

              <Text style={styles.sectionLabel}>Batches</Text>
              <InventoryBatchTable
                batches={batches}
                loading={batchesLoading}
                onEditBatch={setEditingBatch}
                onReceiveBatchPress={handleReceiveBatchPress}
              />

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
                <TouchableOpacity style={styles.actionBtn} onPress={handleReceiveBatchPress} disabled={busy}>
                  <MaterialIcons name="move-to-inbox" size={18} color="#0369a1" />
                  <Text style={styles.actionBtnText}>Receive Batch</Text>
                </TouchableOpacity>
              )}
              {canEditInventory && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleAdjustStockPress} disabled={busy}>
                  <MaterialIcons name="tune" size={18} color="#0369a1" />
                  <Text style={styles.actionBtnText}>Adjust Stock</Text>
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

      <EditBatchModal
        visible={!!editingBatch}
        batch={editingBatch}
        item={item}
        allItems={allItems}
        restaurantId={restaurantId}
        actorName={actorName}
        onClose={() => setEditingBatch(undefined)}
      />
    </>
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
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
  },
  actionBtn: {
    flexGrow: 1, flexBasis: "48%",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#e0f2fe",
  },
  actionBtnText: { fontSize: 13, fontWeight: "700", color: "#0369a1" },
});