// ============================================
// SERVORA ERP — Expense Card Component
// Single expense entry row: name, category, amount, actions
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { ExpenseEntry } from "../types/expense-types";
import { ExpenseCategoryWithSubs } from "../types/category-types";
import { PAYMENT_METHOD_LABELS } from "../constants/expense-payment";

interface ExpenseCardProps {
  expense: ExpenseEntry;
  getCategoryById: (categoryId: string) => ExpenseCategoryWithSubs | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
}

export function ExpenseCard({ expense, getCategoryById, onEdit, onDelete, onToggleLock }: ExpenseCardProps) {
  const { theme, fmt } = useApp();

  const category = getCategoryById(expense.categoryId);
  const subCategory = category?.subCategories.find((s) => s.id === expense.subCategoryId);
  const categoryColor = category?.color ?? theme.textSecondary;

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.left}>
        <Text style={[styles.expenseName, { color: theme.text }]} numberOfLines={1}>
          {expense.expenseName}
        </Text>
        <View style={styles.metaRow}>
          {category && (
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + "18" }]}>
              <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                {category.name}
                {subCategory ? ` · ${subCategory.name}` : ""}
              </Text>
            </View>
          )}
          <Text style={[styles.paymentText, { color: theme.textSecondary }]}>
            {PAYMENT_METHOD_LABELS[expense.paymentMethod]}
          </Text>
        </View>
        {!!expense.note && (
          <Text style={[styles.noteText, { color: theme.textSecondary }]} numberOfLines={1}>
            {expense.note}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, { color: theme.error }]}>{fmt(expense.amount)}</Text>
        <View style={styles.actions}>
          {!expense.locked && (
            <>
              <TouchableOpacity
                onPress={onEdit}
                style={styles.actionButton}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Edit ${expense.expenseName}`}
              >
                <MaterialIcons name="edit" size={16} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.primary }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDelete}
                style={styles.actionButton}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Delete ${expense.expenseName}`}
              >
                <MaterialIcons name="delete-outline" size={16} color={theme.error} />
                <Text style={[styles.actionText, { color: theme.error }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={onToggleLock}
            style={styles.actionButton}
            accessible
            accessibilityRole="button"
            accessibilityLabel={expense.locked ? `Unlock ${expense.expenseName}` : `Lock ${expense.expenseName}`}
          >
            <MaterialIcons
              name={expense.locked ? "lock" : "lock-open"}
              size={16}
              color={expense.locked ? theme.error : theme.textSecondary}
            />
            <Text style={[styles.actionText, { color: expense.locked ? theme.error : theme.textSecondary }]}>
              {expense.locked ? "Unlock" : "Lock"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  left: {
    flex: 1,
    marginRight: 8,
  },
  expenseName: {
    fontSize: 14,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  paymentText: {
    fontSize: 11,
    fontWeight: "600",
  },
  noteText: {
    fontSize: 12,
    marginTop: 4,
  },
  right: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 15,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
    justifyContent: "flex-end",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    padding: 2,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "600",
  },
});