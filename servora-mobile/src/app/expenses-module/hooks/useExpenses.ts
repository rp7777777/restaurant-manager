// ============================================
// SERVORA ERP — useExpenses Hook
// Central state + business logic for the Expense Entry screen
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  subscribeTodayExpenses,
  toggleExpenseLock,
} from "../../../services/expense-service";
import {
  ExpenseEntry,
  ExpensePaymentMethod,
  CreateExpenseInput,
} from "../types/expense-types";
import {
  validateExpenseEntry,
} from "../utils/expense-validation";
import { useTodayISO } from "../../../hooks/useTodayISO";

interface SaveExpenseInput {
  expenseName: string;
  categoryId: string;
  subCategoryId?: string;
  amount: string;
  paymentMethod: ExpensePaymentMethod;
  note?: string;
}

export function useExpenses(categoryHasSubCategories: (categoryId: string) => boolean) {
  const { restaurantId } = useApp();

  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Reactive business date — automatically rolls over at midnight,
  //    even if the app stays open with no user interaction. ──
  const today = useTodayISO();

  // ── Realtime subscription — today's expenses, instant updates ──
  useEffect(() => {
    setError(null);

    if (!restaurantId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeTodayExpenses(
      restaurantId,
      today,
      (data) => {
        setExpenses(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId, today]);

  // ── Save (create or update) ──
  const saveExpense = useCallback(
    async (
      input: SaveExpenseInput,
      editingExpense: ExpenseEntry | null
    ): Promise<{ success: boolean; error?: string }> => {
      if (!restaurantId) {
        return { success: false, error: "Restaurant not configured" };
      }

      // Fast UI feedback only. Service + Firestore Rules remain authoritative
      // for the locked check — this just avoids a round-trip for the common case.
      if (editingExpense?.locked) {
        return { success: false, error: "This expense is locked and cannot be edited" };
      }

      const validation = validateExpenseEntry({
        expenseName: input.expenseName,
        amount: input.amount,
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId,
        categoryHasSubCategories: categoryHasSubCategories(input.categoryId),
      });
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      setSaving(true);
      setError(null);

      try {
        if (editingExpense) {
          await updateExpense(restaurantId, editingExpense.id!, editingExpense, {
            expenseName: input.expenseName,
            categoryId: input.categoryId,
            subCategoryId: input.subCategoryId,
            amount: Number(input.amount),
            paymentMethod: input.paymentMethod,
            note: input.note,
          });
        } else {
          const newExpense: CreateExpenseInput = {
            date: today,
            expenseName: input.expenseName,
            categoryId: input.categoryId,
            subCategoryId: input.subCategoryId,
            amount: Number(input.amount),
            paymentMethod: input.paymentMethod,
            note: input.note,
          };
          await createExpense(restaurantId, newExpense);
        }
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save expense";
        setError(message);
        return { success: false, error: message };
      } finally {
        setSaving(false);
      }
    },
    [restaurantId, today, categoryHasSubCategories]
  );

  // ── Delete ──
  const removeExpense = useCallback(
    async (expense: ExpenseEntry): Promise<{ success: boolean; error?: string }> => {
      if (!restaurantId || !expense.id) {
        return { success: false, error: "Restaurant not configured" };
      }

      // Fast UI feedback only. Service + Firestore Rules remain authoritative.
      if (expense.locked) {
        return { success: false, error: "This expense is locked and cannot be deleted" };
      }

      setError(null);

      try {
        await deleteExpense(restaurantId, expense.id, expense);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete expense";
        setError(message);
        return { success: false, error: message };
      }
    },
    [restaurantId]
  );

  // ── Lock / Unlock (individual entry level) ──
  const toggleLock = useCallback(
    async (expense: ExpenseEntry): Promise<{ success: boolean; error?: string }> => {
      if (!restaurantId || !expense.id) {
        return { success: false, error: "Restaurant not configured" };
      }

      setError(null);

      try {
        await toggleExpenseLock(restaurantId, expense.id, !expense.locked);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update lock";
        setError(message);
        return { success: false, error: message };
      }
    },
    [restaurantId]
  );

  // ── Derived data ──
  const grandTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  return {
    expenses,
    loading,
    saving,
    error,
    today,
    grandTotal,
    saveExpense,
    removeExpense,
    toggleLock,
  };
}