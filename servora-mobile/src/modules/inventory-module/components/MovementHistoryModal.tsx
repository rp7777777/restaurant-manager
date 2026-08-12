// ============================================
// SERVORA ERP — MovementHistoryModal Component
// ✅ Full-screen Modal, restaurant-wide movement log — matches the
//    confirmed Attendance-style "Today / grouped by date" pattern.
// ✅ Wraps useStockMovements() (already restaurant-wide, live via
//    the existing subscribeRecentMovements() from
//    stock-movement-module — no new backend code was needed).
// ✅ Movement-type filter chips (All + all 7 StockMovementType
//    values) — tapping one shows ONLY that type, matching the
//    confirmed requirement ("अलग अलग click गरेर हेर्ने").
// ✅ Grouped by date (createdAt's date portion), most-recent date
//    first, movements within a date sorted most-recent first —
//    matches subscribeRecentMovements()'s own createdAt-desc query
//    order, so no client-side re-sort is needed beyond the grouping
//    itself.
// ✅ "Today" label shown for the current date group instead of the
//    raw date string, matching the Attendance module's own
//    Today/date convention. All other dates show as YYYY-MM-DD.
// ✅ Each row shows: item name, quantity change (signed, colored
//    green for increases / red for decreases), before→after, reason
//    (if present), and time (HH:MM).
// ✅ Read-only — no actions on this screen. This is a log/report
//    view, not an editing surface (corrections belong to
//    EditBatchModal, adjustments to StockAdjustmentModal).
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { StockMovement, StockMovementType } from "../../stock-movement-module/types/stock-movement";
import { useStockMovements } from "../hooks/useStockMovements";
import { todayISO } from "../../../utils/date-utils";

interface MovementHistoryModalProps {
  visible:      boolean;
  restaurantId: string;
  onClose:      () => void;
}

type FilterType = "ALL" | StockMovementType;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "ALL",           label: "All" },
  { value: "PURCHASE",      label: "Purchase" },
  { value: "WASTE",         label: "Waste" },
  { value: "TRANSFER_OUT",  label: "Transfer Out" },
  { value: "TRANSFER_IN",   label: "Transfer In" },
  { value: "ADJUSTMENT",    label: "Adjustment" },
  { value: "KITCHEN_ISSUE", label: "Kitchen Issue" },
  { value: "RETURN",        label: "Return" },
];

const MOVEMENT_COLOR: Record<StockMovementType, string> = {
  PURCHASE:      "#059669",
  RETURN:        "#059669",
  TRANSFER_IN:   "#059669",
  KITCHEN_ISSUE: "#dc2626",
  WASTE:         "#dc2626",
  TRANSFER_OUT:  "#dc2626",
  ADJUSTMENT:    "#0369a1",
};

interface DateGroup {
  dateLabel: string;
  movements: StockMovement[];
}

// ── Extract YYYY-MM-DD from a Firestore Timestamp/Date-like
//    createdAt value. Falls back gracefully if createdAt hasn't
//    resolved yet (server timestamp still pending client-side). ──
function movementDateKey(movement: StockMovement): string {
  const raw = movement.createdAt as any;
  if (!raw) return "unknown";
  const date: Date = typeof raw.toDate === "function" ? raw.toDate() : new Date(raw);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function movementTimeLabel(movement: StockMovement): string {
  const raw = movement.createdAt as any;
  if (!raw) return "";
  const date: Date = typeof raw.toDate === "function" ? raw.toDate() : new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MovementHistoryModal({ visible, restaurantId, onClose }: MovementHistoryModalProps) {
  const { movements, loading, error } = useStockMovements(restaurantId);
  const [filter, setFilter] = useState<FilterType>("ALL");

  const today = useMemo(() => todayISO(), []);

  const dateGroups = useMemo<DateGroup[]>(() => {
    const filtered = filter === "ALL" ? movements : movements.filter((m) => m.movementType === filter);

    const byDate = new Map<string, StockMovement[]>();
    for (const movement of filtered) {
      const key = movementDateKey(movement);
      const list = byDate.get(key) ?? [];
      list.push(movement);
      byDate.set(key, list);
    }

    const dateKeys = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a)); // most recent first

    return dateKeys.map((dateKey) => ({
      dateLabel: dateKey === today ? "Today" : dateKey === "unknown" ? "Unknown Date" : dateKey,
      movements: byDate.get(dateKey)!,
    }));
  }, [movements, filter, today]);

  const isEmpty = !loading && dateGroups.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Movement History</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, filter === opt.value && styles.filterChipActive]}
              onPress={() => setFilter(opt.value)}
            >
              <Text style={[styles.filterChipText, filter === opt.value && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {loading ? (
            <Text style={styles.loadingText}>Loading movement history...</Text>
          ) : isEmpty ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt-long" size={40} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No movements recorded yet</Text>
            </View>
          ) : (
            dateGroups.map((group) => (
              <View key={group.dateLabel} style={styles.dateGroup}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{group.dateLabel}</Text>
                </View>

                {group.movements.map((movement) => {
                  const isIncrease = movement.quantityChanged > 0;
                  const color = MOVEMENT_COLOR[movement.movementType];

                  return (
                    <View key={movement.id} style={styles.movementRow}>
                      <View style={styles.movementMain}>
                        <Text style={styles.itemName}>{movement.itemName}</Text>
                        <View style={styles.movementMeta}>
                          <View style={[styles.typeBadge, { backgroundColor: color }]}>
                            <Text style={styles.typeBadgeText}>{movement.movementType.replace("_", " ")}</Text>
                          </View>
                          <Text style={styles.timeText}>{movementTimeLabel(movement)}</Text>
                        </View>
                        {movement.reason && (
                          <Text style={styles.reasonText} numberOfLines={2}>{movement.reason}</Text>
                        )}
                      </View>
                      <View style={styles.movementQty}>
                        <Text style={[styles.qtyChangeText, { color }]}>
                          {isIncrease ? "+" : ""}{movement.quantityChanged} {movement.unit}
                        </Text>
                        <Text style={styles.beforeAfterText}>
                          {movement.beforeQuantity} → {movement.afterQuantity}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  filterScroll: { marginTop: 10 },
  filterScrollContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  filterChipActive: { backgroundColor: "#0369a1" },
  filterChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  filterChipTextActive: { color: "#fff" },
  errorBanner: {
    backgroundColor: "#fef2f2", marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingTop: 10 },
  loadingText: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  dateGroup: { marginBottom: 20 },
  dateHeader: {
    backgroundColor: "#1e293b",
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 6, marginBottom: 8,
  },
  dateHeaderText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  movementRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  movementMain: { flex: 1, gap: 4, marginRight: 12 },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  movementMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff", textTransform: "uppercase" },
  timeText: { fontSize: 11, color: "#94a3b8" },
  reasonText: { fontSize: 11, color: "#64748b", fontStyle: "italic" },
  movementQty: { alignItems: "flex-end", justifyContent: "center" },
  qtyChangeText: { fontSize: 14, fontWeight: "800" },
  beforeAfterText: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
});