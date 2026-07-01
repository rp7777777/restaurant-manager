// ============================================
// SERVORA ERP — Dashboard Service v3.1
// ✅ Aggregate stats — 1 document read only!
// ✅ Daily stats — no midnight reset needed
// ✅ runTransaction — race condition safe
// ✅ Aggregate-based rebuild — no full scan
// ✅ Shared constants — COL/RCOL/SCOL/ACOL
// ✅ Shared status — ATTENDANCE_STATUS etc
// ✅ Activity logs — yearly subcollection
// ✅ updateDashboardKPI — module KPI updates
// ✅ lastUpdated: Timestamp | null
// ✅ writeBatch removed — unused
// ✅ todayISO — shared date-utils
// ✅ profitMargin — live update in transaction
// FROZEN
// ============================================

import {
  doc, getDoc, setDoc, updateDoc,
  onSnapshot, increment, serverTimestamp,
  collection, query, where, orderBy,
  limit, getDocs, Timestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { COL, RCOL, SCOL, ACOL } from "../constants/firestore-collections";
import {
  ATTENDANCE_STATUS,
  PAYROLL_STATUS,
} from "../constants/firestore-status";
import {
  todayISO,
  currentMonthStr,
  currentYearStr,
} from "../utils/date-utils";

// ── Types ─────────────────────────────────────
export interface DashboardStats {
  totalSales:        number;
  totalExpenses:     number;
  netProfit:         number;
  totalTransactions: number;
  todaySales:        number;
  todayExpenses:     number;
  labourCostPct:     number;
  inventoryValue:    number;
  employeesPresent:  number;
  employeesTotal:    number;
  profitMargin:      number;
  monthSales:        number;
  monthExpenses:     number;
  // ✅ Timestamp | null — no unknown
  lastUpdated:       Timestamp | null;
}

export interface AttendanceSummary {
  total:   number;
  present: number;
  absent:  number;
  late:    number;
}

export interface ActivityLog {
  id:           string;
  type:         "sale" | "expense" | "attendance" | "payroll" | "inventory" | "labour" | "document";
  title:        string;
  subtitle:     string;
  amount?:      number;
  color:        string;
  icon:         string;
  timestamp:    Date;
  restaurantId: string;
}

export interface DashboardAlert {
  id:       string;
  type:     "warning" | "error" | "info";
  icon:     string;
  message:  string;
  subtext?: string;
  color:    string;
  time?:    string;
  route?:   string;
}

const DEFAULT_STATS: DashboardStats = {
  totalSales:        0,
  totalExpenses:     0,
  netProfit:         0,
  totalTransactions: 0,
  todaySales:        0,
  todayExpenses:     0,
  labourCostPct:     0,
  inventoryValue:    0,
  employeesPresent:  0,
  employeesTotal:    0,
  profitMargin:      0,
  monthSales:        0,
  monthExpenses:     0,
  lastUpdated:       null,
};

// ── Document refs ─────────────────────────────
function statsRef(restaurantId: string) {
  return doc(db, COL.STATS, restaurantId);
}

function dailyStatsRef(restaurantId: string, date: string) {
  const year = date.slice(0, 4);
  return doc(
    db, COL.STATS, restaurantId,
    SCOL.YEARLY, year,
    SCOL.DAILY,  date,
  );
}

function monthlyStatsRef(restaurantId: string, monthStr: string) {
  const year = monthStr.slice(0, 4);
  return doc(
    db, COL.STATS, restaurantId,
    SCOL.YEARLY,  year,
    SCOL.MONTHLY, monthStr,
  );
}

// ── ✅ Update aggregate stats ──────────────────
export async function updateDashboardStats(
  restaurantId: string,
  type:          "sales" | "expenses",
  amount:        number,
  operation:     "add" | "subtract"
): Promise<void> {
  if (!restaurantId || !amount) return;

  const value   = operation === "add" ? amount : -amount;
  const today   = todayISO();
  const month   = currentMonthStr();
  const mainRef = statsRef(restaurantId);
  const dayRef  = dailyStatsRef(restaurantId, today);
  const monRef  = monthlyStatsRef(restaurantId, month);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(mainRef);

      if (!snap.exists()) {
        const initSales    = type === "sales"    ? Math.max(0, value) : 0;
        const initExpenses = type === "expenses" ? Math.max(0, value) : 0;
        const initProfit   = initSales - initExpenses;
        tx.set(mainRef, {
          ...DEFAULT_STATS,
          totalSales:        initSales,
          totalExpenses:     initExpenses,
          netProfit:         initProfit,
          // ✅ profitMargin — live
          profitMargin:      initSales > 0
            ? Math.round((initProfit / initSales) * 10000) / 100
            : 0,
          totalTransactions: type === "sales" ? 1 : 0,
          todaySales:        type === "sales"    ? Math.max(0, value) : 0,
          todayExpenses:     type === "expenses" ? Math.max(0, value) : 0,
          monthSales:        type === "sales"    ? Math.max(0, value) : 0,
          monthExpenses:     type === "expenses" ? Math.max(0, value) : 0,
          lastUpdated:       serverTimestamp(),
        });
      } else {
        const data         = snap.data();
        const curSales     = Number(data.totalSales    ?? 0);
        const curExpenses  = Number(data.totalExpenses ?? 0);

        // ✅ profitMargin — calculate from new totals
        const newSales     = type === "sales"    ? curSales    + value : curSales;
        const newExpenses  = type === "expenses" ? curExpenses + value : curExpenses;
        const newProfit    = newSales - newExpenses;
        const newMargin    = newSales > 0
          ? Math.round((newProfit / newSales) * 10000) / 100
          : 0;

        const updates: Record<string, unknown> = {
          netProfit:    newProfit,
          profitMargin: newMargin,
          lastUpdated:  serverTimestamp(),
        };

        if (type === "sales") {
          updates.totalSales  = increment(value);
          updates.todaySales  = increment(value);
          updates.monthSales  = increment(value);
          if (operation === "add") updates.totalTransactions = increment(1);
        } else {
          updates.totalExpenses = increment(value);
          updates.todayExpenses = increment(value);
          updates.monthExpenses = increment(value);
        }
        tx.update(mainRef, updates);
      }

      tx.set(dayRef, {
        date: today,
        [type === "sales" ? "sales" : "expenses"]: increment(value),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      tx.set(monRef, {
        month: month,
        [type === "sales" ? "sales" : "expenses"]: increment(value),
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    console.warn("Stats update failed:", error);
  }
}

// ── Subscribe to stats ────────────────────────
export function subscribeDashboardStats(
  restaurantId: string,
  callback:     (stats: DashboardStats) => void,
  onError?:     (err: Error) => void
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
        totalSales:        Number(data.totalSales        ?? 0),
        totalExpenses:     Number(data.totalExpenses     ?? 0),
        netProfit:         Number(data.netProfit         ?? 0),
        totalTransactions: Number(data.totalTransactions ?? 0),
        todaySales:        Number(data.todaySales        ?? 0),
        todayExpenses:     Number(data.todayExpenses     ?? 0),
        labourCostPct:     Number(data.labourCostPct     ?? 0),
        inventoryValue:    Number(data.inventoryValue    ?? 0),
        employeesPresent:  Number(data.employeesPresent  ?? 0),
        employeesTotal:    Number(data.employeesTotal    ?? 0),
        profitMargin:      Number(data.profitMargin      ?? 0),
        monthSales:        Number(data.monthSales        ?? 0),
        monthExpenses:     Number(data.monthExpenses     ?? 0),
        lastUpdated:       (data.lastUpdated as Timestamp) ?? null,
      });
    },
    (err) => onError?.(err)
  );
}

