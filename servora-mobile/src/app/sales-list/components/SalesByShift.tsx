// ============================================
// SERVORA ERP — Sales By Shift Component
// Shift-wise breakdown with lock indicator
// ============================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";

interface SaleEntry {
  id?: string;
  shift: string;
  amount: number;
  paymentMethod: string;
  note: string;
  locked: boolean;
  date: string;
}

interface Props {
  sales: SaleEntry[];
  onEdit?: (sale: SaleEntry) => void;
  onDelete?: (sale: SaleEntry) => void;
  isManager?: boolean;
}

const SHIFT_COLORS: Record<string, string> = {
  Morning:   "#f59e0b",
  Afternoon: "#f97316",
  Night:     "#6366f1",
};

const SHIFT_ICONS: Record<string, string> = {
  Morning:   "wb-sunny",
  Afternoon: "wb-twilight",
  Night:     "nights-stay",
};

const PAYMENT_COLORS: Record<string, string> = {
  Cash:        "#10b981",
  Card:        "#3b82f6",
  MBWay:       "#8b5cf6",
  "Uber Eats": "#f97316",
  Glovo:       "#84cc16",
  "Bolt Food": "#06b6d4",
  Other:       "#94a3b8",
};

const SHIFTS = ["Morning", "Afternoon", "Night"];

export default function SalesByShift({ sales, onEdit, onDelete, isManager }: Props) {
  const { theme, fmt } = useApp();

  const getShiftSales = (shift: string) =>
    sales.filter((s) => s.shift === shift);

  const getShiftTotal = (shift: string) =>
    getShiftSales(shift).reduce((sum, s) => sum + Number(s.amount), 0);

  const isShiftLocked = (shift: string) =>
    getShiftSales(shift).some((s) => s.locked);

  return (
    <View style={styles.container}>
      {SHIFTS.map((shift) => {
        const shiftSales = getShiftSales(shift);
        if (shiftSales.length === 0) return null;

        const total = getShiftTotal(shift);
        const locked = isShiftLocked(shift);
        const color = SHIFT_COLORS[shift];
        const icon = SHIFT_ICONS[shift];

        return (
          <View
            key={shift}
            style={[styles.shiftGroup, { backgroundColor: theme.card }]}
          >
            {/* Shift Header */}
            <View style={[styles.shiftHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.shiftHeaderLeft}>
                <View style={[styles.shiftIconBox, { backgroundColor: color + "18" }]}>
                  <MaterialIcons name={icon as any} size={16} color={color} />
                </View>
                <Text style={[styles.shiftName, { color: theme.text }]}>
                  {shift}
                </Text>
                {locked && (
                  <View style={[styles.lockedBadge, { backgroundColor: color + "18" }]}>
                    <MaterialIcons name="lock" size={10} color={color} />
                    <Text style={[styles.lockedText, { color }]}>Locked</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.shiftTotal, { color }]}>
                {fmt(total)}
              </Text>
            </View>

            {/* Entries */}
            {shiftSales.map((sale, idx) => {
              const payColor = PAYMENT_COLORS[sale.paymentMethod] ?? "#94a3b8";
              return (
                <View
                  key={sale.id ?? idx}
                  style={[
                    styles.entryRow,
                    { borderBottomColor: theme.border },
                    idx === shiftSales.length - 1 && styles.lastRow,
                  ]}
                >
                  {/* Left */}
                  <View style={styles.entryLeft}>
                    <View
                      style={[
                        styles.paymentChip,
                        { backgroundColor: payColor + "18" },
                      ]}
                    >
                      <Text style={[styles.paymentChipText, { color: payColor }]}>
                        {sale.paymentMethod}
                      </Text>
                    </View>
                    {sale.note ? (
                      <Text
                        style={[styles.entryNote, { color: theme.textSecondary }]}
                        numberOfLines={1}
                      >
                        {sale.note}
                      </Text>
                    ) : null}
                  </View>

                  {/* Right */}
                  <View style={styles.entryRight}>
                    <Text style={[styles.entryAmount, { color: payColor }]}>
                      {fmt(Number(sale.amount))}
                    </Text>

                    {!sale.locked && (
                      <View style={styles.actions}>
                        {onEdit && (
                          <TouchableOpacity
                            onPress={() => onEdit(sale)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons
                              name="edit"
                              size={15}
                              color={theme.primary}
                            />
                          </TouchableOpacity>
                        )}
                        {onDelete && isManager && (
                          <TouchableOpacity
                            onPress={() => onDelete(sale)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons
                              name="delete"
                              size={15}
                              color="#ef4444"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {sale.locked && (
                      <MaterialIcons name="lock" size={12} color={color} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  shiftGroup: {
    borderRadius: 14,
    overflow: "hidden",
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  shiftHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shiftIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftName: { fontSize: 13, fontWeight: "700" },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedText: { fontSize: 9, fontWeight: "700" },
  shiftTotal: { fontSize: 15, fontWeight: "900" },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  lastRow: { borderBottomWidth: 0 },
  entryLeft: { flex: 1, gap: 3 },
  paymentChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paymentChipText: { fontSize: 11, fontWeight: "700" },
  entryNote: { fontSize: 11 },
  entryRight: { alignItems: "flex-end", gap: 5 },
  entryAmount: { fontSize: 14, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10 },
});