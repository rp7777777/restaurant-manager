// ============================================
// SERVORA ERP — InventoryCard Component
// ✅ Pure presentation — displays one InventoryItem in the list.
// ✅ Shows category name (resolved via a lookup map passed in from
//    the screen, since InventoryItem only stores categoryId).
// ✅ PHASE (component relocation) — this file now lives in
//    modules/inventory-module/components/ (moved from
//    src/components/inventory/), matching Kitchen module's pattern.
// ✅ NEW — "Adjust Stock" icon button, separate from the row's main
//    onPress (which now opens ItemDetailsDrawer, not Edit directly —
//    see the WIRING CHANGE note below).
// ✅ WIRING CHANGE — onPress now opens ItemDetailsDrawer instead of
//    opening Edit directly. Matches the confirmed ERP-standard flow
//    (Row tap → Details Drawer → Edit/Adjust Stock/Duplicate/Archive
//    as actions inside the drawer). The onAdjustStock icon button
//    remains a shortcut that bypasses the drawer entirely for the
//    single most common action.
// ✅ Badge row now delegates to InventoryStatusBadge (extracted) —
//    this component no longer computes or renders status badges
//    itself; it only computes expiryStatus (needed for the
//    low-stock/expiry text coloring above the badges) and passes it
//    down.
// ✅ Uses Pressable for the secondary action button. This keeps the
//    interaction isolated in practice and aligns with React
//    Native's modern press API, though parent/child press behavior
//    ultimately depends on the underlying responder system —
//    switching to Pressable is not itself a guarantee against event
//    bubbling to the card's own onPress.
// FROZEN
// ============================================

import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem, classifyExpiry, resolveExpiryAlertDays } from "../types/inventory";
import { Category } from "../types/category";
import { InventoryStatusBadge } from "./InventoryStatusBadge";

interface InventoryCardProps {
  item:                    InventoryItem;
  category:                Category | undefined;
  todayISO:                string;
  restaurantDefaultExpiryAlertDays?: number;
  fmt:                     (n: number) => string;
  onPress:                 () => void;
  onAdjustStock:           () => void;
}

function InventoryCard({
  item, category, todayISO, restaurantDefaultExpiryAlertDays, fmt, onPress, onAdjustStock,
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
        <View style={styles.topRowActions}>
          <Pressable
            style={styles.adjustBtn}
            onPress={onAdjustStock}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="tune" size={16} color="#0369a1" />
          </Pressable>
          <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
        </View>
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

      <InventoryStatusBadge item={item} expiryStatus={expiryStatus} />
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
  topRowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  adjustBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#e0f2fe",
    alignItems: "center", justifyContent: "center",
  },
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
});

export default memo(InventoryCard);