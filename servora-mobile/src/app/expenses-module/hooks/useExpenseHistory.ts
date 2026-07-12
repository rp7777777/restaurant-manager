// ============================================
// SERVORA ERP — useExpenseHistory Hook
// Central state + business logic for Expense History screen
// FROZEN
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { subscribeExpensesForYear } from "../services/expense-history-service";
import { updateExpense, deleteExpense, toggleExpenseLock } from "../../../services/expense-service";
import {
  filterExpensesByMonth,
  groupExpensesByDay,
  buildExpenseDayTotals,
  sumExpenseAmounts,
  buildExpenseMonthlySummary,
} from "../utils/expense-grouping";
import { validateExpenseEntry } from "../utils/expense-validation";
import { ExpenseEntry, ExpensePaymentMethod } from "../types/expense-types";

export function useExpenseHistory(
  selectedYear: number,
  categoryHasSubCategories: (categoryId: string) => boolean
) {
  const { restaurantId } = useApp();

  const [allExpenses, setAllExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ── Edit state ──
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Delete confirmation state — drives a shared ConfirmModal in the UI ──
  const [pendingDelete, setPendingDelete] = useState<ExpenseEntry | null>(null);

  // ── Lock/Unlock confirmation state ──
  const [pendingLockToggle, setPendingLockToggle] = useState<ExpenseEntry | null>(null);

  // ── Realtime subscription — expenses for the selected year ──
  useEffect(() => {
    if (!restaurantId) {
      setAllExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHistoryError(null);
    const unsub = subscribeExpensesForYear(
      restaurantId,
      selectedYear,
      (data) => {
        setAllExpenses(data);
        setLoading(false);
      },
      (err) => {
        setHistoryError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [restaurantId, selectedYear]);

  // ── Derived data ──
  const monthExpenses = useMemo(
    () => filterExpensesByMonth(allExpenses, selectedMonth, selectedYear),
    [allExpenses, selectedMonth, selectedYear]
  );

  const dayMap = useMemo(() => groupExpensesByDay(monthExpenses), [monthExpenses]);

  const dayTotals = useMemo(() => buildExpenseDayTotals(dayMap), [dayMap]);

  const monthlyTotal = useMemo(() => sumExpenseAmounts(monthExpenses), [monthExpenses]);

  const monthlySummary = useMemo(
    () => buildExpenseMonthlySummary(allExpenses, selectedYear),
    [allExpenses, selectedYear]
  );

  const yearTotal = useMemo(
    () => monthlySummary.reduce((sum, m) => sum + m.total, 0),
    [monthlySummary]
  );

  const selectedDayExpenses = useMemo(
    () => (selectedDay ? (dayMap[selectedDay] ?? []) : []),
    [selectedDay, dayMap]
  );

  const selectedDayTotal = useMemo(() => sumExpenseAmounts(selectedDayExpenses), [selectedDayExpenses]);

  // ── Month / day selection ──
  const selectMonth = useCallback((month: number) => {
    setSelectedMonth(month);
    setSelectedDay(null);
  }, []);

  const selectDay = useCallback((date: string) => {
    setSelectedDay((prev) => (prev === date ? null : date));
  }, []);

  // ── Edit flow — locked entries can't even be requested for edit ──
  const requestEdit = useCallback((expense: ExpenseEntry) => {
    if (expense.locked) return;
    setEditingExpense(expense);
    setEditError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingExpense(null);
    setEditError(null);
  }, []);

  const confirmEdit = useCallback(
    async (input: {
      expenseName: string;
      categoryId: string;
      subCategoryId?: string;
      amount: string;
      paymentMethod: ExpensePaymentMethod;
      note?: string;
    }) => {
      if (!editingExpense || !editingExpense.id || !restaurantId) return;

      // Defensive normalization — ExpenseForm already normalizes commas,
      // but this guards against any future caller that doesn't.
      const normalizedAmount = input.amount.trim().replace(/,/g, ".");

      // Same validation rules as today's Expense Entry screen —
      // keeps History edits and today's entries consistent.
      const validation = validateExpenseEntry({
        expenseName: input.expenseName,
        amount: normalizedAmount,
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId,
        categoryHasSubCategories: categoryHasSubCategories(input.categoryId),
      });
      if (!validation.valid) {
        setEditError(validation.error ?? "Invalid input");
        return;
      }

      setSavingEdit(true);
      setEditError(null);
      try {
        await updateExpense(restaurantId, editingExpense.id, editingExpense, {
          expenseName: input.expenseName,
          categoryId: input.categoryId,
          subCategoryId: input.subCategoryId,
          amount: Number(normalizedAmount),
          paymentMethod: input.paymentMethod,
          note: input.note,
        });
        setEditingExpense(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update expense";
        setEditError(message);
      } finally {
        setSavingEdit(false);
      }
    },
    [editingExpense, restaurantId, categoryHasSubCategories]
  );

  // ── Delete flow — locked entries can't even be requested for delete ──
  const requestDelete = useCallback((expense: ExpenseEntry) => {
    if (expense.locked) return;
    setPendingDelete(expense);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const confirmDelete = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!pendingDelete || !pendingDelete.id || !restaurantId) {
      return { success: false, error: "Restaurant not configured" };
    }

    const expense = pendingDelete;
    setPendingDelete(null);

    try {
      await deleteExpense(restaurantId, expense.id!, expense);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete expense";
      return { success: false, error: message };
    }
  }, [pendingDelete, restaurantId]);

  // ── Lock/Unlock flow ──
  const requestLockToggle = useCallback((expense: ExpenseEntry) => {
    setPendingLockToggle(expense);
  }, []);

  const cancelLockToggle = useCallback(() => {
    setPendingLockToggle(null);
  }, []);

  const confirmLockToggle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!pendingLockToggle || !pendingLockToggle.id || !restaurantId) {
      return { success: false, error: "Restaurant not configured" };
    }

    const expense = pendingLockToggle;
    setPendingLockToggle(null);

    try {
      await toggleExpenseLock(restaurantId, expense.id!, !expense.locked);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update lock";
      return { success: false, error: message };
    }
  }, [pendingLockToggle, restaurantId]);

  return {
    loading,
    historyError,
    selectedMonth,
    selectedDay,
    dayTotals,
    monthlyTotal,
    monthExpenses,
    monthlySummary,
    yearTotal,
    selectedDayExpenses,
    selectedDayTotal,
    selectMonth,
    selectDay,

    editingExpense,
    savingEdit,
    editError,
    requestEdit,
    cancelEdit,
    confirmEdit,

    pendingDelete,
    requestDelete,
    cancelDelete,
    confirmDelete,

    pendingLockToggle,
    requestLockToggle,
    cancelLockToggle,
    confirmLockToggle,
  };
}