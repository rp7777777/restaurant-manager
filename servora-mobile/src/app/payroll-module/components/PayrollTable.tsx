// ============================================
// SERVORA ERP — PayrollTable Component
// ✅ Payroll list with status badges
// ✅ Tap to open detail
// ✅ Empty state
// ============================================

import React from "react";
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { PayrollDocument } from "../types/payroll-types";
import { PayrollStatusBadge } from "./PayrollStatusBadge";

interface Props {
  payrolls: PayrollDocument[];
  onSelect: (payroll: PayrollDocument) => void;
}

export function PayrollTable({ payrolls, onSelect }: Props) {
  const { theme, fmt } = useApp();

  if (payrolls.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <MaterialIcons name="payments" size={40} color={theme.textSecondary} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          No payroll found
        </Text>
        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
          Generate payroll to begin
        </Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Table header */}
      <View style={[styles.tableHead, { backgroundColor: "#00154f" }]}>
        <Text style={[styles.th, { width: 50 }]}>NO</Text>
        <Text style={[styles.th, { flex: 1 }]}>NAME</Text>
        <Text style={[styles.th, { width: 75 }]}>BASIC</Text>
        <Text style={[styles.th, { width: 75 }]}>NET</Text>
        <Text style={[styles.th, { width: 80 }]}>STATUS</Text>
      </View>

      {payrolls.map((p, idx) => (
        <TouchableOpacity
          key={p.id}
          style={[
            styles.row,
            {
              backgroundColor:  idx % 2 === 0 ? theme.card : theme.bg,
              borderBottomColor: theme.border,
            },
          ]}
          onPress={() => onSelect(p)}
        >
          <Text style={[styles.tdNo, { color: theme.textSecondary }]}>
            {p.employeeNo}
          </Text>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.tdName, { color: theme.text }]}
              numberOfLines={1}
            >
              {p.employeeName}
            </Text>
            <Text
              style={[styles.tdSub, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {p.position}
            </Text>
          </View>
          <Text style={[styles.tdBasic, { color: theme.text }]}>
            {fmt(p.snapshot?.basicSalary ?? 0)}
          </Text>
          <Text style={[styles.tdNet, { color: "#10b981" }]}>
            {fmt(p.calculation?.netSalary ?? 0)}
          </Text>
          <View style={{ width: 80 }}>
            <PayrollStatusBadge status={p.payrollStatus} size="sm" />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyBox:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptySub:   { fontSize: 13 },
  tableHead: {
    flexDirection:   "row",
    alignItems:      "center",
    paddingVertical:   8,
    paddingHorizontal: 12,
  },
  th: { color: "#FFD700", fontSize: 9, fontWeight: "800" },
  row: {
    flexDirection:   "row",
    alignItems:      "center",
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  tdNo:    { width: 50, fontSize: 11 },
  tdName:  { fontSize: 12, fontWeight: "700" },
  tdSub:   { fontSize: 10, marginTop: 1 },
  tdBasic: { width: 75, fontSize: 11 },
  tdNet:   { width: 75, fontSize: 12, fontWeight: "700" },
});