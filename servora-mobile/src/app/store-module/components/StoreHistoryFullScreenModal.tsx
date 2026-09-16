// ============================================
// SERVORA ERP — StoreHistoryFullScreenModal Component
// ✅ UI-ONLY REDESIGN — professional light-blue/white/navy SaaS ERP
//    visual language (screenshot-matched), replacing the previous
//    bright-yellow/heavy-black-border look.
// 🔒 ZERO business logic changes: date shift math, requiredDate
//    filtering, category filtering, batch allocation fetch
//    (getMovementsByReference), issuedIdsKey staleness key, loading/
//    empty states, onRowPress — all byte-identical to before. Only
//    JSX structure/styles changed.
// ✅ Full-screen wrapper around KitchenRequestTable (Store's daily
//    table): own Modal, own independent date navigator (re-synced to
//    initialDate every time the modal opens), scrollable table body.
// ✅ Own independent category filter dropdown — separate state from
//    the underlying screen's own category filter, reset to "All
//    Categories" every time the modal opens.
// ✅ Batch allocations for the modal's OWN selectedDate's ISSUED
//    requests fetched independently (same getMovementsByReference
//    pattern as useStoreRequests.ts).
// FROZEN
// ============================================

import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { Category } from "../../../modules/inventory-module/types/category";
import { getMovementsByReference } from "../../../modules/stock-movement-module/services/stock-movement-service";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { KitchenRequestTable } from "./KitchenRequestTable";

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

interface StoreHistoryFullScreenModalProps {
  visible:      boolean;
  onClose:      () => void;
  restaurantId: string | null | undefined;
  requests:     IngredientRequest[];
  categories:   Category[];
  initialDate:  string;
  today:        string;
  onRowPress:   (req: IngredientRequest) => void;
}

export function StoreHistoryFullScreenModal({
  visible, onClose, restaurantId, requests, categories, initialDate, today, onRowPress,
}: StoreHistoryFullScreenModalProps) {
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
        {/* ── Page Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBox}>
              <MaterialIcons name="widgets" size={20} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.title}>Stock Issue & Requests — Full View</Text>
              <Text style={styles.subtitle}>View and track all ingredient requests and store issues for the selected date</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color="#1e293b" />
          </TouchableOpacity>
        </View>

        {/* ── Date Navigation + Category Filter ── */}
        <View style={styles.toolbarRow}>
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => setSelectedDate((d) => shiftDate(d, -1))} style={styles.dateNavArrowBtn}>
              <MaterialIcons name="chevron-left" size={20} color="#1e293b" />
            </TouchableOpacity>
            <View style={styles.dateNavBadge}>
              <MaterialIcons name="event" size={15} color="#2563eb" />
              <Text style={styles.dateNavLabel}>{formatDateLabel(selectedDate, today)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
              style={[styles.dateNavArrowBtn, isNextDisabled && styles.dateNavArrowDisabled]}
              disabled={isNextDisabled}
            >
              <MaterialIcons name="chevron-right" size={20} color={isNextDisabled ? "#cbd5e1" : "#1e293b"} />
            </TouchableOpacity>
          </View>

          {categories.length > 0 && (
            <View style={styles.categoryDropdownWrap}>
              <TouchableOpacity style={styles.categoryDropdownButton} onPress={() => setShowCategoryDropdown((v) => !v)}>
                <MaterialIcons name="filter-list" size={16} color="#64748b" />
                <Text style={styles.categoryDropdownButtonText}>{selectedCategoryName}</Text>
                <MaterialIcons name={showCategoryDropdown ? "expand-less" : "expand-more"} size={18} color="#64748b" />
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
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {loadingAllocations ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#2563eb" />
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="inventory-2" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>No requests for this date</Text>
            </View>
          ) : (
            <KitchenRequestTable
              requests={filteredRequests}
              batchAllocationsByRequestId={batchAllocationsByRequestId}
              categories={categories}
              liveDateLabel={formatDateLabel(selectedDate, today)}
              onRowPress={onRowPress}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  // Page header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: Platform.OS === "web" ? 16 : 44,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  headerIconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: "#dbeafe",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0",
    alignItems: "center", justifyContent: "center",
  },

  // Toolbar: date nav + category dropdown
  toolbarRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap",
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    backgroundColor: "#f1f5f9",
  },
  dateNav: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center" },
  dateNavArrowBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center",
  },
  dateNavArrowDisabled: { opacity: 0.4 },
  dateNavBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#dbeafe", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 170, justifyContent: "center",
  },
  dateNavLabel: { fontSize: 13, fontWeight: "800", color: "#1e3a8a" },

  categoryDropdownWrap: { width: 220 },
  categoryDropdownButton: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff",
  },
  categoryDropdownButtonText: { flex: 1, fontSize: 13, color: "#1e293b", fontWeight: "600" },
  categoryDropdownList: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 220, backgroundColor: "#ffffff", width: 220,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6,
  },
  categoryDropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  categoryDropdownItemText: { fontSize: 13, color: "#1e293b" },

  body: { flex: 1 },
  bodyContent: { padding: 12, alignItems: "center" },
  emptyBox: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyText: { fontSize: 13, color: "#94a3b8" },
});