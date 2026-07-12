// ============================================
// SERVORA ERP — Expense History Service
// Firestore queries only — history/read-side of expense data
// FROZEN
// ============================================

import {
  collection, onSnapshot, query,
  orderBy, where,
  QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { ExpenseEntry } from "../types/expense-types";

function expensesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES);
}

function mapExpenseDoc(d: QueryDocumentSnapshot<DocumentData>): ExpenseEntry {
  return { id: d.id, ...(d.data() as Omit<ExpenseEntry, "id">) };
}

// ── Realtime subscription — all expenses for a restaurant within a given year.
//    Filters by the expense's actual "date" field (not createdAt), so
//    back-dated entries show up under the year/month they belong to,
//    not the day they happened to be entered. ──
export function subscribeExpensesForYear(
  restaurantId: string,
  year: number,
  callback: (expenses: ExpenseEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const q = query(
    expensesCollection(restaurantId),
    where("date", ">=", yearStart),
    where("date", "<=", yearEnd),
    orderBy("date", "desc")
  );

  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mapExpenseDoc)),
    (err) => onError?.(err)
  );
}