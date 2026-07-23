// ============================================
// SERVORA ERP — InventoryCard Component
// ✅ Pure presentation — displays one InventoryItem in the list.
// ✅ Shows category name (resolved via a lookup map passed in from
//    the screen, since InventoryItem only stores categoryId).
// ✅ Low stock / out of stock / expiring visual indicators.
// FROZEN
// ============================================

import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem, classifyExpiry, resolveExpiryAlertDays } from "../types/inventory";
import { Category } from "../types/category";

interface InventoryCardProps {
  item:                    InventoryItem;
  category:                Category | undefined;
  todayISO:                string;
  restaurantDefaultExpiryAlertDays?: number;
  fmt:                     (n: number) => string;
  onPress:                 () => void;
}

function InventoryCard({
  item, category, todayISO, restaurantDefaultExpiryAlertDays, fmt, onPress,
}: InventoryCardProps) {
  const resolvedDays = resolveExpiryAlertDays(
    item.expiryAlertDaysOverride,
    category?.expiryAlertDays,
    restaurantDefaultExpiryAlertDays,
  );
  const expiryStatus = classifyExpiry(item.expiryDate, todayISO, resolvedDays);

  const isOutOfStock = item.currentStock === 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.topRow}>
        <View style={styles.nameSection}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          {category && (
            <View style={styles.categoryBadge}>
              {category.icon && <Text style={styles.categoryIcon}>{category.icon}</Text>}
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
      </View>

      <View style={styles.middleRow}>
        <Text style={[
          styles.stockText,
          isOutOfStock && styles.outOfStockText,
          item.isLowStock && !isOutOfStock && styles.lowStockText,
        ]}>
          {item.currentStock} {item.unit}
        </Text>
        <Text style={styles.valueText}>{fmt(item.totalValue)}</Text>
      </View>

      {(item.isLowStock || expiryStatus === "expired" || expiryStatus === "expiringSoon") && (
        <View style={styles.badgeRow}>
          {isOutOfStock && (
            <View style={[styles.statusBadge, styles.outOfStockBadge]}>
              <MaterialIcons name="remove-shopping-cart" size={11} color="#fff" />
              <Text style={styles.statusBadgeText}>Out of Stock</Text>
            </View>
          )}
          {item.isLowStock && !isOutOfStock && (
            <View style={[styles.statusBadge, styles.lowStockBadge]}>
              <MaterialIcons name="warning" size={11} color="#fff" />
              <Text style={styles.statusBadgeText}>Low Stock</Text>
            </View>
          )}
          {expiryStatus === "expired" && (
            <View style={[styles.statusBadge, styles.expiredBadge]}>
              <MaterialIcons name="dangerous" size={11} color="#fff" />
              <Text style={styles.statusBadgeText}>Expired</Text>
            </View>
          )}
          {expiryStatus === "expiringSoon" && (
            <View style={[styles.statusBadge, styles.expiringBadge]}>
              <MaterialIcons name="schedule" size={11} color="#fff" />
              <Text style={styles.statusBadgeText}>Expiring Soon</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor:   "#fff",
    borderRadius:      12,
    padding:           12,
    marginBottom:      8,
    borderWidth:       1,
    borderColor:       "#e2e8f0",
  },
  topRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  nameSection: { flex: 1, gap: 4 },
  itemName:    { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  categoryBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    alignSelf:         "flex-start",
    backgroundColor:   "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      6,
  },
  categoryIcon: { fontSize: 11 },
  categoryText: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  middleRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      8,
  },
  stockText:        { fontSize: 14, fontWeight: "700", color: "#334155" },
  lowStockText:      { color: "#d97706" },
  outOfStockText:    { color: "#dc2626" },
  valueText:         { fontSize: 14, fontWeight: "700", color: "#059669" },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  statusBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
  },
  lowStockBadge:   { backgroundColor: "#d97706" },
  outOfStockBadge: { backgroundColor: "#dc2626" },
  expiredBadge:    { backgroundColor: "#991b1b" },
  expiringBadge:   { backgroundColor: "#ea580c" },
  statusBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});

export default memo(InventoryCard);