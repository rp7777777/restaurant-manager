// ============================================
// SERVORA ERP — KitchenHistoryFullScreenModal Component
// ✅ Full-screen wrapper around KitchenHistoryTable, matching
//    InventoryFullScreenTableModal.tsx's pattern: own Modal, own
//    independent date navigator (re-synced to initialDate every time
//    the modal opens), scrollable table body.
// ✅ NEW — own independent category filter dropdown (same
//    button+list pattern used throughout Store/MonthlyReportScreen)
//    — separate state from the underlying screen's own category
//    filter, reset to "All Categories" every time the modal opens.
// ✅ Batch allocations for the modal's OWN selectedDate's ISSUED
//    requests are fetched independently (same getMovementsByReference
//    pattern as RequestHistoryScreen.tsx) — the modal does not reuse
//    the underlying screen's already-fetched allocations, since Full
//    Screen can navigate to a different date than the screen behind
//    it is currently showing.
// FROZEN
// ============================================

import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../types/kitchen-types";
import { Category } from "../../../modules/inventory-module/types/category";
import { getMovementsByReference } from "../../../modules/stock-movement-module/services/stock-movement-service";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { KitchenHistoryTable } from "./KitchenHistoryTable";

function shiftDate(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

interface KitchenHistoryFullScreenModalProps {
  visible:      boolean;
  onClose:      () => void;
  restaurantId: string | null | undefined;
  requests:     IngredientRequest[];
  categories:   Category[];
  initialDate:  string;
  today:        string;
}

export function KitchenHistoryFullScreenModal({
  visible, onClose, restaurantId, requests, categories, initialDate, today,
}: KitchenHistoryFullScreenModalProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelectedDate(initialDate);
    setCategoryFilter(null);
    setShowCategoryDropdown(false);
  }, [visible, initialDate]);

  const dayRequests = useMemo(
    () => requests.filter((r) => r.requiredDate === selectedDate),
    [requests, selectedDate]
  );

  const filteredRequests = useMemo(() => {
    if (!categoryFilter) return dayRequests;
    return dayRequests.filter((r) => r.categoryId === categoryFilter);
  }, [dayRequests, categoryFilter]);

  const [batchAllocationsByRequestId, setBatchAllocationsByRequestId] =
    useState<Map<string, BatchAllocationRecord[]>>(new Map());
  const [loadingAllocations, setLoadingAllocations] = useState(false);

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
    if (!visible) return;
    const issuedIds = filteredRequests.filter((r) => r.status === "ISSUED").map((r) => r.id);
    if (issuedIds.length === 0 || !restaurantId) {
      setBatchAllocationsByRequestId(new Map());
      return;
    }

    let cancelled = false;
    setLoadingAllocations(true);
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
        setLoadingAllocations(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, issuedIdsKey, restaurantId]);

  const isNextDisabled = selectedDate >= today;
  const selectedCategoryName = categoryFilter
    ? categories.find((c) => c.id === categoryFilter)?.name ?? "All Categories"
    : "All Categories";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Request History — Full View</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setSelectedDate((d) => shiftDate(d, -1))} style={styles.dateNavArrow}>
            <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>{formatDateLabel(selectedDate, today)}</Text>
          <TouchableOpacity
            onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
            style={[styles.dateNavArrow, isNextDisabled && styles.dateNavArrowDisabled]}
            disabled={isNextDisabled}
          >
            <MaterialIcons name="chevron-right" size={22} color={isNextDisabled ? "#cbd5e1" : "#1e293b"} />
          </TouchableOpacity>
        </View>

        {categories.length > 0 && (
          <View style={styles.categoryDropdownWrap}>
            <TouchableOpacity style={styles.categoryDropdownButton} onPress={() => setShowCategoryDropdown((v) => !v)}>
              <Text style={styles.categoryDropdownButtonText}>{selectedCategoryName}</Text>
              <MaterialIcons name={showCategoryDropdown ? "expand-less" : "expand-more"} size={20} color="#059669" />
            </TouchableOpacity>
            {showCategoryDropdown && (
              <ScrollView style={styles.categoryDropdownList} nestedScrollEnabled>
                <TouchableOpacity style={styles.categoryDropdownItem} onPress={() => { setCategoryFilter(null); setShowCategoryDropdown(false); }}>
                  <Text style={styles.categoryDropdownItemText}>All Categories</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity key={cat.id} style={styles.categoryDropdownItem} onPress={() => { setCategoryFilter(cat.id); setShowCategoryDropdown(false); }}>
                    <Text style={styles.categoryDropdownItemText}>{cat.icon} {cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {loadingAllocations ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="add-shopping-cart" size={40} color="#94a3b8" />
              <Text style={styles.emptyText}>No requests for this date</Text>
            </View>
          ) : (
            <KitchenHistoryTable
              requests={filteredRequests}
              batchAllocationsByRequestId={batchAllocationsByRequestId}
              categories={categories}
              liveDateLabel={formatDateLabel(selectedDate, today)}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8,
    padding: 10, paddingTop: Platform.OS === "web" ? 16 : 44,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  closeBtn: { padding: 4 },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  dateNavArrow: { padding: 4 },
  dateNavArrowDisabled: { opacity: 0.5 },
  dateNavLabel: { fontSize: 14, fontWeight: "800", color: "#1e293b", minWidth: 160, textAlign: "center" },
  categoryDropdownWrap: { width: 220, alignSelf: "center", marginTop: 10 },
  categoryDropdownButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1.5, borderColor: "#059669", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff",
  },
  categoryDropdownButtonText: { fontSize: 13, color: "#1e293b", fontWeight: "600" },
  categoryDropdownList: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 220, backgroundColor: "#ffffff", width: 220,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  categoryDropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  categoryDropdownItemText: { fontSize: 13, color: "#1e293b" },
  body: { flex: 1 },
  bodyContent: { padding: 12, alignItems: "center" },
  emptyBox: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyText: { fontSize: 13, color: "#94a3b8" },
});