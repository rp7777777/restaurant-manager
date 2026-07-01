// ============================================
// SERVORA ERP — useDashboardExpenses
// ✅ Firestore real-time listener
// ✅ createdAt Timestamp filter
// ✅ Year filter
// ✅ Loading state — no race condition
// ✅ Cleanup on unmount
// ✅ restaurantId null safe + error reset
// ✅ map() — clean, debuggable
// FROZEN
// ============================================

import { useEffect, useState } from "react";
import {
  collection, query, where,
  orderBy, onSnapshot, Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { COL, RCOL } from "../../constants/firestore-collections";
import { ExpenseEntry } from "../../types/dashboard";

export interface UseDashboardExpensesResult {
  allExpenses: ExpenseEntry[];
  loading:     boolean;
  error:       string | null;
}

export function useDashboardExpenses(
  restaurantId: string | null | undefined,
  selectedYear: number,
): UseDashboardExpensesResult {
  const [allExpenses, setAllExpenses] = useState<ExpenseEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setAllExpenses([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const start = Timestamp.fromDate(new Date(selectedYear, 0, 1));
    const end   = Timestamp.fromDate(new Date(selectedYear, 11, 31, 23, 59, 59));

    const q = query(
      collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES),
      where("createdAt", ">=", start),
      where("createdAt", "<=", end),
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setAllExpenses(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ExpenseEntry, "id">),
          }))
        );
        setLoading(false);
      },
      (err) => {
        setAllExpenses([]);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId, selectedYear]);

  return { allExpenses, loading, error };
}