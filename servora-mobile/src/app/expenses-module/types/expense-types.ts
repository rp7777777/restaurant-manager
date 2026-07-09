// ============================================
// SERVORA ERP — Expense Types
// Single source of truth for expense entry shapes
// ============================================

import { Timestamp } from "firebase/firestore";

export type ExpensePaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK"
  | "OTHER";

// ── Core expense entry — one document per expense ──
export interface ExpenseEntry {
  id?: string;
  date: string;               // YYYY-MM-DD — the expense's actual business date
  expenseName: string;
  categoryId: string;
  subCategoryId?: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  note?: string;
  locked: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  userId: string;
  restaurantId: string;
}

// ── Payload shape for creating a new expense ──
export type CreateExpenseInput = Omit<
  ExpenseEntry,
  "id" | "createdAt" | "updatedAt" | "userId" | "restaurantId" | "locked"
>;

// ── Payload shape for updating an existing expense ──
export type UpdateExpenseInput = Partial<
  Omit<ExpenseEntry, "id" | "userId" | "restaurantId" | "createdAt">
>;