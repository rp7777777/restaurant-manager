// ============================================
// SERVORA ERP — DailyReportScreen
// ✅ On-screen preview of today's Inventory snapshot + Stock-In
//    (PURCHASE movements) + Stock-Out (KITCHEN_ISSUE movements),
//    grouped by category — same grouping used in daily-report-pdf.ts
//    so the on-screen view and the printed report never disagree.
// ✅ Fetches today's movements via getMovementsForDateRange()
//    (daily-report-service.ts) — a ONE-TIME fetch (not a live
//    subscription), since this is an end-of-day report a Store
//    Keeper pulls up and prints, not something that needs to update
//    itself in real time while open.
// ✅ Print/Export button delegates to generateDailyReportPDF(),
//    which mirrors the existing Dashboard PDF's platform-aware
//    print/share flow exactly.
// PHASE: Daily Reports
// ============================================

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet,
  Platform, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { useInventory } from "../modules/inventory-module/hooks/useInventory";
import { useCategoriesForPicker } from "../modules/inventory-module/hooks/useCategoriesForPicker";
import {
  getMovementsForDateRange, todayRange,
} from "../modules/stock-movement-module/services/daily-report-service";
import { generateDailyReportPDF } from "../services/daily-report/daily-report-pdf";
import { StockMovement } from "../modules/stock-movement-module/types/stock-movement";
import { InventoryItem } from "../modules/inventory-module/types/inventory";

type Section = "inventory" | "stockIn" | "stockOut";

interface CategorySection<T> {
  categoryId:   string;
  categoryName: string;
  rows: T[];
}

function groupByCategory<T>(
  rows: T[],
  getCategoryId: (row: T) => string | undefined,
  categoryMap: Map<string, { name: string }>
): CategorySection<T>[] {
  const byCategory = new Map<string, CategorySection<T>>();
  for (const row of rows) {
    const categoryId   = getCategoryId(row) ?? "uncategorized";
    const categoryName = categoryMap.get(categoryId)?.name ?? "Uncategorized";
    if (!byCategory.has(categoryId)) {
      byCategory.set(categoryId, { categoryId, categoryName, rows: [] });
    }
    byCategory.get(categoryId)!.rows.push(row);
  }
  return Array.from(byCategory.values()).sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName)
  );
}

