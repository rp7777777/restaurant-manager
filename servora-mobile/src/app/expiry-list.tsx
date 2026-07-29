// ============================================
// SERVORA ERP — ExpiryListScreen
// ✅ Reached from Dashboard's Store Status card ("Expiring Soon" /
//    "Expired" rows) — dedicated, category-grouped view rather than
//    reusing the flat Inventory list, since a Store Keeper scanning
//    for what's about to go bad wants it organized by category
//    ("Dairy: Milk exp 07/29 / Meat: Chicken exp 07/29"), not just a
//    plain filtered list.
// ✅ Reuses the SAME classification helpers Inventory itself uses
//    (resolveExpiryAlertDays, classifyExpiry from types/inventory.ts)
//    — this screen can never disagree with what counts as "expiring"
//    vs the badges shown elsewhere, since it's the same function.
// ✅ Read-only list — tapping an item does nothing yet; editing stays
//    on the main Inventory screen. Kept intentionally simple since
//    the point of this screen is triage/visibility, not editing.
// PHASE: Dashboard improvements
// ============================================

import React, { useMemo } from "react";
import {
  View, Text, FlatList, StyleSheet,
  Platform, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { useInventory } from "../modules/inventory-module/hooks/useInventory";
import { useCategoriesForPicker } from "../modules/inventory-module/hooks/useCategoriesForPicker";
import {
  resolveExpiryAlertDays,
  classifyExpiry,
} from "../modules/inventory-module/types/inventory";

type ExpiryFocus = "expired" | "expiringSoon";

interface CategoryGroup {
  categoryId:   string;
  categoryName: string;
  items: {
    id:         string;
    itemName:   string;
    unit:       string;
    expiryDate: string;
    isExpired:  boolean;
  }[];
}

export default function ExpiryListScreen() {
  const { restaurantId, fmt } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  // ✅ Defaults to showing both — a bare /expiry-list visit (no
  // param) isn't an error, it's just "show me everything expiry-
  // related", which is a reasonable thing to want too.
  const focus: ExpiryFocus | "both" =
    params.focus === "expired" || params.focus === "expiringSoon"
      ? params.focus
      : "both";

  const { items, loading: itemsLoading } = useInventory(restaurantId);
  const { categories, loading: categoriesLoading } = useCategoriesForPicker(restaurantId);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const groups = useMemo((): CategoryGroup[] => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const byCategory = new Map<string, CategoryGroup>();

    for (const item of items) {
      if (!item.expiryDate) continue;

      const category = categoryMap.get(item.categoryId);
      const resolvedDays = resolveExpiryAlertDays(
        item.expiryAlertDaysOverride,
        category?.expiryAlertDays,
        undefined // restaurant-level default not wired yet — falls through to the built-in default
      );
      const status = classifyExpiry(item.expiryDate, todayISO, resolvedDays);

      const matchesFocus =
        focus === "both"
          ? (status === "expired" || status === "expiringSoon")
          : status === focus;
      if (!matchesFocus) continue;

      const categoryId   = item.categoryId ?? "uncategorized";
      const categoryName = category?.name ?? "Uncategorized";

      if (!byCategory.has(categoryId)) {
        byCategory.set(categoryId, { categoryId, categoryName, items: [] });
      }
      byCategory.get(categoryId)!.items.push({
        id:         item.id,
        itemName:   item.itemName,
        unit:       item.unit,
        expiryDate: item.expiryDate,
        isExpired:  status === "expired",
      });
    }

    return Array.from(byCategory.values())
      .map((g) => ({
        ...g,
        items: g.items.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [items, categoryMap, focus]);

  const loading = itemsLoading || categoriesLoading;
  const title =
    focus === "expired" ? "Expired Items"
    : focus === "expiringSoon" ? "Expiring Soon"
    : "Expiry Overview";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0369a1" style={{ marginTop: 40 }} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="check-circle" size={40} color="#22c55e" />
          <Text style={styles.emptyStateText}>Nothing to worry about right now</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.categoryId}
          contentContainerStyle={styles.list}
          renderItem={({ item: group }) => (
            <View style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{group.categoryName}</Text>
              {group.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <MaterialIcons
                      name={item.isExpired ? "dangerous" : "schedule"}
                      size={16}
                      color={item.isExpired ? "#dc2626" : "#fb923c"}
                    />
                    <Text style={styles.itemName}>{item.itemName}</Text>
                  </View>
                  <Text style={[styles.itemExpiry, item.isExpired && styles.itemExpiryExpired]}>
                    {item.expiryDate}
                  </Text>
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  list: { padding: 16 },
  categoryBlock: { marginBottom: 16 },
  categoryTitle: {
    fontSize: 13, fontWeight: "800", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  itemExpiry: { fontSize: 13, fontWeight: "700", color: "#d97706" },
  itemExpiryExpired: { color: "#dc2626" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
});