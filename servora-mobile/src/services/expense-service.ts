// ============================================
// SERVORA ERP — Expense Service
// Multi-tenant Firestore operations
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, where,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { logCreate, logEdit, logDelete } from "../security/audit-service";
import { updateDashboardStats } from "./dashboard-service";

// ── Types ────────────────────────────────────
export interface ExpenseItem {
  id?: string;
  expenseName: string;
  category: string;
  amount: number;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  userId?: string;
  restaurantId?: string;
}

// ── Helpers ──────────────────────────────────
function getRestaurantId(): string {
  return auth.currentUser?.uid ?? "";
}

function expensesCollection(restaurantId: string) {
  return collection(db, "restaurants", restaurantId, "expenses");
}

// ── Create ───────────────────────────────────
export async function createExpense(
  expense: Omit<ExpenseItem, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  const data = {
    ...expense,
    userId: auth.currentUser!.uid,
    restaurantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(expensesCollection(restaurantId), data);

  await updateDashboardStats(restaurantId, "expenses", expense.amount, "add");

  await logCreate("EXPENSES", docRef.id, {
    expenseName: expense.expenseName,
    category: expense.category,
    amount: expense.amount,
  });

  return docRef.id;
}

// ── Update ───────────────────────────────────
export async function updateExpense(
  expenseId: string,
  oldExpense: ExpenseItem,
  updatedFields: Partial<ExpenseItem>
): Promise<void> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  await updateDoc(
    doc(db, "restaurants", restaurantId, "expenses", expenseId),
    { ...updatedFields, updatedAt: serverTimestamp() }
  );

  if (updatedFields.amount !== undefined && oldExpense.amount !== undefined) {
    const diff = updatedFields.amount - oldExpense.amount;
    await updateDashboardStats(restaurantId, "expenses", diff, "add");
  }

  await logEdit("EXPENSES", expenseId, oldExpense as unknown as Record<string, unknown>, updatedFields as unknown as Record<string, unknown>);
}

// ── Delete ───────────────────────────────────
export async function deleteExpense(
  expenseId: string,
  expenseData: ExpenseItem
): Promise<void> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  await deleteDoc(doc(db, "restaurants", restaurantId, "expenses", expenseId));

  await updateDashboardStats(restaurantId, "expenses", expenseData.amount, "subtract");

  await logDelete("EXPENSES", expenseId, expenseData as unknown as unknown as Record<string, unknown>);
}

// ── Real-time listener ───────────────────────
export function subscribeExpenses(
  restaurantId: string,
  callback: (expenses: ExpenseItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(expensesCollection(restaurantId), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const expenses: ExpenseItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ExpenseItem, "id">),
      }));
      callback(expenses);
    },
    (err) => onError?.(err)
  );
}

// ── Today's expenses ─────────────────────────
export function subscribeTodayExpenses(
  restaurantId: string,
  callback: (total: number) => void
): () => void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const q = query(
    expensesCollection(restaurantId),
    where("createdAt", ">=", Timestamp.fromDate(today))
  );

  return onSnapshot(q, (snap) => {
    let total = 0;
    snap.forEach((d) => { total += Number(d.data().amount ?? 0); });
    callback(total);
  });
}
