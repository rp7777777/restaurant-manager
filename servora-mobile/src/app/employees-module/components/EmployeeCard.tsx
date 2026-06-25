// ============================================
// SERVORA ERP — EmployeeCard Component
// ✅ activeAllowances — single filter pass
// ✅ allowances?.reduce — crash safe
// ✅ emergencyContact?. — crash safe
// ✅ CONTRACT_TYPE_LABELS — proper display
// ✅ PAYMENT_MODE_LABELS — proper display
// ✅ Initials — RB not just R
// ✅ memo — no unnecessary re-renders
// FROZEN
// ============================================

import React, { memo, useState } from "react";
import {
  View, Text, StyleSheet,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmployeeDB } from "../types/employee-types";
import { getMonthsWorked } from "../utils/employee-calculations";
import { formatTenure, formatDateDMY } from "../utils/employee-formatters";
import { STATUS_COLORS, STATUS_BG_COLORS } from "../constants/employee-status-colors";
import { EMPLOYEE_STATUS_LABELS } from "../constants/employee-status";
import { EMPLOYEE_ROLE_LABELS } from "../constants/employee-roles";
import { CONTRACT_TYPE_LABELS, PAYMENT_MODE_LABELS } from "../constants/contract-types";

interface EmployeeCardProps {
  employee:     EmployeeDB;
  onEdit?:      (emp: EmployeeDB) => void;
  onArchive?:   (emp: EmployeeDB) => void;
  onRestore?:   (emp: EmployeeDB) => void;
  isManager?:   boolean;
  isArchiving?: boolean;
  isRestoring?: boolean;
}

