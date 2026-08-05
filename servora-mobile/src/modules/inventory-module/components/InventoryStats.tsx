// ============================================
// SERVORA ERP — InventoryStats Component
// ✅ Simple on-demand aggregation — NOT the Dashboard hybrid
//    incremental-summary pattern. Computes Total Items, Total
//    Value, Low Stock, Out of Stock, and Expiring Soon directly
//    from the already-loaded `items` array via useMemo(). This
//    matches the confirmed decision to defer the Dashboard-style
//    hybrid summary until Inventory reaches a scale (20+ branches,
//    50k+ items) where the added complexity is justified.
// ✅ "Today's Adjustments" is intentionally NOT included — it would
//    require a new cross-item stock-movement query (today's
//    movements across ALL items), which doesn't exist yet and would
//    mean touching the FROZEN stock-movement-service.ts. Deferred to
//    a future phase rather than bolted on here.
// ✅ Expiring Soon reuses classifyExpiry()/resolveExpiryAlertDays()
//    from types/inventory.ts — the same 3-tier priority logic
//    (Item Override → Category Setting → Restaurant Default →
//    7-day fallback) already used everywhere else in this module,
//    so the stat card never disagrees with what InventoryCard shows
//    for an individual item.
// ✅ Low Stock and Out of Stock are INDEPENDENT metrics (not
//    mutually exclusive) — matches standard ERP reporting
//    conventions (SAP/Oracle/Dynamics): an out-of-stock item is
//    also counted in Low Stock, since 0 is definitionally at-or-
//    below the minimum threshold. Previously these were mutually
//    exclusive (else-if), which under-reported Low Stock.
// ✅ `item.totalValue ?? 0` guards against any pre-migration/
//    inconsistent document missing the field.
// ✅ Card width uses Platform-aware responsive sizing — 48% (two
//    per row) on mobile, 18% (five in a row) on web/tablet, since a
//    fixed 18% wrapped inconsistently on narrower Android/iOS
//    screens.
// ✅ Pure presentation + one useMemo — no state, no side effects,
//    no Firestore calls of its own. Receives `items` from the
//    parent screen (already subscribed via useInventory()).
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  InventoryItem,
  classifyExpiry,
  resolveExpiryAlertDays,
} from "../types/inventory";
import { Category } from "../types/category";

interface InventoryStatsProps {
  items:                            InventoryItem[];
  categoryMap:                      Map<string, Category>;
  todayISO:                         string;
  restaurantDefaultExpiryAlertDays?: number;
  fmt:                              (value: number) => string; // currency/number formatter from AppContext
}

interface StatItem {
  key:   string;
  icon:  keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  color: string;
}

export function InventoryStats({
  items, categoryMap, todayISO, restaurantDefaultExpiryAlertDays, fmt,
}: InventoryStatsProps) {
  const stats = useMemo(() => {
    let totalValue   = 0;
    let lowStock      = 0;
    let outOfStock    = 0;
    let expiringSoon  = 0;

    for (const item of items) {
      totalValue += item.totalValue ?? 0;

      // ✅ Independent metrics — an out-of-stock item is ALSO low
      // stock (0 is always <= minStock), so both counters can
      // include it. Matches standard ERP reporting conventions.
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
      if (status === "expiringSoon" || status === "expired") {
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
    { key: "total",    icon: "inventory-2",   label: "Total Items",  value: String(stats.totalItems),      color: "#1e293b" },
    { key: "value",    icon: "attach-money",  label: "Total Value",  value: fmt(stats.totalValue),         color: "#0369a1" },
    { key: "low",      icon: "trending-down", label: "Low Stock",    value: String(stats.lowStock),        color: "#d97706" },
    { key: "out",      icon: "remove-shopping-cart", label: "Out of Stock", value: String(stats.outOfStock), color: "#dc2626" },
    { key: "expiring", icon: "schedule",      label: "Expiring Soon", value: String(stats.expiringSoon),   color: "#7c3aed" },
  ];

  return (
    <View style={styles.row}>
      {statList.map((stat) => (
        <View key={stat.key} style={styles.card}>
          <MaterialIcons name={stat.icon} size={16} color={stat.color} />
          <Text style={[styles.value, { color: stat.color }]}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
        </View>
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
    // ✅ Responsive: 2-per-row on mobile (Android/iOS), 5-in-a-row
    // on web/tablet — a fixed 18% wrapped inconsistently on
    // narrower phone screens.
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