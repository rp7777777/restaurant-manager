// ============================================
// SERVORA ERP — InventoryStats Component
// ✅ Simple on-demand aggregation — NOT the Dashboard hybrid
//    incremental-summary pattern. Computes Total Items, Total
//    Value, Low Stock, Out of Stock, and Expiring Soon directly
//    from the already-loaded `items` array via useMemo().
// ✅ "Today's Adjustments" is intentionally NOT included — deferred,
//    would require touching the FROZEN stock-movement-service.ts.
// ✅ Expiring Soon reuses classifyExpiry()/resolveExpiryAlertDays()
//    from types/inventory.ts.
// ✅ Low Stock and Out of Stock are INDEPENDENT metrics (not
//    mutually exclusive) — matches standard ERP reporting
//    conventions.
// ✅ `item.totalValue ?? 0` guards against inconsistent documents.
// ✅ Card width uses Platform-aware responsive sizing.
// ✅ Every card is tappable and drives the parent screen's
//    stock-status filter (Total Items/Total Value → "all", Low
//    Stock → "lowStock", Out of Stock → "outOfStock", Expiring
//    Soon → "expiringSoon"). onStatusPress reports which card was
//    tapped; the parent screen owns calling setStockStatus() and
//    scrolling the list into view.
// ✅ FIX — "Expiring Soon" count now matches ONLY classifyExpiry's
//    "expiringSoon" status, excluding "expired" — previously this
//    counted both, which meant the card's number (e.g. "3") could
//    disagree with how many items the tap-to-filter actually
//    surfaced (useInventoryFilters.ts's "expiringSoon" filter is
//    expiringSoon-only, per the confirmed ERP convention of keeping
//    Expiring Soon and Expired as distinct concepts). Count and
//    filter must always agree — this keeps them in sync.
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  InventoryItem,
  classifyExpiry,
  resolveExpiryAlertDays,
} from "../types/inventory";
import { Category } from "../types/category";
import { InventoryStockStatus } from "../hooks/useInventoryFilters";

interface InventoryStatsProps {
  items:                            InventoryItem[];
  categoryMap:                      Map<string, Category>;
  todayISO:                         string;
  restaurantDefaultExpiryAlertDays?: number;
  fmt:                              (value: number) => string;
  onStatusPress:                    (status: InventoryStockStatus) => void;
}

interface StatItem {
  key:    string;
  icon:   keyof typeof MaterialIcons.glyphMap;
  label:  string;
  value:  string;
  color:  string;
  status: InventoryStockStatus;
}

export function InventoryStats({
  items, categoryMap, todayISO, restaurantDefaultExpiryAlertDays, fmt, onStatusPress,
}: InventoryStatsProps) {
  const stats = useMemo(() => {
    let totalValue   = 0;
    let lowStock      = 0;
    let outOfStock    = 0;
    let expiringSoon  = 0;

    for (const item of items) {
      totalValue += item.totalValue ?? 0;

      if (item.currentStock <= 0) {
        outOfStock += 1;
      }
      if (item.isLowStock) {
        lowStock += 1;
      }

      const category = categoryMap.get(item.categoryId);
      const resolvedDays = resolveExpiryAlertDays(
        item.expiryAlertDaysOverride,
        category?.expiryAlertDays,
        restaurantDefaultExpiryAlertDays
      );
      const status = classifyExpiry(item.expiryDate, todayISO, resolvedDays);
      if (status === "expiringSoon") {
        expiringSoon += 1;
      }
    }

    return {
      totalItems: items.length,
      totalValue,
      lowStock,
      outOfStock,
      expiringSoon,
    };
  }, [items, categoryMap, todayISO, restaurantDefaultExpiryAlertDays]);

  const statList: StatItem[] = [
    { key: "total",    icon: "inventory-2",   label: "Total Items",  value: String(stats.totalItems),      color: "#1e293b", status: "all" },
    { key: "value",    icon: "attach-money",  label: "Total Value",  value: fmt(stats.totalValue),         color: "#0369a1", status: "all" },
    { key: "low",      icon: "trending-down", label: "Low Stock",    value: String(stats.lowStock),        color: "#d97706", status: "lowStock" },
    { key: "out",      icon: "remove-shopping-cart", label: "Out of Stock", value: String(stats.outOfStock), color: "#dc2626", status: "outOfStock" },
    { key: "expiring", icon: "schedule",      label: "Expiring Soon", value: String(stats.expiringSoon),   color: "#7c3aed", status: "expiringSoon" },
  ];

  return (
    <View style={styles.row}>
      {statList.map((stat) => (
        <TouchableOpacity
          key={stat.key}
          style={styles.card}
          onPress={() => onStatusPress(stat.status)}
          activeOpacity={0.7}
        >
          <MaterialIcons name={stat.icon} size={16} color={stat.color} />
          <Text style={[styles.value, { color: stat.color }]}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  card: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? "18%" : "48%",
    minWidth: 90,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "flex-start",
    gap: 2,
  },
  value: { fontSize: 16, fontWeight: "800" },
  label: { fontSize: 10, fontWeight: "600", color: "#94a3b8" },
});