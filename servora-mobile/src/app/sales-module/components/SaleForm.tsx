// ============================================
// SERVORA ERP — Sale Form Component
// New Entry form: shift + amount + payment + entry name
// ============================================

import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { SaleEntry, Shift, PaymentMethod } from "../types/sales-types";
import { ShiftPicker } from "./ShiftPicker";
import { PaymentPicker } from "./PaymentPicker";

interface SaleFormProps {
  editingSale: SaleEntry | null;
  defaultShift: Shift;
  saving: boolean;
  onSave: (input: {
    shift: Shift;
    amount: string;
    paymentMethod: PaymentMethod;
    entryName: string;
  }) => void;
  onCancelEdit: () => void;
}

export function SaleForm({
  editingSale,
  defaultShift,
  saving,
  onSave,
  onCancelEdit,
}: SaleFormProps) {
  const { theme, t } = useApp();

  const [shift, setShift] = useState<Shift>(defaultShift);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [entryName, setEntryName] = useState("");

  // ── Fully controlled by editingSale prop — edit mode populates, null resets ──
  useEffect(() => {
    if (editingSale) {
      setShift(editingSale.shift);
      setAmount(String(editingSale.amount));
      setPaymentMethod(editingSale.paymentMethod);
      setEntryName(editingSale.entryName ?? "");
    } else {
      setShift(defaultShift);
      setAmount("");
      setPaymentMethod("Cash");
      setEntryName("");
    }
  }, [editingSale, defaultShift]);

  const handleSubmit = () => {
    onSave({ shift, amount, paymentMethod, entryName });
  };

  const isEditing = !!editingSale;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <MaterialIcons
          name={isEditing ? "edit" : "add-circle-outline"}
          size={20}
          color={theme.primary}
        />
        <Text style={[styles.headerText, { color: theme.text }]}>
          {isEditing ? t.editEntry ?? "Edit Entry" : t.newEntry ?? "New Entry"}
        </Text>
      </View>

      {/* Shift */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {t.shift ?? "Shift"}
      </Text>
      <ShiftPicker value={shift} onChange={setShift} disabled={isEditing} />

      {/* Amount */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {t.amount ?? "Amount"}
      </Text>
      <View style={[styles.amountRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>€</Text>
        <TextInput
          style={[styles.amountInput, { color: theme.text }]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      {/* Payment Method */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {t.paymentMethod ?? "Payment Method"}
      </Text>
      <PaymentPicker value={paymentMethod} onChange={setPaymentMethod} />

      {/* Entry Name (was Note) — optional */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {t.entryName ?? "Entry Name"} ({t.noteOptional ?? "optional"})
      </Text>
      <TextInput
        style={[
          styles.entryNameInput,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
        value={entryName}
        onChangeText={setEntryName}
        placeholder={t.entryNamePlaceholder ?? "e.g. Lunch rush, Delivery batch..."}
        placeholderTextColor={theme.textSecondary}
        maxLength={100}
      />

      {/* Actions */}
      <View style={styles.actions}>
        {isEditing && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={onCancelEdit}
          >
            <Text style={{ color: theme.textSecondary }}>{t.cancel ?? "Cancel"}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <MaterialIcons name="save" size={18} color="#ffffff" />
          <Text style={styles.saveButtonText}>
            {saving ? (t.saving ?? "Saving...") : (t.saveSale ?? "Save Sale")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "700",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  entryNameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});