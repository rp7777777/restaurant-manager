// ============================================
// SERVORA ERP — SalaryPreview Component
// ✅ Single-pass allowances reduce
// ✅ safeMonthlySalary — NaN protection
// ✅ Settings-aware — tax/ss from context
// ✅ memo — no re-renders
// ✅ Theme aware
// FROZEN
// ============================================

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { EmployeeAllowance } from "../types/employee-types";

interface SalaryPreviewProps {
  monthlySalary: number;
  allowances:    EmployeeAllowance[];
  taxRate?:      number;
  ssRate?:       number;
}

export const SalaryPreview = memo(({
  monthlySalary,
  allowances,
  taxRate,
  ssRate,
}: SalaryPreviewProps) => {
  const { theme, fmt, defaultTaxRate, defaultSSRate } = useApp();

  const effectiveTaxRate = taxRate ?? defaultTaxRate;
  const effectiveSSRate  = ssRate  ?? defaultSSRate;

  // ✅ NaN protection
  const safeMonthlySalary = Number(monthlySalary) || 0;

  // ✅ Single-pass allowances
  const summary = allowances.reduce(
    (acc, a) => {
      if (a.amount <= 0) return acc;
      acc.active.push(a);
      if (a.taxable) {
        acc.taxable += a.amount;
      } else {
        acc.nonTaxable += a.amount;
      }
      return acc;
    },
    { taxable: 0, nonTaxable: 0, active: [] as EmployeeAllowance[] }
  );

  const grossSalary     = safeMonthlySalary + summary.taxable + summary.nonTaxable;
  const taxAmount       = ((safeMonthlySalary + summary.taxable) * effectiveTaxRate) / 100;
  const ssAmount        = (safeMonthlySalary * effectiveSSRate) / 100;
  const totalDeductions = taxAmount + ssAmount;
  const netSalary       = grossSalary - totalDeductions;

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <Text style={[styles.title, { color: theme.accent }]}>
        Monthly Salary Preview
      </Text>

      {/* Basic salary */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: "rgba(255,255,255,0.7)" }]}>
          Basic Salary
        </Text>
        <Text style={[styles.value, { color: theme.accent }]}>
          {fmt(safeMonthlySalary)}
        </Text>
      </View>

      {/* Allowances */}
      {summary.active.map((a) => (
        <View key={a.id} style={styles.row}>
          <Text style={[styles.label, { color: "rgba(255,255,255,0.7)" }]}>
            {a.name}{a.taxable ? " (taxed)" : ""}
          </Text>
          <Text style={[styles.value, { color: "#10b981" }]}>
            {fmt(a.amount)}
          </Text>
        </View>
      ))}

      {/* Gross */}
      <View style={[styles.row, styles.divider]}>
        <Text style={[styles.label, { color: theme.accent, fontWeight: "800" }]}>
          GROSS
        </Text>
        <Text style={[styles.value, { color: theme.accent, fontSize: 16 }]}>
          {fmt(grossSalary)}
        </Text>
      </View>

      {/* Deductions */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: "rgba(255,255,255,0.7)" }]}>
          Tax ({effectiveTaxRate}%)
        </Text>
        <Text style={[styles.value, { color: "#ef4444" }]}>
          -{fmt(taxAmount)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: "rgba(255,255,255,0.7)" }]}>
          Social Security ({effectiveSSRate}%)
        </Text>
        <Text style={[styles.value, { color: "#ef4444" }]}>
          -{fmt(ssAmount)}
        </Text>
      </View>

      {/* Net */}
      <View style={[styles.row, styles.divider]}>
        <Text style={[styles.label, { color: "#10b981", fontWeight: "800" }]}>
          EST. NET
        </Text>
        <Text style={[styles.value, { color: "#10b981", fontSize: 15 }]}>
          {fmt(netSalary)}
        </Text>
      </View>

      {/* Settings note */}
      {(taxRate === undefined || ssRate === undefined) && (
        <Text style={[styles.note, { color: "rgba(255,255,255,0.4)" }]}>
          * Using settings default rates
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { borderRadius: 14, padding: 14 },
  title:     { fontSize: 12, fontWeight: "800", marginBottom: 10 },
  row:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label:     { fontSize: 12 },
  value:     { fontSize: 12, fontWeight: "700" },
  divider:   { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", marginTop: 6, paddingTop: 6 },
  note:      { fontSize: 10, marginTop: 8, textAlign: "right" },
});