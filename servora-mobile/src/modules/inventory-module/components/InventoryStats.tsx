// ============================================
// SERVORA ERP — InventoryStats Component
// ✅ Simple on-demand aggregation.
// ✅ FIX — Low Stock and Out of Stock are now MUTUALLY EXCLUSIVE
//    (changed from previously-independent counting). Previously an
//    item with currentStock <= 0 AND isLowStock === true was counted
//    in BOTH metrics, inflating Low Stock's number in a way that
//    double-counted items already captured by Out of Stock —
//    confusing for ERP reporting clarity. Now: currentStock <= 0 →
//    Out of Stock ONLY; currentStock > 0 AND isLowStock → Low Stock
//    ONLY; otherwise Normal. This gives a clean three-way
//    classification with no overlap, matching standard ERP
//    reporting conventions (an item is either critically out, low,
//    or fine — never both "low" and "out" simultaneously in the
//    displayed counts).
// ✅ Every card is tappable, drives the parent's stock-status
//    filter. NOTE: useInventoryFilters.ts's "lowStock" filter
//    itself is unchanged by this fix — this only affects the STATS
//    CARD COUNT shown here, not which items the tap-to-filter
//    surfaces. If a fully consistent count-matches-filter guarantee
//    is wanted later, useInventoryFilters.ts's lowStock predicate
//    would need the same currentStock > 0 exclusion — deferred, not
//    done here, since that touches filter logic beyond this
//    component's own stats aggregation.
// ✅ "Expiring Soon" counts ONLY classifyExpiry's "expiringSoon"
//    status, excluding "expired".
// ✅ Compact cards, Excel-row-height sized (~30px), single
//    horizontal scrollable strip.
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
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

      // ✅ FIX — mutually exclusive: an item is either Out of Stock
      // OR Low Stock, never both, per confirmed ERP clarity design.
      if (item.currentStock <= 0) {
        outOfStock += 1;
      } else if (item.isLowStock) {
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {statList.map((stat) => (
        <TouchableOpacity
          key={stat.key}
          style={styles.card}
          onPress={() => onStatusPress(stat.status)}
          activeOpacity={0.7}
        >
          <MaterialIcons name={stat.icon} size={13} color={stat.color} />
          <Text style={[styles.value, { color: stat.color }]}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: 8, maxHeight: 36 },
  row: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 9,
  },
  value: { fontSize: 12, fontWeight: "800" },
  label: { fontSize: 10, fontWeight: "600", color: "#94a3b8" },
});