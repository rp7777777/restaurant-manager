// ============================================
// SERVORA ERP — InventoryList Component
// ✅ EVOLUTIONARY EXTRACTION — this is the exact loading state,
//    empty state, and FlatList JSX that previously lived inline
//    inside InventoryScreen.tsx's render body. Behavior/styling
//    unchanged; only the layer moved.
// ✅ Pure presentation — no state, no Firestore calls. Receives
//    already-loaded/filtered items and the loading flag from the
//    parent screen.
// ✅ Empty-state message distinguishes "no items at all" vs "no
//    items match the current filters" — unchanged from the
//    original (compares total items count, not just the filtered
//    list, so clearing filters is suggested implicitly rather than
//    telling someone with zero inventory to "adjust filters").
// ✅ FlatList perf props (initialNumToRender/windowSize) kept
//    exactly as configured in the original.
// FROZEN
// ============================================

import React from "react";
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
}

export function InventoryList({
  items, filteredItems, loading, categoryMap, todayISO,
  restaurantDefaultExpiryAlertDays, fmt, onItemPress,
}: InventoryListProps) {
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
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  loadingIndicator: { marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  list: { padding: 16 },
});