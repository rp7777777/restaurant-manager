// ============================================
// SERVORA ERP — Expense Entry Screen (Controller)
// Composes: TotalExpenseCard, ExpenseCard list, ExpenseForm
// Uses ConfirmModal (cross-platform) instead of Alert.alert()
// FROZEN
// ============================================

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useApp } from "../../../context/AppContext";
import { useExpenses } from "../hooks/useExpenses";
import { useExpenseCategories } from "../hooks/useExpenseCategories";
import { ExpenseEntry, ExpensePaymentMethod } from "../types/expense-types";
import { TotalExpenseCard } from "../components/TotalExpenseCard";
import { ExpenseCard } from "../components/ExpenseCard";
import { ExpenseForm } from "../components/ExpenseForm";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";

type PendingAction =
  | { type: "delete"; expense: ExpenseEntry }
  | { type: "toggleLock"; expense: ExpenseEntry }
  | { type: "editRequest"; expense: ExpenseEntry }
  | {
      type: "saveEdit";
      input: {
        expenseName: string;
        categoryId: string;
        subCategoryId?: string;
        amount: string;
        paymentMethod: ExpensePaymentMethod;
        note?: string;
      };
    }
  | null;

interface ExpenseEntryScreenProps {
  onNavigateToHistory?: () => void;
}

export function ExpenseEntryScreen({ onNavigateToHistory }: ExpenseEntryScreenProps) {
  const { theme } = useApp();

  const {
    categories,
    loading: categoriesLoading,
    getSubCategoriesFor,
    categoryHasSubCategories,
    getCategoryById,
  } = useExpenseCategories();

  const {
    expenses,
    loading: expensesLoading,
    saving,
    error,
    grandTotal,
    saveExpense,
    removeExpense,
    toggleLock,
  } = useExpenses(categoryHasSubCategories);

  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);

  const actionInFlight = useRef(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const formYPosition = useRef(0);
  const scrollToForm = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: formYPosition.current, animated: true });
  }, []);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const closeConfirm = useCallback(() => setPendingAction(null), []);

  // ── Save (create or edit) ──
  const handleSave = useCallback(
    async (input: {
      expenseName: string;
      categoryId: string;
      subCategoryId?: string;
      amount: string;
      paymentMethod: ExpensePaymentMethod;
      note?: string;
    }) => {
      if (saving) return;

      if (editingExpense) {
        setPendingAction({ type: "saveEdit", input });
        return;
      }

      const result = await saveExpense(input, editingExpense);
      if (result.success) {
        setEditingExpense(null);
        setFormResetKey((k) => k + 1);
      } else {
        Alert.alert("Error", result.error ?? "Something went wrong");
      }
    },
    [saveExpense, editingExpense, saving]
  );

  const handleEditRequest = useCallback((expense: ExpenseEntry) => {
    setPendingAction({ type: "editRequest", expense });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingExpense(null);
  }, []);

  const handleDeleteRequest = useCallback((expense: ExpenseEntry) => {
    if (actionInFlight.current) return;
    setPendingAction({ type: "delete", expense });
  }, []);

  const handleToggleLockRequest = useCallback((expense: ExpenseEntry) => {
    if (actionInFlight.current) return;
    setPendingAction({ type: "toggleLock", expense });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;

    if (pendingAction.type === "delete") {
      actionInFlight.current = true;
      closeConfirm();
      try {
        const result = await removeExpense(pendingAction.expense);
        if (!result.success) {
          Alert.alert("Error", result.error ?? "Failed to delete");
        }
      } finally {
        actionInFlight.current = false;
      }
      return;
    }

    if (pendingAction.type === "toggleLock") {
      actionInFlight.current = true;
      closeConfirm();
      try {
        const result = await toggleLock(pendingAction.expense);
        if (!result.success) {
          Alert.alert("Error", result.error ?? "Failed to update lock");
        }
      } finally {
        actionInFlight.current = false;
      }
      return;
    }

    if (pendingAction.type === "editRequest") {
      const expense = pendingAction.expense;
      closeConfirm();
      setEditingExpense(expense);
      setTimeout(scrollToForm, 100);
      return;
    }

    if (pendingAction.type === "saveEdit") {
      closeConfirm();
      const result = await saveExpense(pendingAction.input, editingExpense);
      if (result.success) {
        setEditingExpense(null);
        setFormResetKey((k) => k + 1);
      } else {
        Alert.alert("Error", result.error ?? "Something went wrong");
      }
      return;
    }
  }, [pendingAction, closeConfirm, removeExpense, toggleLock, saveExpense, editingExpense, scrollToForm]);

  const modalConfig = useMemo(() => {
    if (!pendingAction) return null;

    if (pendingAction.type === "delete") {
      return {
        title: "Delete Expense",
        message: "Are you sure you want to delete this expense?",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        destructive: true,
      };
    }

    if (pendingAction.type === "toggleLock") {
      const locked = pendingAction.expense.locked;
      return {
        title: locked ? "Unlock Expense" : "Lock Expense",
        message: locked
          ? "Unlock this expense so it can be edited or deleted again?"
          : "Lock this expense? It won't be editable or deletable until unlocked.",
        confirmLabel: locked ? "Unlock" : "Lock",
        cancelLabel: "Cancel",
        destructive: false,
      };
    }

    if (pendingAction.type === "editRequest") {
      return {
        title: "Edit Expense",
        message: "Are you sure you want to edit this expense?",
        confirmLabel: "Edit",
        cancelLabel: "Cancel",
        destructive: false,
      };
    }

    if (pendingAction.type === "saveEdit") {
      return {
        title: "Update Expense",
        message: "Save changes to this expense?",
        confirmLabel: "Save",
        cancelLabel: "Cancel",
        destructive: false,
      };
    }

    return null;
  }, [pendingAction]);

  const loading = categoriesLoading || expensesLoading;

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.error} />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.text }]}>Expenses</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Restaurant Expense Management
      </Text>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
          <Text style={{ color: theme.error, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      <TotalExpenseCard total={grandTotal} onViewHistory={onNavigateToHistory} />

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Expenses</Text>
      {expenses.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.textSecondary }}>No expenses recorded today</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              getCategoryById={getCategoryById}
              onEdit={() => handleEditRequest(expense)}
              onDelete={() => handleDeleteRequest(expense)}
              onToggleLock={() => handleToggleLockRequest(expense)}
            />
          ))}
        </View>
      )}

      <View onLayout={(e) => { formYPosition.current = e.nativeEvent.layout.y; }}>
        <ExpenseForm
          key={editingExpense?.id ?? `new-${formResetKey}`}
          editingExpense={editingExpense}
          categories={categories}
          getSubCategoriesFor={getSubCategoriesFor}
          saving={saving}
          onSave={handleSave}
          onCancelEdit={handleCancelEdit}
        />
      </View>

      {modalConfig && (
        <ConfirmModal
          visible={!!pendingAction}
          title={modalConfig.title}
          message={modalConfig.message}
          confirmLabel={modalConfig.confirmLabel}
          cancelLabel={modalConfig.cancelLabel}
          destructive={modalConfig.destructive}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 20 },
  errorBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10, marginTop: 4 },
  emptyBox: { borderRadius: 14, padding: 30, alignItems: "center", marginBottom: 16 },
  list: { gap: 8, marginBottom: 16 },
});