export default function DailyReportScreen() {
  const { restaurantId, fmt } = useApp();
  const router = useRouter();

  const { items: inventoryItems, loading: inventoryLoading } = useInventory(restaurantId);
  const { categories, loading: categoriesLoading } = useCategoriesForPicker(restaurantId);

  const [movements, setMovements]           = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [exporting, setExporting]           = useState(false);
  const [activeSection, setActiveSection]   = useState<Section>("inventory");

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setMovementsLoading(true);
    getMovementsForDateRange(restaurantId, todayRange())
      .then((result) => { if (!cancelled) setMovements(result); })
      .finally(() => { if (!cancelled) setMovementsLoading(false); });
    return () => { cancelled = true; };
  }, [restaurantId]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const inventoryByItemId = useMemo(
    () => new Map(inventoryItems.map((i) => [i.id, i])),
    [inventoryItems]
  );

  const stockIn  = useMemo(() => movements.filter((m) => m.movementType === "PURCHASE"), [movements]);
  const stockOut = useMemo(() => movements.filter((m) => m.movementType === "KITCHEN_ISSUE"), [movements]);

  const inventoryGroups = useMemo(
    () => groupByCategory(inventoryItems, (i) => i.categoryId, categoryMap),
    [inventoryItems, categoryMap]
  );
  const stockInGroups = useMemo(
    () => groupByCategory(stockIn, (m: StockMovement) => inventoryByItemId.get(m.inventoryId)?.categoryId, categoryMap),
    [stockIn, inventoryByItemId, categoryMap]
  );
  const stockOutGroups = useMemo(
    () => groupByCategory(stockOut, (m: StockMovement) => inventoryByItemId.get(m.inventoryId)?.categoryId, categoryMap),
    [stockOut, inventoryByItemId, categoryMap]
  );

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric",
    });
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await generateDailyReportPDF({
        dateLabel,
        inventoryItems,
        todaysMovements: movements,
        categories,
        fmt,
      });
    } finally {
      setExporting(false);
    }
  }, [dateLabel, inventoryItems, movements, categories, fmt]);

  const loading = inventoryLoading || categoriesLoading || movementsLoading;

  const activeGroups =
    activeSection === "inventory" ? inventoryGroups
    : activeSection === "stockIn" ? stockInGroups
    : stockOutGroups;

  // ✅ FlatList's typings need ONE consistent generic type for its
  // `data` prop — activeGroups is a union (InventoryItem groups OR
  // StockMovement groups) because it can be either depending on
  // activeSection, which FlatList's overloads can't resolve. This
  // cast doesn't change what's rendered — renderItem below still
  // correctly branches on activeSection and casts each row back to
  // its real type before reading item-specific fields.
  const flatListData = activeGroups as unknown as CategorySection<unknown>[];

  const stockInTotal  = useMemo(() => stockIn.reduce((s, m) => s + m.movementValue, 0), [stockIn]);
  const stockOutTotal = useMemo(() => stockOut.reduce((s, m) => s + m.movementValue, 0), [stockOut]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Daily Report</Text>
          <Text style={styles.subtitle}>{dateLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={exporting || loading}
        >
          <MaterialIcons name="print" size={16} color="#fff" />
          <Text style={styles.exportBtnText}>{exporting ? "..." : "Print"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeSection === "inventory" && styles.tabActive]}
          onPress={() => setActiveSection("inventory")}
        >
          <Text style={[styles.tabText, activeSection === "inventory" && styles.tabTextActive]}>
            Inventory
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === "stockIn" && styles.tabActive]}
          onPress={() => setActiveSection("stockIn")}
        >
          <Text style={[styles.tabText, activeSection === "stockIn" && styles.tabTextActive]}>
            Stock-In ({stockIn.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSection === "stockOut" && styles.tabActive]}
          onPress={() => setActiveSection("stockOut")}
        >
          <Text style={[styles.tabText, activeSection === "stockOut" && styles.tabTextActive]}>
            Stock-Out ({stockOut.length})
          </Text>
        </TouchableOpacity>
      </View>

      {(activeSection === "stockIn" || activeSection === "stockOut") && (
        <View style={styles.totalBanner}>
          <Text style={styles.totalBannerText}>
            Total {activeSection === "stockIn" ? "received" : "issued"}:{" "}
            {fmt(activeSection === "stockIn" ? stockInTotal : stockOutTotal)}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0369a1" style={{ marginTop: 40 }} />
      ) : activeGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={40} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>Nothing here today</Text>
        </View>
      ) : (
        <FlatList
          data={flatListData}
          keyExtractor={(g) => g.categoryId}
          contentContainerStyle={styles.list}
          renderItem={({ item: group }) => (
            <View style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{group.categoryName}</Text>
              {activeSection === "inventory"
                ? (group.rows as unknown as InventoryItem[]).map((row) => (
                    <View key={row.id} style={styles.row}>
                      <Text style={styles.rowName}>{row.itemName}</Text>
                      <Text style={styles.rowMeta}>{row.currentStock} {row.unit}</Text>
                      <Text style={styles.rowValue}>{fmt(row.totalValue)}</Text>
                    </View>
                  ))
                : (group.rows as unknown as StockMovement[]).map((row) => (
                    <View key={row.id} style={styles.row}>
                      <Text style={styles.rowName}>{row.itemName}</Text>
                      <Text style={styles.rowMeta}>
                        {Math.abs(row.quantityChanged)} {row.unit}
                      </Text>
                      <Text style={styles.rowValue}>{fmt(row.movementValue)}</Text>
                    </View>
                  ))
              }
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
  headerTextBlock: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  subtitle: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  exportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0369a1", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  tab: {
    flex: 1, alignItems: "center",
    paddingVertical: 8, borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  tabActive: { backgroundColor: "#0369a1" },
  tabText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  tabTextActive: { color: "#fff" },
  totalBanner: {
    marginHorizontal: 16, marginBottom: 10, padding: 10,
    backgroundColor: "#e0f2fe", borderRadius: 8,
  },
  totalBannerText: { fontSize: 13, fontWeight: "700", color: "#0369a1" },
  list: { padding: 16 },
  categoryBlock: { marginBottom: 16 },
  categoryTitle: {
    fontSize: 13, fontWeight: "800", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 8, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  rowName:  { fontSize: 13, fontWeight: "700", color: "#1e293b", flex: 2 },
  rowMeta:  { fontSize: 12, color: "#64748b", flex: 1, textAlign: "right" },
  rowValue: { fontSize: 13, fontWeight: "800", color: "#059669", flex: 1, textAlign: "right" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
});