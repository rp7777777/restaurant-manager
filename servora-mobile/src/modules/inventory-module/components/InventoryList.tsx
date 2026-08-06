// ============================================
// SERVORA ERP — InventoryList Component
// ✅ EVOLUTIONARY EXTRACTION — loading state, empty state, and
//    FlatList JSX, unchanged from the original.
// ✅ Pure presentation — no state, no Firestore calls.
// ✅ onItemPress opens ItemDetailsDrawer (wired at the screen
//    level); onAdjustStock opens StockAdjustmentModal directly.
// ✅ forwardRef exposes the underlying FlatList's scrollTo methods
//    to the parent screen, so tapping an InventoryStats card can
//    scroll the list into view after changing the filter. The ref
//    is only meaningful when NOT in the loading/empty-state branch
//    — those branches render a View/ActivityIndicator instead of a
//    FlatList; the parent guards its scrollTo call with optional
//    chaining accordingly.
// ✅ displayName set explicitly — forwardRef-wrapped components
//    otherwise show up as "ForwardRef" (unhelpful) in React
//    DevTools instead of "InventoryList".
// FROZEN
// ============================================

import React, { forwardRef } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { Category } from "../types/category";
import InventoryCard from "./InventoryCard";

interface InventoryListProps {
  items:                             InventoryItem[];   // full, unfiltered — used only to distinguish empty states
  filteredItems:                     InventoryItem[];
  loading:                           boolean;
  categoryMap:                       Map<string, Category>;
  todayISO:                          string;
  restaurantDefaultExpiryAlertDays?: number;
  fmt:                               (value: number) => string;
  onItemPress:                       (item: InventoryItem) => void;
  onAdjustStock:                     (item: InventoryItem) => void;
}

export const InventoryList = forwardRef<FlatList, InventoryListProps>(function InventoryList({
  items, filteredItems, loading, categoryMap, todayISO,
  restaurantDefaultExpiryAlertDays, fmt, onItemPress, onAdjustStock,
}, ref) {
  if (loading) {
    return <ActivityIndicator size="large" color="#0369a1" style={styles.loadingIndicator} />;
  }

  if (filteredItems.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="inventory-2" size={40} color="#cbd5e1" />
        <Text style={styles.emptyStateText}>
          {items.length === 0 ? "No inventory items yet" : "No items match your filters"}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={ref}
      data={filteredItems}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      initialNumToRender={12}
      windowSize={7}
      renderItem={({ item }) => (
        <InventoryCard
          item={item}
          category={categoryMap.get(item.categoryId)}
          todayISO={todayISO}
          restaurantDefaultExpiryAlertDays={restaurantDefaultExpiryAlertDays}
          fmt={fmt}
          onPress={() => onItemPress(item)}
          onAdjustStock={() => onAdjustStock(item)}
        />
      )}
    />
  );
});

InventoryList.displayName = "InventoryList";

const styles = StyleSheet.create({
  loadingIndicator: { marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  list: { padding: 16 },
});