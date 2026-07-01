// ============================================
// SERVORA ERP — useDashboardSales
// ✅ Firestore real-time listener
// ✅ Date field — timezone safe
// ✅ Year filter — string comparison
// ✅ Loading state — no race condition
// ✅ Cleanup on unmount
// ✅ restaurantId null safe + error reset
// ✅ map() — clean, debuggable
// FROZEN
// ============================================

import { useEffect, useState } from "react";
import {
  collection, query, where,
  orderBy, onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";
import { COL, RCOL } from "../../constants/firestore-collections";
import { SaleEntry } from "../../types/dashboard";

export interface UseDashboardSalesResult {
  allSales: SaleEntry[];
  loading:  boolean;
  error:    string | null;
}

export function useDashboardSales(
  restaurantId: string | null | undefined,
  selectedYear: number,
): UseDashboardSalesResult {
  const [allSales, setAllSales] = useState<SaleEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setAllSales([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const startDate = `${selectedYear}-01-01`;
    const endDate   = `${selectedYear}-12-31`;

    const q = query(
      collection(db, COL.RESTAURANTS, restaurantId, RCOL.SALES),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        // ✅ map() — clean + debuggable
        setAllSales(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SaleEntry, "id">),
          }))
        );
        setLoading(false);
      },
      (err) => {
        setAllSales([]);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId, selectedYear]);

  return { allSales, loading, error };
}