// ============================================
// SERVORA ERP — ArchivedItemsModal Component
// ✅ Full-screen Modal listing all ARCHIVED (isActive === false)
//    inventory items — the confirmed counterpart to
//    InventoryTableView excluding them from the main working table.
// ✅ Simple card list, NOT the Excel-style batch table — archived
//    items are, by definition, retired from active rotation, so
//    there's no ongoing batch/stock workflow to display here. The
//    primary action is Restore.
// ✅ Restore calls restoreInventoryItem() (inventory-service.ts,
//    already FROZEN) — sets isActive back to true, which makes the
//    item reappear in InventoryTableView immediately (live
//    subscription via useInventory()).
// ✅ Receives `items` as a prop (already-loaded from
//    InventoryScreen's existing useInventory() subscription) rather
//    than subscribing independently — consistent with every other
//    component in this module receiving data via props.
// ✅ Category name resolved via the categoryMap prop (already built
//    by InventoryScreen.tsx) for display context.
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { Category } from "../types/category";
import { restoreInventoryItem } from "../services/inventory-service";

const isWeb = Platform.OS === "web";

interface ArchivedItemsModalProps {
  visible:      boolean;
  items:        InventoryItem[]; // full, unfiltered list — this component filters to archived itself
  categoryMap:  Map<string, Category>;
  restaurantId: string;
  fmt:          (n: number) => string;
  onClose:      () => void;
}

export function ArchivedItemsModal({
  visible, items, categoryMap, restaurantId, fmt, onClose,
}: ArchivedItemsModalProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const archivedItems = useMemo(() => {
    return items
      .filter((item) => item.isActive === false)
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items]);

  const handleRestore = async (item: InventoryItem) => {
    if (restoringId) return;
    setRestoringId(item.id);
    try {
      await restoreInventoryItem(restaurantId, item.id);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to restore item";
      if (isWeb) window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Archived Items</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {archivedItems.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="archive" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No archived items</Text>
            </View>
          ) : (
            archivedItems.map((item) => {
              const category = categoryMap.get(item.categoryId);
              const isRestoringThis = restoringId === item.id;

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.itemName}>{item.itemName}</Text>
                    {category && (
                      <Text style={styles.categoryText}>
                        {category.icon ? `${category.icon} ` : ""}{category.name}
                      </Text>
                    )}
                    <Text style={styles.valueText}>{fmt(item.totalValue)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.restoreBtn, isRestoringThis && { opacity: 0.6 }]}
                    onPress={() => handleRestore(item)}
                    disabled={!!restoringId}
                  >
                    <MaterialIcons name="unarchive" size={16} color="#0369a1" />
                    <Text style={styles.restoreBtnText}>
                      {isRestoringThis ? "Restoring..." : "Restore"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  body: { flex: 1 },
  bodyContent: { padding: 16 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  card: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  cardInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  categoryText: { fontSize: 12, color: "#64748b" },
  valueText: { fontSize: 12, fontWeight: "600", color: "#059669" },
  restoreBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#e0f2fe", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
  },
  restoreBtnText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
});