export const EmployeeCard = memo(({
  employee,
  onEdit,
  onArchive,
  onRestore,
  isManager = false,
}: EmployeeCardProps) => {
  const { theme, fmt } = useApp();
  const [expanded, setExpanded] = useState(false);

  const emp         = employee;
  const tenure      = getMonthsWorked(emp.hireDate);
  const statusColor = STATUS_COLORS[emp.status];
  const statusBg    = STATUS_BG_COLORS[emp.status];

  // ✅ Single filter pass
  const activeAllowances = emp.allowances?.filter((a) => a.amount > 0) ?? [];

  // ✅ Crash safe
  const totalAllow = emp.allowances?.reduce((s, a) => s + a.amount, 0) ?? 0;

  // ✅ Initials RB
  const initials = `${emp.firstName?.[0] ?? ""}${emp.lastName?.[0] ?? ""}`.toUpperCase();

  const fullName = `${emp.firstName} ${emp.lastName}`.trim();

  return (
    <View style={[
      styles.card,
      { backgroundColor: theme.card },
      emp.archived && { opacity: 0.6 },
    ]}>

      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={[styles.avatarText, { color: theme.accent }]}>
            {initials}
          </Text>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {fullName}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {EMPLOYEE_STATUS_LABELS[emp.status]}
              </Text>
            </View>
          </View>
          <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
            {emp.employeeNumber} · {EMPLOYEE_ROLE_LABELS[emp.role]}
            {emp.position ? ` · ${emp.position}` : ""}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={[styles.salary, { color: "#10b981" }]}>
            {fmt(emp.monthlySalary)}
          </Text>
          <Text style={[styles.salaryLabel, { color: theme.textSecondary }]}>/mo</Text>
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={20}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded */}
      {expanded && (
        <View style={[styles.expanded, { borderTopColor: theme.border }]}>

          {/* Summary */}
          <View style={styles.summaryRow}>
            {[
              { label: "Hourly",     value: fmt(emp.hourlyRate),                      color: "#3b82f6" },
              { label: "Allowances", value: fmt(totalAllow),                          color: "#f59e0b" },
              { label: "Contract",   value: CONTRACT_TYPE_LABELS[emp.contractType],   color: theme.text },
              { label: "Tenure",     value: formatTenure(tenure),                     color: "#8b5cf6" },
            ].map(({ label, value, color }) => (
              <View key={label} style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
                <Text style={[styles.summaryValue, { color }]}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Details grid */}
          <View style={[styles.detailGrid, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            {[
              { label: "Tax ID",       value: emp.taxId               || "—" },
              { label: "Nat. Ins.",    value: emp.nationalInsuranceId || "—" },
              { label: "Marital",      value: emp.maritalStatus },
              { label: "Dependents",   value: String(emp.dependents)  },
              { label: "Hire Date",    value: formatDateDMY(emp.hireDate) },
              { label: "Daily Hours",  value: `${emp.dailyHours}h`    },
              { label: "Weekly Hours", value: `${emp.weeklyHours}h`   },
              { label: "Payment",      value: PAYMENT_MODE_LABELS[emp.paymentMode] },
              { label: "IBAN",         value: emp.iban                || "Cash" },
              { label: "City",         value: emp.city                || "—"  },
            ].map(({ label, value }) => (
              <View key={label} style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
                <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Allowances */}
          {activeAllowances.length > 0 && (
            <View style={styles.allowances}>
              {activeAllowances.map((a) => (
                <View key={a.id} style={styles.allowanceItem}>
                  <Text style={[styles.allowanceName, { color: theme.text }]}>{a.name}</Text>
                  <Text style={[styles.allowanceAmount, { color: "#3b82f6" }]}>{fmt(a.amount)}</Text>
                  <View style={[styles.taxBadge, { backgroundColor: a.taxable ? "#ef444420" : "#10b98120" }]}>
                    <Text style={{ fontSize: 9, color: a.taxable ? "#ef4444" : "#10b981", fontWeight: "700" }}>
                      {a.taxable ? "TAXED" : "NO TAX"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ✅ Emergency — crash safe */}
          {emp.emergencyContact?.name ? (
            <View style={[styles.emergency, { backgroundColor: "#ef444410", borderColor: "#ef444430" }]}>
              <MaterialIcons name="emergency" size={14} color="#ef4444" />
              <Text style={[styles.emergencyText, { color: theme.textSecondary }]} numberOfLines={1}>
                {emp.emergencyContact?.name} ({emp.emergencyContact?.relationship}) · {emp.emergencyContact?.phone}
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          {isManager && (
            <View style={styles.actions}>
              {!emp.archived && onEdit && (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: theme.primary }]}
                  onPress={() => onEdit(emp)}
                >
                  <MaterialIcons name="edit" size={14} color={theme.primary} />
                  <Text style={[styles.actionText, { color: theme.primary }]}>Edit</Text>
                </TouchableOpacity>
              )}
              {!emp.archived && onArchive && (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: "#f59e0b" }]}
                  onPress={() => onArchive(emp)}
                >
                  <MaterialIcons name="archive" size={14} color="#f59e0b" />
                  <Text style={[styles.actionText, { color: "#f59e0b" }]}>Archive</Text>
                </TouchableOpacity>
              )}
              {emp.archived && onRestore && (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: "#10b981" }]}
                  onPress={() => onRestore(emp)}
                >
                  <MaterialIcons name="unarchive" size={14} color="#10b981" />
                  <Text style={[styles.actionText, { color: "#10b981" }]}>Restore</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card:           { borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  header:         { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  avatar:         { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText:     { fontSize: 16, fontWeight: "900" },
  info:           { flex: 1, minWidth: 0 },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name:           { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  statusBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusText:     { fontSize: 9, fontWeight: "800" },
  sub:            { fontSize: 11, marginTop: 2 },
  right:          { alignItems: "flex-end", gap: 2 },
  salary:         { fontSize: 15, fontWeight: "800" },
  salaryLabel:    { fontSize: 10 },
  expanded:       { padding: 14, paddingTop: 10, borderTopWidth: 1, gap: 10 },
  summaryRow:     { flexDirection: "row" },
  summaryItem:    { flex: 1, alignItems: "center" },
  summaryLabel:   { fontSize: 9, fontWeight: "600", marginBottom: 2 },
  summaryValue:   { fontSize: 11, fontWeight: "800" },
  detailGrid:     { borderRadius: 10, padding: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailItem:     { width: "47%" },
  detailLabel:    { fontSize: 9, fontWeight: "700", marginBottom: 1 },
  detailValue:    { fontSize: 11, fontWeight: "600" },
  allowances:     { gap: 6 },
  allowanceItem:  { flexDirection: "row", alignItems: "center", gap: 8 },
  allowanceName:  { flex: 2, fontSize: 12 },
  allowanceAmount:{ flex: 1, fontSize: 12, fontWeight: "700", textAlign: "right" },
  taxBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  emergency:      { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 8 },
  emergencyText:  { fontSize: 11, flex: 1 },
  actions:        { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn:      { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  actionText:     { fontSize: 12, fontWeight: "600" },
});