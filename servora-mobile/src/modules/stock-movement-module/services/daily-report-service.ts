// ============================================
// SERVORA ERP — Daily Report Service
// ✅ New sibling file alongside the FROZEN stock-movement-service.ts
//    — read-only queries only, no writes, so it's safe to add here
//    without touching the FROZEN file. Reuses the same collection
//    path (restaurants/{id}/stockMovements) that recordStockMovement
//    already writes to.
// ✅ getMovementsForDateRange() — the date-range/today-only query
//    that didn't exist yet (getMovementsForItem is per-item history,
//    subscribeRecentMovements is "recent N across all items" with
//    no date filtering). Powers the Daily Report screen's Stock-In/
//    Stock-Out lists.
// ✅ Date range is passed as JS Date objects — Firestore compares
//    Date objects directly against Timestamp fields in `where`
//    clauses, no manual Timestamp conversion needed.
// ============================================

import {
  collection, getDocs, query, where, orderBy,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import { StockMovement } from "../types/stock-movement";

function stockMovementsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.STOCK_MOVEMENTS);
}

export interface DateRange {
  start: Date;  // inclusive
  end:   Date;  // exclusive
}

// ── Returns today's start/end as a DateRange — helper so callers
//    don't each need to reconstruct this. ──
export function todayRange(): DateRange {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getMovementsForDateRange(
  restaurantId: string,
  range: DateRange
): Promise<StockMovement[]> {
  if (!restaurantId) return [];

  const snap = await getDocs(
    query(
      stockMovementsCollection(restaurantId),
      where("createdAt", ">=", range.start),
      where("createdAt", "<", range.end),
      orderBy("createdAt", "desc"),
    )
  );

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, "id">) }));
}