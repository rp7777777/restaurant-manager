// ============================================
// SERVORA ERP — MovementHistoryModal Component
// ✅ Full-screen Modal, restaurant-wide movement log.
// ✅ Wraps useStockMovements() (restaurant-wide, live).
// ✅ Movement-type filter chips (All + all 7 StockMovementType
//    values).
// ✅ Attendance-style single-day date navigator — a "< [date] >"
//    navigator (prev/next day arrows around the current date
//    label), showing ONE day's movements at a time. "Today" label
//    shown when the selected date is today; otherwise a formatted
//    date is shown. Defaults to today on open.
// ✅ FIX — shiftDate() rewritten to avoid a real timezone bug: the
//    previous version built a Date via `new Date(dateISO + "T00:00:
//    00")` (LOCAL time) then read the result back via
//    `.toISOString()` (UTC) — for any user whose local timezone
//    offset from UTC is non-zero, that local→UTC conversion could
//    silently roll the date backward or forward by a day, making
//    the "Next" arrow appear to do nothing (or the "Previous"
//    arrow jump two days) depending on the user's offset and the
//    time of day. The fix does ALL arithmetic in UTC from end to
//    end (Date.UTC() to construct, getUTC*() to read back) so no
//    local-timezone offset is ever involved in the calculation —
//    pure calendar day arithmetic, immune to where the user
//    physically is.
// ✅ Compact filter chips (Excel-default-row-height sized, ~20px).
// ✅ Compact movement rows (Excel-default-row-height sized, ~16-18px
//    per row) — many more entries fit on screen without scrolling.
// ✅ Each row shows: item name, quantity change (signed, colored),
//    before→after, movement type, and time (HH:MM).
// ✅ Read-only — no actions on this screen.
// FROZEN
// ============================================

import React, { useMemo, useState, useEffect } from "react";
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

// ── FIX — pure UTC calendar-day arithmetic, no local-timezone
//    offset involved anywhere. See FROZEN header for the bug this
//    replaces. ──
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

export function MovementHistoryModal({ visible, restaurantId, onClose }: MovementHistoryModalProps) {
  const { movements, loading, error } = useStockMovements(restaurantId);
  const [filter, setFilter] = useState<FilterType>("ALL");

  const today = useMemo(() => todayISO(), []);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    if (visible) setSelectedDate(today);
  }, [visible, today]);

  const dayMovements = useMemo(() => {
    const filtered = filter === "ALL" ? movements : movements.filter((m) => m.movementType === filter);
    return filtered.filter((m) => movementDateKey(m) === selectedDate);
  }, [movements, filter, selectedDate]);

  const isEmpty = !loading && dayMovements.length === 0;

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

        <View style={styles.dateNav}>
          <TouchableOpacity
            style={styles.dateNavArrow}
            onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
          >
            <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>{formatDateLabel(selectedDate, today)}</Text>
          <TouchableOpacity
            style={styles.dateNavArrow}
            onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
            disabled={selectedDate >= today}
          >
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={selectedDate >= today ? "#cbd5e1" : "#1e293b"}
            />
          </TouchableOpacity>
        </View>

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
              <MaterialIcons name="receipt-long" size={36} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No movements on this date</Text>
            </View>
          ) : (
            dayMovements.map((movement) => {
              const isIncrease = movement.quantityChanged > 0;
              const color = MOVEMENT_COLOR[movement.movementType];

              return (
                <View key={movement.id} style={styles.movementRow}>
                  <View style={[styles.typeDot, { backgroundColor: color }]} />
                  <Text style={styles.itemName} numberOfLines={1}>{movement.itemName}</Text>
                  <Text style={styles.typeLabel} numberOfLines={1}>{movement.movementType.replace("_", " ")}</Text>
                  <Text style={styles.timeText}>{movementTimeLabel(movement)}</Text>
                  <Text style={[styles.qtyChangeText, { color }]}>
                    {isIncrease ? "+" : ""}{movement.quantityChanged} {movement.unit}
                  </Text>
                  <Text style={styles.beforeAfterText}>
                    {movement.beforeQuantity}→{movement.afterQuantity}
                  </Text>
                </View>
              );
            })
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
  filterScroll: { marginTop: 8, maxHeight: 32 },
  filterScrollContent: { paddingHorizontal: 16, gap: 6, alignItems: "center" },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: "#f1f5f9", height: 24, justifyContent: "center",
  },
  filterChipActive: { backgroundColor: "#0369a1" },
  filterChipText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  filterChipTextActive: { color: "#fff" },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 14, fontWeight: "800", color: "#1e293b", minWidth: 160, textAlign: "center" },
  errorBanner: {
    backgroundColor: "#fef2f2", marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 8,
  },
  errorBannerText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  body: { flex: 1 },
  bodyContent: { padding: 8 },
  loadingText: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 40 },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  movementRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 3, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
    minHeight: 22,
  },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  itemName: { flex: 1.4, fontSize: 12, fontWeight: "700", color: "#1e293b" },
  typeLabel: { flex: 1, fontSize: 10, color: "#64748b", textTransform: "capitalize" },
  timeText: { flex: 0.7, fontSize: 10, color: "#94a3b8" },
  qtyChangeText: { flex: 0.9, fontSize: 12, fontWeight: "800", textAlign: "right" },
  beforeAfterText: { flex: 0.8, fontSize: 10, color: "#94a3b8", textAlign: "right" },
});