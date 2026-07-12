// ============================================
// SERVORA ERP — Expense Day Detail Component
// Expanded view for a selected day: expense list + category summary
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { ExpenseEntry } from "../types/expense-types";
import { ExpenseCategoryWithSubs } from "../types/category-types";
import { formatShortExpenseDate } from "../utils/expense-date";
import { ExpenseCard } from "./ExpenseCard";
import { ExpenseSummary } from "./ExpenseSummary";

interface ExpenseDayDetailProps {
  date: string;
  expenses: ExpenseEntry[];
  total: number;
  getCategoryById: (categoryId: string) => ExpenseCategoryWithSubs | undefined;
  onEdit: (expense: ExpenseEntry) => void;
  onDelete: (expense: ExpenseEntry) => void;
  onToggleLock: (expense: ExpenseEntry) => void;
  onLayout?: (y: number) => void;
}

export function ExpenseDayDetail({
  date,
  expenses,
  total,
  getCategoryById,
  onEdit,
  onDelete,
  onToggleLock,
  onLayout,
}: ExpenseDayDetailProps) {
  const { theme, fmt } = useApp();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface }]}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>
            {formatShortExpenseDate(date)}
          </Text>
          <Text style={[styles.count, { color: theme.textSecondary }]}>
            {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </Text>
        </View>
        <Text style={[styles.total, { color: theme.error }]}>
          {fmt(total)}
        </Text>
      </View>

      <View style={styles.list}>
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            getCategoryById={getCategoryById}
            onEdit={() => onEdit(expense)}
            onDelete={() => onDelete(expense)}
            onToggleLock={() => onToggleLock(expense)}
          />
        ))}
      </View>

      <ExpenseSummary expenses={expenses} getCategoryById={getCategoryById} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  count: {
    fontSize: 11,
    marginTop: 2,
  },
  total: {
    fontSize: 18,
    fontWeight: "900",
  },
  list: {
    gap: 8,
  },
});