// ============================================
// SERVORA ERP — PayrollStatsBar Component
// ✅ Employees, Generated, Paid, Total Net
// ✅ Reuses PayrollSummary
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { PayrollSummary } from "../utils/payroll-summary";

interface Props {
  summary: PayrollSummary;
}

export function PayrollStatsBar({ summary }: Props) {
  const { theme, fmt } = useApp();

  const stats = [
    {
      label: "Employees",
      value: summary.totalEmployees,
      color: "#3b82f6",
    },
    {
      label: "Generated",
      value: summary.generatedCount,
      color: "#f59e0b",
    },
    {
      label: "Paid",
      value: summary.paidCount,
      color: "#10b981",
    },
    {
      label: "Total Net",
      value: fmt(summary.totalNet),
      color: "#FFD700",
    },
  ];

  return (
    <View style={[
      styles.container,
      {
        backgroundColor:   theme.card,
        borderBottomColor: theme.border,
      },
    ]}>
      {stats.map(({ label, value, color }) => (
        <View key={label} style={styles.item}>
          <Text style={[styles.value, { color }]} numberOfLines={1}>
            {value}
          </Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   "row",
    padding:         10,
    borderBottomWidth: 1,
    gap:             8,
  },
  item:  { flex: 1, alignItems: "center" },
  value: { fontSize: 14, fontWeight: "900" },
  label: { fontSize: 9,  fontWeight: "600", marginTop: 2 },
});