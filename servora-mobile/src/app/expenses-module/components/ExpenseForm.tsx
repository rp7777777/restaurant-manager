// ============================================
// SERVORA ERP — Expense Form Component
// New Entry form: name + category + sub-category + amount + payment + note
// FROZEN
// ============================================

import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { ExpenseEntry, ExpensePaymentMethod } from "../types/expense-types";
import { ExpenseCategoryWithSubs, ExpenseSubCategory } from "../types/category-types";
import { CategoryPicker } from "./CategoryPicker";
import { SubCategoryPicker } from "./SubCategoryPicker";
import { EXPENSE_PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../constants/expense-payment";

interface ExpenseFormProps {
  editingExpense: ExpenseEntry | null;
  categories: ExpenseCategoryWithSubs[];
  getSubCategoriesFor: (categoryId: string) => ExpenseSubCategory[];
  saving: boolean;
  onSave: (input: {
    expenseName: string;
    categoryId: string;
    subCategoryId?: string;
    amount: string;
    paymentMethod: ExpensePaymentMethod;
    note?: string;
  }) => void;
  onCancelEdit: () => void;
}

export function ExpenseForm({
  editingExpense,
  categories,
  getSubCategoriesFor,
  saving,
  onSave,
  onCancelEdit,
}: ExpenseFormProps) {
  const { theme } = useApp();

  const [expenseName, setExpenseName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("CASH");
  const [note, setNote] = useState("");

  // ── Fully controlled by editingExpense prop — edit mode populates, null resets.
  //    Does NOT depend on `categories` — that would re-run and wipe out
  //    in-progress typing every time the realtime category list updates. ──
  useEffect(() => {
    if (editingExpense) {
      setExpenseName(editingExpense.expenseName);
      setCategoryId(editingExpense.categoryId);
      setSubCategoryId(editingExpense.subCategoryId);
      setAmount(String(editingExpense.amount));
      setPaymentMethod(editingExpense.paymentMethod);
      setNote(editingExpense.note ?? "");
    } else {
      setExpenseName("");
      setCategoryId("");
      setSubCategoryId(undefined);
      setAmount("");
      setPaymentMethod("CASH");
      setNote("");
    }
  }, [editingExpense]);

  // ── Separate effect: default to the first category once categories load,
  //    but only for new entries that haven't picked a category yet. ──
  useEffect(() => {
    if (!editingExpense && !categoryId && categories.length > 0) {
      setCategoryId(categories[0].id ?? "");
    }
  }, [categories, editingExpense, categoryId]);

  // ── Reset sub-category whenever the category changes to a different one ──
  const handleCategoryChange = (newCategoryId: string) => {
    setCategoryId(newCategoryId);
    setSubCategoryId(undefined);
  };

  const subCategories = useMemo(
    () => (categoryId ? getSubCategoriesFor(categoryId) : []),
    [categoryId, getSubCategoriesFor]
  );

  const normalizedAmount = amount.trim().replace(/,/g, ".");
  const amountNumber = Number(normalizedAmount);
  const isSaveDisabled =
    saving ||
    expenseName.trim() === "" ||
    !categoryId ||
    (subCategories.length > 0 && !subCategoryId) ||
    amount.trim() === "" ||
    Number.isNaN(amountNumber) ||
    amountNumber <= 0;

  const handleSubmit = () => {
    if (isSaveDisabled) return;

    onSave({
      expenseName: expenseName.trim(),
      categoryId,
      subCategoryId,
      amount: normalizedAmount,
      paymentMethod,
      note: note.trim() || undefined,
    });
  };

  const isEditing = !!editingExpense;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <MaterialIcons
          name={isEditing ? "edit" : "add-circle-outline"}
          size={20}
          color={theme.error}
        />
        <Text style={[styles.headerText, { color: theme.text }]}>
          {isEditing ? "Edit Expense" : "New Expense"}
        </Text>
      </View>

      {/* Expense Name */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Expense Name</Text>
      <TextInput
        style={[
          styles.textInput,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
        value={expenseName}
        onChangeText={setExpenseName}
        placeholder="e.g. Ice delivery"
        placeholderTextColor={theme.textSecondary}
        maxLength={100}
      />

      {/* Category */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Category</Text>
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={handleCategoryChange}
        disabled={isEditing}
      />

      {/* Sub-category (conditional) */}
      {subCategories.length > 0 && (
        <>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Sub-Category</Text>
          <SubCategoryPicker
            subCategories={subCategories}
            value={subCategoryId}
            onChange={setSubCategoryId}
            disabled={isEditing}
          />
        </>
      )}

      {/* Amount */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Amount</Text>
      <View style={[styles.amountRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>€</Text>
        <TextInput
          style={[styles.amountInput, { color: theme.text }]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
      </View>

      {/* Payment Method */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Payment Method</Text>
      <View style={styles.paymentRow}>
        {EXPENSE_PAYMENT_METHODS.map((method) => {
          const isSelected = paymentMethod === method;
          return (
            <TouchableOpacity
              key={method}
              style={[
                styles.paymentChip,
                {
                  backgroundColor: isSelected ? theme.error : theme.surface,
                  borderColor: isSelected ? theme.error : theme.border,
                },
              ]}
              onPress={() => setPaymentMethod(method)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={PAYMENT_METHOD_LABELS[method]}
              accessibilityState={{ selected: isSelected, disabled: saving }}
            >
              <Text style={[styles.paymentChipText, { color: isSelected ? "#ffffff" : theme.text }]}>
                {PAYMENT_METHOD_LABELS[method]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Note (optional) */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>Note (optional)</Text>
      <TextInput
        style={[
          styles.textInput,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Weekly ice delivery"
        placeholderTextColor={theme.textSecondary}
        maxLength={200}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      {/* Actions */}
      <View style={styles.actions}>
        {isEditing && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={onCancelEdit}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={{ color: theme.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.error, opacity: isSaveDisabled ? 0.6 : 1 }]}
          onPress={handleSubmit}
          disabled={isSaveDisabled}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Save edited expense" : "Save expense"}
          accessibilityState={{ disabled: isSaveDisabled }}
        >
          <MaterialIcons name="save" size={18} color="#ffffff" />
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Expense"}
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
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
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
  paymentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  paymentChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  paymentChipText: {
    fontSize: 13,
    fontWeight: "600",
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