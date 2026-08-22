// ============================================
// SERVORA ERP — InventoryStats Component
// ✅ Simple on-demand aggregation.
// ✅ Low Stock/Out of Stock mutually exclusive.
// ✅ FIX — added activeStockStatus prop so the currently-selected
//    filter's card is visually highlighted (colored border +
//    tinted background matching that stat's own color) — previously
//    tapping a card applied the filter but gave no lasting visual
//    feedback that it was active, only a brief press-opacity flash.
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
  activeStockStatus:                InventoryStockStatus;
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
  items, categoryMap, todayISO, restaurantDefaultExpiryAlertDays, fmt, activeStockStatus, onStatusPress,
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
      {statList.map((stat) => {
        // ✅ FIX — "all" status cards (Total Items, Total Value) now
        // also highlight when active, matching the confirmed request
        // that every card give visual feedback when tapped —
        // previously these two were deliberately excluded since "all"
        // isn't a "real" filter in the same sense as
        // lowStock/outOfStock/expiringSoon, but visual consistency
        // across all 5 cards was confirmed to matter more here.
        const isActive = activeStockStatus === stat.status;
        return (
          <TouchableOpacity
            key={stat.key}
            style={[
              styles.card,
              isActive && { borderColor: stat.color, borderWidth: 2, backgroundColor: `${stat.color}18` },
            ]}
            onPress={() => onStatusPress(stat.status)}
            activeOpacity={0.7}
          >
            <MaterialIcons name={stat.icon} size={13} color={stat.color} />
            <Text style={[styles.value, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 36 },
  row: {
    flexDirection: "row",
    gap: 6,
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