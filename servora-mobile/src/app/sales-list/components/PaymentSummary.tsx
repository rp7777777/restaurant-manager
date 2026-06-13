// ============================================
// SERVORA ERP — Payment Summary Component
// Alag-alag payment method totals
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";

interface SaleEntry {
  shift: string;
  amount: number;
  paymentMethod: string;
  locked: boolean;
}

interface Props {
  sales: SaleEntry[];
}

const PAYMENT_COLORS: Record<string, string> = {
  Cash:       "#10b981",
  Card:       "#3b82f6",
  MBWay:      "#8b5cf6",
  "Uber Eats":"#f97316",
  Glovo:      "#84cc16",
  "Bolt Food":"#06b6d4",
  Other:      "#94a3b8",
};

const PAYMENT_ICONS: Record<string, string> = {
  Cash:       "payments",
  Card:       "credit-card",
  MBWay:      "phone-android",
  "Uber Eats":"delivery-dining",
  Glovo:      "two-wheeler",
  "Bolt Food":"electric-scooter",
  Other:      "more-horiz",
};

export default function PaymentSummary({ sales }: Props) {
  const { theme, fmt } = useApp();

  // Group by payment method
  const summary: Record<string, number> = {};
  sales.forEach((s) => {
    summary[s.paymentMethod] = (summary[s.paymentMethod] ?? 0) + Number(s.amount);
  });

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Payment Breakdown
      </Text>

      {entries.map(([method, amount]) => {
        const color = PAYMENT_COLORS[method] ?? "#94a3b8";
        const icon = PAYMENT_ICONS[method] ?? "payment";
        const pct = total > 0 ? (amount / total) * 100 : 0;

        return (
          <View key={method} style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: color + "18" }]}>
              <MaterialIcons name={icon as any} size={16} color={color} />
            </View>
            <View style={styles.rowMiddle}>
              <Text style={[styles.methodName, { color: theme.text }]}>
                {method}
              </Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%` as any, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.amount, { color }]}>{fmt(amount)}</Text>
              <Text style={[styles.pct, { color: theme.textSecondary }]}>
                {pct.toFixed(0)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* Total */}
      <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
          Total
        </Text>
        <Text style={[styles.totalValue, { color: "#10b981" }]}>
          {fmt(total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMiddle: { flex: 1, gap: 4 },
  methodName: { fontSize: 12, fontWeight: "600" },
  barBg: {
    height: 4,
    backgroundColor: "rgba(150,150,150,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: { height: 4, borderRadius: 2 },
  rowRight: { alignItems: "flex-end", gap: 1 },
  amount: { fontSize: 13, fontWeight: "800" },
  pct: { fontSize: 10 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 13, fontWeight: "600" },
  totalValue: { fontSize: 16, fontWeight: "900" },
});