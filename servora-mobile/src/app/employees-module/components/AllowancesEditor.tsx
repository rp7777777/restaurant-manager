// ============================================
// SERVORA ERP — AllowancesEditor Component
// ✅ UUID — Date.now() + random collision safe
// ✅ allowances ?? [] — crash safe
// ✅ memo — no re-renders
// ✅ Theme aware
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo, useCallback } from "react";
import {
  View, Text, StyleSheet,
  TextInput, TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmployeeAllowance } from "../types/employee-types";

interface AllowancesEditorProps {
  allowances: EmployeeAllowance[];
  onChange:   (allowances: EmployeeAllowance[]) => void;
  disabled?:  boolean;
}

export const AllowancesEditor = memo(({
  allowances,
  onChange,
  disabled = false,
}: AllowancesEditorProps) => {
  const { theme } = useApp();

  // ✅ crash safe
  const safeAllowances = allowances ?? [];

  const handleNameChange = useCallback((idx: number, name: string) => {
    const updated = [...safeAllowances];
    updated[idx] = { ...updated[idx], name };
    onChange(updated);
  }, [safeAllowances, onChange]);

  const handleAmountChange = useCallback((idx: number, value: string) => {
    const updated = [...safeAllowances];
    updated[idx] = { ...updated[idx], amount: Number(value) || 0 };
    onChange(updated);
  }, [safeAllowances, onChange]);

  const handleTaxableToggle = useCallback((idx: number) => {
    const updated = [...safeAllowances];
    updated[idx] = { ...updated[idx], taxable: !updated[idx].taxable };
    onChange(updated);
  }, [safeAllowances, onChange]);

  const handleRemove = useCallback((idx: number) => {
    onChange(safeAllowances.filter((_, i) => i !== idx));
  }, [safeAllowances, onChange]);

  const handleAdd = useCallback(() => {
    onChange([
      ...safeAllowances,
      {
        // ✅ collision-safe ID
        id:      `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name:    "",
        amount:  0,
        type:    "MONTHLY",
        taxable: false,
      },
    ]);
  }, [safeAllowances, onChange]);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerText, { flex: 2, color: theme.textSecondary }]}>Name</Text>
        <Text style={[styles.headerText, { flex: 1, color: theme.textSecondary }]}>Amount</Text>
        <Text style={[styles.headerText, { flex: 0.8, color: theme.textSecondary }]}>Tax</Text>
        <Text style={[styles.headerText, { flex: 0.5, color: theme.textSecondary }]}></Text>
      </View>

      {/* Rows */}
      {safeAllowances.map((a, idx) => (
        <View key={a.id} style={styles.row}>
          <TextInput
            style={[
              styles.nameInput,
              { flex: 2, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
            ]}
            value={a.name}
            onChangeText={(v) => handleNameChange(idx, v)}
            placeholder="Allowance name"
            placeholderTextColor={theme.textSecondary}
            editable={!disabled}
          />
          <TextInput
            style={[
              styles.amountInput,
              { flex: 1, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
            ]}
            value={a.amount > 0 ? String(a.amount) : ""}
            onChangeText={(v) => handleAmountChange(idx, v)}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            editable={!disabled}
          />
          <TouchableOpacity
            style={[
              styles.taxBtn,
              { flex: 0.8, backgroundColor: a.taxable ? "#ef444420" : "#10b98120" },
            ]}
            onPress={() => !disabled && handleTaxableToggle(idx)}
            activeOpacity={disabled ? 1 : 0.7}
          >
            <Text style={{ fontSize: 9, fontWeight: "700", color: a.taxable ? "#ef4444" : "#10b981" }}>
              {a.taxable ? "TAXED" : "NO TAX"}
            </Text>
          </TouchableOpacity>
          {!disabled && (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemove(idx)}
            >
              <MaterialIcons name="remove-circle-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Add button */}
      {!disabled && (
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: theme.primary }]}
          onPress={handleAdd}
        >
          <MaterialIcons name="add" size={16} color={theme.primary} />
          <Text style={[styles.addBtnText, { color: theme.primary }]}>
            Add Allowance
          </Text>
        </TouchableOpacity>
      )}

      {/* Empty state */}
      {safeAllowances.length === 0 && (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          No allowances added
        </Text>
      )}

    </View>
  );
});

const styles = StyleSheet.create({
  container:   { gap: 6 },
  header:      { flexDirection: "row", gap: 6, paddingBottom: 4, borderBottomWidth: 1, marginBottom: 2 },
  headerText:  { fontSize: 10, fontWeight: "700" },
  row:         { flexDirection: "row", gap: 6, alignItems: "center" },
  nameInput:   { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12 },
  amountInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12 },
  taxBtn:      { borderRadius: 6, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  removeBtn:   { flex: 0.5, alignItems: "center", justifyContent: "center" },
  addBtn:      { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 9, padding: 10, justifyContent: "center", marginTop: 4 },
  addBtnText:  { fontSize: 13, fontWeight: "700" },
  empty:       { fontSize: 12, textAlign: "center", paddingVertical: 12 },
});