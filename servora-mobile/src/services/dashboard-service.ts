// ============================================
// SERVORA ERP — Dashboard Service v4.0
// ✅ Aggregate stats — 1 document read only!
// ✅ Daily stats — no midnight reset needed
// ✅ runTransaction — race condition safe
// ✅ Shared constants — COL/RCOL/SCOL/ACOL
// ✅ Shared status — ATTENDANCE_STATUS etc
// ✅ Activity logs — yearly subcollection
// ✅ updateDashboardKPI — module KPI updates
// ✅ lastUpdated: Timestamp | null
// ✅ profitMargin — live update in transaction
// ✅ updateDashboardStats() now requires the entry's OWN date —
//    fixes a real bug where editing/deleting a back-dated sale or
//    expense (any date other than today) incorrectly adjusted
//    TODAY's and THIS MONTH's stats buckets instead of the entry's
//    actual day/month. todaySales/todayExpenses and monthSales/
//    monthExpenses on the main aggregate doc are now ONLY adjusted
//    when the entry's date actually falls on today/this month;
//    totalSales/totalExpenses remain unconditional (all-time).
// ✅ recomputeDashboardStatsFromSource() — one-time repair: recomputes
//    totalSales/totalExpenses/todaySales/todayExpenses/monthSales/
//    monthExpenses AND the daily/monthly sub-documents directly from
//    the actual sales/expenses collections (true source of truth),
//    rather than trusting the (possibly already-corrupted) aggregate
//    documents the way the old rebuildDashboardStats() did.
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

