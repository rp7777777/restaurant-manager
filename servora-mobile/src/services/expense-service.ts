// ============================================
// SERVORA ERP — Expense Service
// Multi-tenant Firestore operations
// Single gateway for all expense data access
//
// TODO: Move dashboard aggregation to Cloud Functions
//       for stronger write-consistency guarantees.
// NOTE: createExpense() has no entry-count limit
//       (unlike Sales' 3-per-shift), since expenses have
//       no natural per-day cap.
// NOTE: subCategoryId is conditionally included/removed —
//       Firestore rejects `undefined` field values, so it's
//       only ever written when actually present.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query,
  where, orderBy, serverTimestamp,
  runTransaction, deleteField,
  QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { COL, RCOL } from "../constants/firestore-collections";
import { logCreate, logEdit, logDelete } from "../app/security/audit-service";
import { updateDashboardStats } from "./dashboard-service";
import {
  ExpenseEntry,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "../app/expenses-module/types/expense-types";

function expensesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES);
}

function expenseDoc(restaurantId: string, expenseId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES, expenseId);
}

function mapQueryDoc(d: QueryDocumentSnapshot<DocumentData>): ExpenseEntry {
  return { id: d.id, ...(d.data() as Omit<ExpenseEntry, "id">) };
}

function nextMonthStr(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

// ── Create — subCategoryId only included when present, since Firestore
//    rejects `undefined` field values ──
export async function createExpense(
  restaurantId: string,
  input: CreateExpenseInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");

  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const data: Record<string, unknown> = {
    date: input.date,
    expenseName: input.expenseName,
    categoryId: input.categoryId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    note: input.note?.trim() ?? "",
    locked: false,
    userId: user.uid,
    restaurantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.subCategoryId) {
    data.subCategoryId = input.subCategoryId;
  }

  const docRef = await addDoc(expensesCollection(restaurantId), data);

  await updateDashboardStats(restaurantId, "expenses", input.amount, "add");

  await logCreate("EXPENSES", docRef.id, {
    date: input.date,
    categoryId: input.categoryId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
  });

  return docRef.id;
}

// ── Update — runTransaction: read + locked-check + write happen atomically.
//    subCategoryId: if explicitly cleared (undefined), removes the field
//    via deleteField() rather than writing `undefined` (which Firestore rejects). ──
export async function updateExpense(
  restaurantId: string,
  expenseId: string,
  oldExpense: ExpenseEntry,
  updates: UpdateExpenseInput
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = expenseDoc(restaurantId, expenseId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Expense entry not found");

    const currentData = snap.data() as Omit<ExpenseEntry, "id">;
    if (currentData.locked) throw new Error("This expense is locked and cannot be edited");

    const cleanUpdates: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };

    if (updates.note !== undefined) {
      cleanUpdates.note = updates.note.trim();
    }

    if ("subCategoryId" in updates) {
      cleanUpdates.subCategoryId = updates.subCategoryId ? updates.subCategoryId : deleteField();
    }

    transaction.update(ref, cleanUpdates);
  });

  if (updates.amount !== undefined && oldExpense.amount !== undefined) {
    const diff = updates.amount - oldExpense.amount;
    if (diff !== 0) {
      await updateDashboardStats(restaurantId, "expenses", diff, "add");
    }
  }

  await logEdit(
    "EXPENSES",
    expenseId,
    oldExpense as unknown as Record<string, unknown>,
    updates as unknown as Record<string, unknown>
  );
}

// ── Delete — runTransaction: read + locked-check + delete happen atomically ──
export async function deleteExpense(
  restaurantId: string,
  expenseId: string,
  expenseData: ExpenseEntry
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = expenseDoc(restaurantId, expenseId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Expense entry not found");

    const currentData = snap.data() as Omit<ExpenseEntry, "id">;
    if (currentData.locked) throw new Error("This expense is locked and cannot be deleted");

    transaction.delete(ref);
  });

  await updateDashboardStats(restaurantId, "expenses", expenseData.amount, "subtract");

  await logDelete("EXPENSES", expenseId, expenseData as unknown as Record<string, unknown>);
}

// ── Toggle lock on a single expense entry (individual-level lock) ──
export async function toggleExpenseLock(
  restaurantId: string,
  expenseId: string,
  locked: boolean
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  await updateDoc(expenseDoc(restaurantId, expenseId), {
    locked,
    updatedAt: serverTimestamp(),
  });

  if (locked) {
    await logEdit("EXPENSES", expenseId, { locked: false }, { locked: true });
  } else {
    await logEdit("EXPENSES", expenseId, { locked: true }, { locked: false });
  }
}

export async function getExpenseById(
  restaurantId: string,
  expenseId: string
): Promise<ExpenseEntry | null> {
  const snap = await getDoc(expenseDoc(restaurantId, expenseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ExpenseEntry, "id">) };
}

// ── Realtime — today's expenses ──
export function subscribeTodayExpenses(
  restaurantId: string,
  date: string,
  callback: (expenses: ExpenseEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    expensesCollection(restaurantId),
    where("date", "==", date),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mapQueryDoc)),
    (err) => onError?.(err)
  );
}

// ── Get expenses for a specific date (one-time fetch) ──
export async function getExpensesByDate(
  restaurantId: string,
  date: string
): Promise<ExpenseEntry[]> {
  if (!restaurantId) return [];

  const q = query(
    expensesCollection(restaurantId),
    where("date", "==", date),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(mapQueryDoc);
}

// ── Get expenses for a month (YYYY-MM) — half-open range, leap-year safe ──
export async function getExpensesByMonth(
  restaurantId: string,
  monthStr: string
): Promise<ExpenseEntry[]> {
  if (!restaurantId) return [];

  const start = `${monthStr}-01`;
  const end = `${nextMonthStr(monthStr)}-01`;

  const q = query(
    expensesCollection(restaurantId),
    where("date", ">=", start),
    where("date", "<", end),
    orderBy("date", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(mapQueryDoc);
}