// ── ✅ Aggregate-based Rebuild ─────────────────
export async function rebuildDashboardStats(
  restaurantId: string
): Promise<void> {
  if (!restaurantId) return;

  try {
    const today    = todayISO();
    const year     = currentYearStr();
    const monthStr = currentMonthStr();

    const monthlySnap = await getDocs(
      collection(db, COL.STATS, restaurantId, SCOL.YEARLY, year, SCOL.MONTHLY)
    );

    let totalSales    = 0;
    let totalExpenses = 0;
    let monthSales    = 0;
    let monthExpenses = 0;

    monthlySnap.docs.forEach((d) => {
      const data = d.data();
      totalSales    += Number(data.sales    ?? 0);
      totalExpenses += Number(data.expenses ?? 0);
      if (d.id === monthStr) {
        monthSales    = Number(data.sales    ?? 0);
        monthExpenses = Number(data.expenses ?? 0);
      }
    });

    const daySnap       = await getDoc(dailyStatsRef(restaurantId, today));
    const todaySales    = Number(daySnap.data()?.sales    ?? 0);
    const todayExpenses = Number(daySnap.data()?.expenses ?? 0);

    const netProfit    = totalSales - totalExpenses;
    const profitMargin = totalSales > 0
      ? Math.round((netProfit / totalSales) * 10000) / 100
      : 0;

    const existing     = await getDoc(statsRef(restaurantId));
    const existingData = existing.data() ?? {};

    await setDoc(statsRef(restaurantId), {
      totalSales,
      totalExpenses,
      netProfit,
      profitMargin,
      totalTransactions: Number(existingData.totalTransactions ?? 0),
      todaySales,
      todayExpenses,
      monthSales,
      monthExpenses,
      labourCostPct:    Number(existingData.labourCostPct    ?? 0),
      inventoryValue:   Number(existingData.inventoryValue   ?? 0),
      employeesPresent: Number(existingData.employeesPresent ?? 0),
      employeesTotal:   Number(existingData.employeesTotal   ?? 0),
      lastUpdated:      serverTimestamp(),
    });
  } catch (err) {
    console.error("Rebuild failed:", err);
  }
}