// ── ✅ Update aggregate stats — date-aware bucketing.
//    `date` MUST be the actual sale/expense's own date (YYYY-MM-DD),
//    never assumed to be "today". This is what the entry's day/month
//    sub-documents are keyed by, and what decides whether the main
//    doc's todaySales/monthSales fields get touched at all. ──
export async function updateDashboardStats(
  restaurantId: string,
  type:          "sales" | "expenses",
  amount:        number,
  operation:     "add" | "subtract",
  date:          string,
): Promise<void> {
  if (!restaurantId || !amount || !date) return;

  const value   = operation === "add" ? amount : -amount;
  const month   = date.slice(0, 7);
  const isToday = date === todayISO();
  const isThisMonth = month === currentMonthStr();
  const mainRef = statsRef(restaurantId);
  const dayRef  = dailyStatsRef(restaurantId, date);
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
          profitMargin:      initSales > 0
            ? Math.round((initProfit / initSales) * 10000) / 100
            : 0,
          totalTransactions: type === "sales" ? 1 : 0,
          // ✅ Only seed today's/this-month's fields if this entry
          //    actually belongs to today/this month.
          todaySales:        (type === "sales"    && isToday)     ? Math.max(0, value) : 0,
          todayExpenses:     (type === "expenses" && isToday)     ? Math.max(0, value) : 0,
          monthSales:        (type === "sales"    && isThisMonth) ? Math.max(0, value) : 0,
          monthExpenses:     (type === "expenses" && isThisMonth) ? Math.max(0, value) : 0,
          lastUpdated:       serverTimestamp(),
        });
      } else {
        const data         = snap.data();
        const curSales     = Number(data.totalSales    ?? 0);
        const curExpenses  = Number(data.totalExpenses ?? 0);

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
          // ✅ Only touch todaySales/monthSales if the entry's own
          //    date is actually today/this month — this is the fix
          //    for the back-dated edit/delete corruption bug.
          if (isToday)     updates.todaySales = increment(value);
          if (isThisMonth) updates.monthSales  = increment(value);
          if (operation === "add") updates.totalTransactions = increment(1);
        } else {
          updates.totalExpenses = increment(value);
          if (isToday)     updates.todayExpenses = increment(value);
          if (isThisMonth) updates.monthExpenses  = increment(value);
        }
        tx.update(mainRef, updates);
      }

      // ✅ Day/month sub-documents are always keyed by the entry's
      //    OWN date/month — never "today"/"this month".
      tx.set(dayRef, {
        date,
        [type === "sales" ? "sales" : "expenses"]: increment(value),
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      tx.set(monRef, {
        month,
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

// ── ✅ Aggregate-based rebuild (kept for backward compatibility) —
//    NOTE: this only re-sums the EXISTING monthly/daily sub-documents.
//    If those sub-documents are themselves corrupted (e.g. from the
//    date-bucketing bug this file just fixed), this will faithfully
//    reproduce that same corruption. Prefer
//    recomputeDashboardStatsFromSource() below for a true repair. ──
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

// ── ✅ TRUE source-of-truth repair — recomputes the main aggregate
//    doc AND every daily/monthly sub-document by scanning the actual
//    sales and expenses collections directly (never trusting any
//    pre-existing aggregate/sub-document, since those may already be
//    corrupted by the date-bucketing bug this file just fixed).
//    Intended as a one-time repair after upgrading to the fixed
//    updateDashboardStats() — safe to re-run any time if stats are
//    ever suspected to have drifted again. ──
export async function recomputeDashboardStatsFromSource(
  restaurantId: string
): Promise<void> {
  if (!restaurantId) return;

  const today = todayISO();
  const month = currentMonthStr();

  const [salesSnap, expensesSnap] = await Promise.all([
    getDocs(collection(db, COL.RESTAURANTS, restaurantId, RCOL.SALES)),
    getDocs(collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES)),
  ]);

  let totalSales = 0, totalExpenses = 0;
  let todaySales = 0, todayExpenses = 0;
  let monthSales = 0, monthExpenses = 0;
  let totalTransactions = 0;

  const dailySales    = new Map<string, number>();
  const dailyExpenses = new Map<string, number>();
  const monthlySales    = new Map<string, number>();
  const monthlyExpenses = new Map<string, number>();

  salesSnap.docs.forEach((d) => {
    const data = d.data();
    const amount = Number(data.amount ?? 0);
    const date = data.date as string | undefined;
    if (!date) return;

    totalSales += amount;
    totalTransactions += 1;
    if (date === today) todaySales += amount;

    const mo = date.slice(0, 7);
    if (mo === month) monthSales += amount;

    dailySales.set(date, (dailySales.get(date) ?? 0) + amount);
    monthlySales.set(mo, (monthlySales.get(mo) ?? 0) + amount);
  });

  expensesSnap.docs.forEach((d) => {
    const data = d.data();
    const amount = Number(data.amount ?? 0);
    const date = data.date as string | undefined;
    if (!date) return;

    totalExpenses += amount;
    if (date === today) todayExpenses += amount;

    const mo = date.slice(0, 7);
    if (mo === month) monthExpenses += amount;

    dailyExpenses.set(date, (dailyExpenses.get(date) ?? 0) + amount);
    monthlyExpenses.set(mo, (monthlyExpenses.get(mo) ?? 0) + amount);
  });

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
    totalTransactions,
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

  // ── Repair every daily/monthly sub-document too, so future
  //    incremental updates build on correct baselines. Full
  //    overwrite (not merge) — these values ARE the corrected truth. ──
  const allDates = new Set<string>([...dailySales.keys(), ...dailyExpenses.keys()]);
  await Promise.all(
    Array.from(allDates).map((date) =>
      setDoc(dailyStatsRef(restaurantId, date), {
        date,
        sales:       dailySales.get(date)    ?? 0,
        expenses:    dailyExpenses.get(date) ?? 0,
        lastUpdated: serverTimestamp(),
      })
    )
  );

  const allMonths = new Set<string>([...monthlySales.keys(), ...monthlyExpenses.keys()]);
  await Promise.all(
    Array.from(allMonths).map((mo) =>
      setDoc(monthlyStatsRef(restaurantId, mo), {
        month: mo,
        sales:       monthlySales.get(mo)    ?? 0,
        expenses:    monthlyExpenses.get(mo) ?? 0,
        lastUpdated: serverTimestamp(),
      })
    )
  );
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