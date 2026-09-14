// ============================================
// SERVORA ERP — RequestHistoryScreen
// ✅ Day-scoped Request History — now renders KitchenHistoryTable
//    (category-grouped, batch-level table) instead of a list of
//    RequestCard components.
// ✅ NEW — status filter (clickable stat cards, wired from
//    KitchenScreen.tsx) and category filter (dropdown, also wired
//    from KitchenScreen.tsx) both applied to historyRequests before
//    passing to KitchenHistoryTable — status filter narrows by
//    req.status, category filter narrows by req.categoryId.
// ✅ NEW — batch allocations for the selected date's ISSUED requests
//    are fetched via getMovementsByReference() (the SAME targeted
//    lookup pattern already used in MonthlyReportScreen.tsx — no new
//    fetch pattern introduced). Refetches whenever selectedDate
//    changes or the set of ISSUED request IDs (+ their
//    issuedQuantity, for staleness safety) changes.
// ✅ restaurantId is now a required prop (was previously only used
//    by NewRequestScreen) — needed here for the allocation fetch.
// FROZEN
// ============================================

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequestHistory } from "../hooks/useRequestHistory";
import { formatSelectedDate } from "../utils/kitchen-format";
import { IngredientRequest } from "../types/kitchen-types";
import { Category } from "../../../modules/inventory-module/types/category";
import { getMovementsByReference } from "../../../modules/stock-movement-module/services/stock-movement-service";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { KitchenHistoryTable } from "../components/KitchenHistoryTable";

interface Theme {
  card:          string;
  text:          string;
  textSecondary: string;
  primary:       string;
}

interface RequestHistoryScreenProps {
  requests:      IngredientRequest[];
  loading:       boolean;
  theme:         Theme;
  restaurantId:  string | null | undefined;
  categories:    Category[];
  statusFilter:  IngredientRequest["status"] | null;
  categoryFilter: string | null;
}

export default function RequestHistoryScreen({
  requests, loading, theme, restaurantId, categories, statusFilter, categoryFilter,
}: RequestHistoryScreenProps) {
  const { selectedDate, historyRequests, goToPrevDay, goToNextDay, isToday } = useRequestHistory(requests);

  const filteredRequests = useMemo(() => {
    let result = historyRequests;
    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    if (categoryFilter) result = result.filter((r) => r.categoryId === categoryFilter);
    return result;
  }, [historyRequests, statusFilter, categoryFilter]);

  const [batchAllocationsByRequestId, setBatchAllocationsByRequestId] =
    useState<Map<string, BatchAllocationRecord[]>>(new Map());

  const issuedIdsKey = useMemo(
    () =>
      filteredRequests
        .filter((r) => r.status === "ISSUED")
        .map((r) => `${r.id}:${r.issuedQuantity ?? 0}`)
        .sort()
        .join(","),
    [filteredRequests]
  );

  useEffect(() => {
    const issuedIds = filteredRequests.filter((r) => r.status === "ISSUED").map((r) => r.id);
    if (issuedIds.length === 0 || !restaurantId) {
      setBatchAllocationsByRequestId(new Map());
      return;
    }

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        issuedIds.map(async (id): Promise<readonly [string, BatchAllocationRecord[]]> => {
          try {
            const movements = await getMovementsByReference(restaurantId, "KITCHEN_REQUEST", id);
            const allocations = movements.flatMap((m) => m.batchAllocations ?? []);
            return [id, allocations];
          } catch (error) {
            console.warn(`Failed to load batch allocations for request ${id}:`, error);
            return [id, [] as BatchAllocationRecord[]];
          }
        })
      );
      if (!cancelled) {
        setBatchAllocationsByRequestId(new Map(entries));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuedIdsKey, restaurantId]);

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Request History</Text>

      <View style={[styles.dateNav, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.dateNavArrow}>
          <MaterialIcons name="chevron-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.dateNavLabel, { color: theme.text }]}>
          {isToday ? "Today — " : ""}{formatSelectedDate(selectedDate)}
        </Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.dateNavArrow}>
          <MaterialIcons name="chevron-right" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
      ) : filteredRequests.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
          <MaterialIcons name="add-shopping-cart" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No requests for {formatSelectedDate(selectedDate)}
          </Text>
        </View>
      ) : (
        <KitchenHistoryTable
          requests={filteredRequests}
          batchAllocationsByRequestId={batchAllocationsByRequestId}
          categories={categories}
          categoryDate={formatSelectedDate(selectedDate)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 10, paddingVertical: 8, marginBottom: 12,
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 13, fontWeight: "700" },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
});