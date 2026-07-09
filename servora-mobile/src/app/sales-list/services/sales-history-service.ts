// ============================================
// SERVORA ERP — Sales History Service
// Firestore queries only — history/read-side of sales data
// ============================================

import {
  collection, onSnapshot, query,
  orderBy, where,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { SaleHistoryEntry } from "../types/sales-history-types";

// ── Realtime subscription — all sales for a restaurant within a given year.
//    Filters by the sale's actual "date" field (not createdAt), so
//    back-dated entries show up under the year/month they belong to,
//    not the day they happened to be entered. ──
export function subscribeSalesForYear(
  restaurantId: string,
  year: number,
  callback: (sales: SaleHistoryEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const q = query(
    collection(db, COL.RESTAURANTS, restaurantId, RCOL.SALES),
    where("date", ">=", yearStart),
    where("date", "<=", yearEnd),
    orderBy("date", "desc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const data: SaleHistoryEntry[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SaleHistoryEntry, "id">),
      }));
      callback(data);
    },
    (err) => onError?.(err)
  );
}