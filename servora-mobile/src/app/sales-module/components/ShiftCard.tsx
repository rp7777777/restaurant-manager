// ============================================
// SERVORA ERP — Shift Card Component
// Full shift UI: header, total, breakdown, lock, entries
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { SaleEntry, Shift, PaymentMethod } from "../types/sales-types";
import { SHIFT_ICONS } from "../constants/shifts";
import { SHIFT_COLORS, SHIFT_TINT_BG } from "../constants/shift-colors";
import { SaleEntryCard } from "./SaleEntryCard";
import { EmptyState } from "./EmptyState";

interface ShiftCardProps {
  shift: Shift;
  entries: SaleEntry[];
  total: number;
  paymentBreakdown: Partial<Record<PaymentMethod, number>>;
  locked: boolean;
  onToggleLock: () => void;
  onEditEntry: (entry: SaleEntry) => void;
  onDeleteEntry: (entry: SaleEntry) => void;
}

export function ShiftCard({
  shift,
  entries,
  total,
  paymentBreakdown,
  locked,
  onToggleLock,
  onEditEntry,
  onDeleteEntry,
}: ShiftCardProps) {
  const { theme, t, fmt } = useApp();

  const color = SHIFT_COLORS[shift];
  const tintBg = SHIFT_TINT_BG[shift];
  const shiftKey = shift.toLowerCase() as "morning" | "afternoon" | "night";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tintBg, borderColor: theme.border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconCircle, { backgroundColor: color }]}>
            <MaterialIcons name={SHIFT_ICONS[shift]} size={18} color="#ffffff" />
          </View>
          <View>
            <Text style={[styles.shiftName, { color: theme.text }]}>
              {t(shiftKey)}
            </Text>
            <Text style={[styles.entryCount, { color: theme.textSecondary }]}>
              {entries.length} {entries.length === 1 ? t("entry") : t("entries")}
            </Text>
          </View>
        </View>
        <Text style={[styles.total, { color }]}>{fmt(total)}</Text>
      </View>

      {/* Payment breakdown */}
      {entries.length > 0 && (
        <View style={styles.breakdownRow}>
          {Object.entries(paymentBreakdown).map(([method, amount]) => (
            <View key={method} style={[styles.breakdownChip, { backgroundColor: theme.surface }]}>
              <Text style={[styles.breakdownText, { color: theme.textSecondary }]}>
                {method}: {fmt(amount ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Entries list — or empty state */}
      {entries.length > 0 ? (
        <View style={styles.entriesList}>
          {entries.map((entry) => (
            <SaleEntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => onEditEntry(entry)}
              onDelete={() => onDeleteEntry(entry)}
            />
          ))}
        </View>
      ) : (
        <EmptyState />
      )}

      {/* Lock/Unlock */}
      <TouchableOpacity
        style={[
          styles.lockButton,
          {
            borderColor: locked ? theme.error : theme.border,
            backgroundColor: locked ? `${theme.error}15` : theme.surface,
          },
        ]}
        onPress={onToggleLock}
      >
        <MaterialIcons
          name={locked ? "lock" : "lock-open"}
          size={16}
          color={locked ? theme.error : theme.textSecondary}
        />
        <Text style={[styles.lockText, { color: locked ? theme.error : theme.textSecondary }]}>
          {locked ? t("locked") : t("lockShift")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftName: {
    fontSize: 15,
    fontWeight: "700",
  },
  entryCount: {
    fontSize: 12,
    marginTop: 2,
  },
  total: {
    fontSize: 18,
    fontWeight: "800",
  },
  breakdownRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  breakdownChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  breakdownText: {
    fontSize: 11,
    fontWeight: "600",
  },
  entriesList: {
    marginTop: 12,
    gap: 8,
  },
  lockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  lockText: {
    fontSize: 13,
    fontWeight: "600",
  },
});