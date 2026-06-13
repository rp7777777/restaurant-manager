// ============================================
// SERVORA ERP — Dashboard Service
// Aggregate stats — 1 document read only!
// ============================================

import {
  doc, getDoc, setDoc, updateDoc,
  onSnapshot, increment, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ── Types ────────────────────────────────────
export interface DashboardStats {
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  totalTransactions: number;
  todaySales: number;
  todayExpenses: number;
  lastUpdated: unknown;
}

const DEFAULT_STATS: DashboardStats = {
  totalSales: 0,
  totalExpenses: 0,
  netProfit: 0,
  totalTransactions: 0,
  todaySales: 0,
  todayExpenses: 0,
  lastUpdated: null,
};

// ── Stats document ref ───────────────────────
function statsRef(restaurantId: string) {
  return doc(db, "stats", restaurantId);
}

// ── Update aggregate stats ───────────────────
export async function updateDashboardStats(
  restaurantId: string,
  type: "sales" | "expenses",
  amount: number,
  operation: "add" | "subtract"
): Promise<void> {
  if (!restaurantId || !amount) return;

  const ref = statsRef(restaurantId);
  const value = operation === "add" ? amount : -amount;

  try {
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // First time — create stats doc
      await setDoc(ref, {
        ...DEFAULT_STATS,
        [type === "sales" ? "totalSales" : "totalExpenses"]: Math.max(0, value),
        netProfit: type === "sales" ? Math.max(0, value) : -Math.max(0, value),
        totalTransactions: type === "sales" ? 1 : 0,
        lastUpdated: serverTimestamp(),
      });
      return;
    }

    const updates: Record<string, unknown> = {
      lastUpdated: serverTimestamp(),
    };

    if (type === "sales") {
      updates.totalSales = increment(value);
      updates.netProfit = increment(value);
      if (operation === "add") updates.totalTransactions = increment(1);
    } else {
      updates.totalExpenses = increment(value);
      updates.netProfit = increment(-value);
    }

    await updateDoc(ref, updates);
  } catch (error) {
    console.warn("Stats update failed:", error);
  }
}

// ── Subscribe to stats (1 document!) ────────
export function subscribeDashboardStats(
  restaurantId: string,
  callback: (stats: DashboardStats) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback(DEFAULT_STATS);
    return () => {};
  }

  return onSnapshot(
    statsRef(restaurantId),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_STATS);
        return;
      }
      const data = snap.data();
      callback({
        totalSales: Number(data.totalSales ?? 0),
        totalExpenses: Number(data.totalExpenses ?? 0),
        netProfit: Number(data.netProfit ?? 0),
        totalTransactions: Number(data.totalTransactions ?? 0),
        todaySales: Number(data.todaySales ?? 0),
        todayExpenses: Number(data.todayExpenses ?? 0),
        lastUpdated: data.lastUpdated,
      });
    },
    (err) => onError?.(err)
  );
}

// ── Reset today's stats at midnight ─────────
export async function resetTodayStats(restaurantId: string): Promise<void> {
  if (!restaurantId) return;
  try {
    await updateDoc(statsRef(restaurantId), {
      todaySales: 0,
      todayExpenses: 0,
      lastUpdated: serverTimestamp(),
    });
  } catch {}
}
