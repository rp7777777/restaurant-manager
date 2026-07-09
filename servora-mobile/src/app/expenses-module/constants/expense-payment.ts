// ============================================
// SERVORA ERP — Expense Payment Method Constants
// Single source of truth for accepted expense payment methods
// ============================================

import { ExpensePaymentMethod } from "../types/expense-types";

export const EXPENSE_PAYMENT_METHODS: readonly ExpensePaymentMethod[] = [
  "CASH",
  "CARD",
  "BANK",
  "OTHER",
] as const;

export const PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK: "Bank",
  OTHER: "Other",
};