// ============================================
// SERVORA ERP — Expense Summary Component
// Category-wise breakdown for a set of expenses
// FROZEN
// ============================================

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { ExpenseEntry } from "../types/expense-types";
import { ExpenseCategoryWithSubs } from "../types/category-types";

interface ExpenseSummaryProps {
  expenses: ExpenseEntry[];
  getCategoryById: (categoryId: string) => ExpenseCategoryWithSubs | undefined;
}

interface CategoryBreakdownEntry {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
}

export function ExpenseSummary({ expenses, getCategoryById }: ExpenseSummaryProps) {
  const { theme, fmt } = useApp();

  const { breakdown, grandTotal } = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      totals[e.categoryId] = (totals[e.categoryId] ?? 0) + Number(e.amount ?? 0);
    });

    const total = Object.values(totals).reduce((sum, v) => sum + v, 0);

    const entries: CategoryBreakdownEntry[] = Object.entries(totals)
      .map(([categoryId, categoryTotal]) => {
        const category = getCategoryById(categoryId);
        return {
          categoryId,
          name: category?.name ?? "Uncategorized",
          color: category?.color ?? theme.textSecondary,
          total: categoryTotal,
          percentage: total > 0 ? (categoryTotal / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return { breakdown: entries, grandTotal: total };
  }, [expenses, getCategoryById, theme.textSecondary]);

  if (expenses.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>
        Category Breakdown
      </Text>

      {breakdown.map((entry) => (
        <View key={entry.categoryId} style={styles.row}>
          <View style={styles.left}>
            <View style={[styles.dot, { backgroundColor: entry.color }]} />
            <Text style={[styles.name, { color: theme.text }]}>{entry.name}</Text>
          </View>
          <View style={styles.right}>
            <Text style={[styles.amount, { color: entry.color }]}>{fmt(entry.total)}</Text>
            <Text style={[styles.percentage, { color: theme.textSecondary }]}>
              {entry.percentage.toFixed(0)}%
            </Text>
          </View>
        </View>
      ))}

      <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total</Text>
        <Text style={[styles.totalValue, { color: theme.error }]}>{fmt(grandTotal)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: "500",
  },
  right: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 13,
    fontWeight: "700",
  },
  percentage: {
    fontSize: 10,
    marginTop: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "900",
  },
});