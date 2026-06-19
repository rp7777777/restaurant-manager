// ============================================
// SERVORA ERP — StatsBar Component
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";

interface Props {
  employeeCount: number;
  totalOT: number;
  totalAbsent: number;
}

export function StatsBar({ employeeCount, totalOT, totalAbsent }: Props) {
  const { theme } = useApp();

  const stats = [
    { label: "Employees", value: employeeCount,      color: "#3b82f6" },
    { label: "Total OT",  value: totalOT.toFixed(1), color: "#f59e0b" },
    { label: "Absences",  value: totalAbsent,         color: "#ef4444" },
  ];

  return (
    <View style={[
      styles.container,
      { backgroundColor: theme.card, borderBottomColor: theme.border }
    ]}>
      {stats.map(({ label, value, color }) => (
        <View key={label} style={styles.item}>
          <Text style={[styles.value, { color }]}>{value}</Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    gap: 16,
  },
  item:  { alignItems: "center" },
  value: { fontSize: 16, fontWeight: "900" },
  label: { fontSize: 9, fontWeight: "600", marginTop: 2 },
});