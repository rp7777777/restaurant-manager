// ============================================
// SERVORA ERP — EmployeeStats Component
// ✅ Stats display from useEmployeeStats
// ✅ width: "48%" — RN stable
// ✅ memo — no re-renders
// ✅ Theme aware
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmployeeStats } from "../hooks/useEmployeeStats";

interface EmployeeStatsProps {
  stats: EmployeeStats;
}

export const EmployeeStatsBar = memo(({ stats }: EmployeeStatsProps) => {
  const { theme, fmt } = useApp();

  return (
    <View style={styles.container}>

      {/* Row 1 — Counts */}
      <View style={styles.row}>
        {[
          { label: "Total",     value: String(stats.total),     color: theme.text, icon: "people"        },
          { label: "Active",    value: String(stats.active),    color: "#10b981",  icon: "check-circle"  },
          { label: "Probation", value: String(stats.probation), color: "#f59e0b",  icon: "schedule"      },
          { label: "On Leave",  value: String(stats.onLeave),   color: "#3b82f6",  icon: "beach-access"  },
          { label: "Inactive",  value: String(stats.inactive),  color: "#94a3b8",  icon: "pause-circle"  },
          { label: "Archived",  value: String(stats.archived),  color: "#64748b",  icon: "archive"       },
        ].map(({ label, value, color, icon }) => (
          <View key={label} style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name={icon as never} size={18} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Row 2 — Payroll */}
      <View style={[styles.payrollRow, { backgroundColor: theme.card }]}>
        {[
          { label: "Total Payroll",    value: fmt(stats.totalMonthlySalary), color: "#10b981" },
          { label: "Total Gross",      value: fmt(stats.totalGrossSalary),   color: "#f59e0b" },
          { label: "Avg Salary",       value: fmt(stats.averageSalary),      color: "#3b82f6" },
          { label: "Total Allowances", value: fmt(stats.totalAllowances),    color: "#8b5cf6" },
        ].map(({ label, value, color }) => (
          <View key={label} style={styles.payrollItem}>
            <Text style={[styles.payrollValue, { color }]}>{value}</Text>
            <Text style={[styles.payrollLabel, { color: theme.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>

    </View>
  );
});

const styles = StyleSheet.create({
  container:    { gap: 8, marginBottom: 12 },
  row:          { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard:     { flex: 1, minWidth: 80, borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
  statValue:    { fontSize: 16, fontWeight: "900" },
  statLabel:    { fontSize: 9, fontWeight: "600" },
  payrollRow:   { borderRadius: 12, padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // ✅ width: "48%" — RN stable, not minWidth: "45%"
  payrollItem:  { width: "48%", alignItems: "center" },
  payrollValue: { fontSize: 14, fontWeight: "800" },
  payrollLabel: { fontSize: 10, marginTop: 2 },
});