// ── ✅ Write unified activity log ──────────────
export async function logActivity(
  restaurantId: string,
  activity:     Omit<ActivityLog, "id" | "restaurantId" | "timestamp">
): Promise<void> {
  if (!restaurantId) return;
  try {
    const year = currentYearStr();
    const ref  = doc(
      collection(
        db, COL.RESTAURANTS, restaurantId,
        RCOL.ACTIVITY_LOGS, year, ACOL.ENTRIES,
      )
    );
    await setDoc(ref, {
      ...activity,
      restaurantId,
      timestamp:  serverTimestamp(),
      createdAt:  serverTimestamp(),
    });
  } catch (err) {
    console.warn("Activity log failed:", err);
  }
}

// ── ✅ Subscribe recent activities ─────────────
export function subscribeRecentActivities(
  restaurantId: string,
  callback:     (activities: ActivityLog[]) => void,
  limitCount:   number = 8,
  onError?:     (err: Error) => void,
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const year = currentYearStr();

  return onSnapshot(
    query(
      collection(
        db, COL.RESTAURANTS, restaurantId,
        RCOL.ACTIVITY_LOGS, year, ACOL.ENTRIES,
      ),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    ),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id:           d.id,
        type:         d.data().type        ?? "sale",
        title:        d.data().title       ?? "",
        subtitle:     d.data().subtitle    ?? "",
        amount:       Number(d.data().amount ?? 0),
        color:        d.data().color       ?? "#64748b",
        icon:         d.data().icon        ?? "circle",
        timestamp:    d.data().timestamp?.toDate?.() ?? new Date(),
        restaurantId: d.data().restaurantId ?? restaurantId,
      })));
    },
    // ✅ Error callback
    (err) => onError?.(err)
  );
}

// ── ✅ Fetch today alerts ──────────────────────
export async function fetchTodayAlerts(
  restaurantId: string
): Promise<DashboardAlert[]> {
  if (!restaurantId) return [];

  const alerts: DashboardAlert[] = [];

  try {
    const [attendanceSnap, payrollSnap] = await Promise.all([
      getDocs(query(
        collection(db, COL.RESTAURANTS, restaurantId, RCOL.ATTENDANCE),
        where("date",   "==", todayISO()),
        where("status", "==", ATTENDANCE_STATUS.ABSENT),
        limit(10),
      )),
      getDocs(query(
        collection(db, COL.RESTAURANTS, restaurantId, RCOL.PAYROLL),
        where("payrollStatus", "==", PAYROLL_STATUS.DRAFT),
        limit(5),
      )),
    ]);

    if (attendanceSnap.size > 0) {
      alerts.push({
        id:      "absent",
        type:    "warning",
        icon:    "person-off",
        message: `${attendanceSnap.size} employee${attendanceSnap.size > 1 ? "s" : ""} absent today`,
        subtext: "Check attendance",
        color:   "#f59e0b",
        time:    "Today",
        route:   "/attendance-module",
      });
    }

    if (payrollSnap.size > 0) {
      alerts.push({
        id:      "payroll",
        type:    "error",
        icon:    "payments",
        message: `${payrollSnap.size} payroll${payrollSnap.size > 1 ? "s" : ""} pending`,
        subtext: "Review payroll",
        color:   "#ef4444",
        time:    "Action needed",
        route:   "/payroll-module",
      });
    }

    return alerts;
  } catch {
    return [];
  }
}

// ── ✅ Today Attendance Summary ────────────────
export async function fetchTodayAttendance(
  restaurantId: string
): Promise<AttendanceSummary> {
  const empty = { total: 0, present: 0, absent: 0, late: 0 };
  if (!restaurantId) return empty;

  try {
    const snap = await getDocs(
      query(
        collection(db, COL.RESTAURANTS, restaurantId, RCOL.ATTENDANCE),
        where("date", "==", todayISO()),
      )
    );

    let present = 0, absent = 0, late = 0;
    snap.docs.forEach((d) => {
      const status = d.data().status as string;
      if (status === ATTENDANCE_STATUS.PRESENT)      present++;
      else if (status === ATTENDANCE_STATUS.LATE)  { present++; late++; }
      else if (status === ATTENDANCE_STATUS.ABSENT)  absent++;
    });

    return { total: snap.size, present, absent, late };
  } catch {
    return empty;
  }
}

// ── ✅ Update KPI from modules ─────────────────
export async function updateDashboardKPI(
  restaurantId: string,
  kpis: Partial<Pick<DashboardStats,
    "labourCostPct" | "inventoryValue" |
    "employeesPresent" | "employeesTotal"
  >>
): Promise<void> {
  if (!restaurantId) return;
  try {
    await updateDoc(statsRef(restaurantId), {
      ...kpis,
      lastUpdated: serverTimestamp(),
    });
  } catch (err) {
    console.warn("KPI update failed:", err);
  }
}