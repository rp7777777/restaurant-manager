// ============================================
// SERVORA ERP — Dashboard Service v9.0 — FINAL
// ✅ Aggregate stats — 1 document read (main) + live sub-doc reads
// ✅ runTransaction — race condition safe
// ✅ Date-aware bucketing (today/month/year) in updateDashboardStats
// ✅ transactionCountDelta — accurate counting, clamped [-1, 1]
// ✅ Negative protection on MAIN doc AND daily/monthly sub-docs
// ✅ subscribeDashboardStats() — today/month/year AND trend
//    baselines (yesterday/lastMonth/lastYear) read LIVE from their
//    own date-scoped sub-documents
// ✅ Debounced emit — all 7 listeners (main, day, yesterday, month,
//    lastMonth, year, lastYear) schedule their emit via a single
//    microtask flag, so several near-simultaneous snapshot updates
//    coalesce into ONE callback/re-render instead of up to 7.
// ✅ recomputeDashboardStatsFromSource() — repair writes are now
//    chunked via writeBatch() (400 per batch) instead of an
//    unbounded Promise.all(), so a restaurant with years of daily/
//    monthly sub-documents to repair doesn't fire thousands of
//    concurrent writes at once.
// ✅ Single source of truth — today/month/year/trend-baseline
//    values are NO LONGER written to the main aggregate document
//    at all (only totalSales/totalExpenses/netProfit/profitMargin/
//    totalTransactions remain there, which have no sub-document
//    equivalent). The daily/monthly sub-documents are now the ONLY
//    place period-scoped sales/expenses values are persisted,
//    eliminating the prior duplication between main-doc fields
//    (which subscribeDashboardStats() no longer even reads) and
//    sub-doc fields (which it does).
// FROZEN
// ============================================

import {
  doc, getDoc, setDoc, updateDoc,
  onSnapshot, increment, serverTimestamp,
  collection, query, where, orderBy,
  limit, getDocs, Timestamp,
  runTransaction, writeBatch,
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
  monthSales:        number;
  monthExpenses:     number;
  yearSales:         number;
  yearExpenses:      number;
  yesterdaySales:    number;
  yesterdayExpenses: number;
  lastMonthSales:    number;
  lastMonthExpenses: number;
  lastYearSales:     number;
  lastYearExpenses:  number;
  labourCostPct:     number;
  inventoryValue:    number;
  employeesPresent:  number;
  employeesTotal:    number;
  profitMargin:      number;
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

export const DEFAULT_STATS: DashboardStats = {
  totalSales:        0,
  totalExpenses:     0,
  netProfit:         0,
  totalTransactions: 0,
  todaySales:        0,
  todayExpenses:     0,
  monthSales:        0,
  monthExpenses:     0,
  yearSales:         0,
  yearExpenses:      0,
  yesterdaySales:    0,
  yesterdayExpenses: 0,
  lastMonthSales:    0,
  lastMonthExpenses: 0,
  lastYearSales:     0,
  lastYearExpenses:  0,
  labourCostPct:     0,
  inventoryValue:    0,
  employeesPresent:  0,
  employeesTotal:    0,
  profitMargin:      0,
  lastUpdated:       null,
};

const REPAIR_BATCH_SIZE = 400;

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

// ── Date helpers for trend comparison periods ──
function yesterdayISO(today: string): string {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().split("T")[0];
}

function prevMonthStr(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

function prevYearStr(yearStr: string): string {
  return String(Number(yearStr) - 1);
}

// ── ✅ Update aggregate stats — date-aware bucketing + negative
//    protection (main doc AND daily/monthly sub-docs) + accurate,
//    clamped transaction counting.
//    NOTE: the main doc no longer stores today/month/year fields —
//    only all-time totals (totalSales/totalExpenses/netProfit/
//    profitMargin/totalTransactions), which have no sub-document
//    equivalent. Period-scoped values live ONLY on the daily/
//    monthly sub-documents now. ──
export async function updateDashboardStats(
  restaurantId: string,
  type:          "sales" | "expenses",
  amount:        number,
  operation:     "add" | "subtract",
  date:          string,
  transactionCountDelta: number = 0,
): Promise<void> {
  if (!restaurantId || amount === undefined || amount === null || !date) return;

  const value    = operation === "add" ? amount : -amount;
  const month    = date.slice(0, 7);
  const safeCountDelta = Math.max(-1, Math.min(1, transactionCountDelta));
  const mainRef  = statsRef(restaurantId);
  const dayRef   = dailyStatsRef(restaurantId, date);
  const monRef   = monthlyStatsRef(restaurantId, month);
  const fieldKey = type === "sales" ? "sales" : "expenses";

  try {
    await runTransaction(db, async (tx) => {
      // ── All reads first (Firestore transaction requirement) ──
      const snap    = await tx.get(mainRef);
      const daySnap = await tx.get(dayRef);
      const monSnap = await tx.get(monRef);

      const curDayValue = Number(daySnap.data()?.[fieldKey] ?? 0);
      const newDayValue = Math.max(0, curDayValue + value);

      const curMonValue = Number(monSnap.data()?.[fieldKey] ?? 0);
      const newMonValue = Math.max(0, curMonValue + value);

      if (!snap.exists()) {
        const initSales    = type === "sales"    ? Math.max(0, value) : 0;
        const initExpenses = type === "expenses" ? Math.max(0, value) : 0;
        const initProfit   = initSales - initExpenses;
        tx.set(mainRef, {
          totalSales:        initSales,
          totalExpenses:     initExpenses,
          netProfit:         initProfit,
          profitMargin:      initSales > 0
            ? Math.round((initProfit / initSales) * 10000) / 100
            : 0,
          totalTransactions: Math.max(0, safeCountDelta),
          labourCostPct:     0,
          inventoryValue:    0,
          employeesPresent:  0,
          employeesTotal:    0,
          lastUpdated:       serverTimestamp(),
        });
      } else {
        const data = snap.data();

        const curSales        = Number(data.totalSales        ?? 0);
        const curExpenses     = Number(data.totalExpenses     ?? 0);
        const curTransactions = Number(data.totalTransactions ?? 0);

        const newSales    = type === "sales"    ? Math.max(0, curSales    + value) : curSales;
        const newExpenses = type === "expenses" ? Math.max(0, curExpenses + value) : curExpenses;
        const newProfit   = newSales - newExpenses;
        const newMargin   = newSales > 0
          ? Math.round((newProfit / newSales) * 10000) / 100
          : 0;

        tx.update(mainRef, {
          totalSales:        newSales,
          totalExpenses:     newExpenses,
          netProfit:         newProfit,
          profitMargin:      newMargin,
          totalTransactions: Math.max(0, curTransactions + safeCountDelta),
          lastUpdated:       serverTimestamp(),
        });
      }

      // ✅ Day/month sub-documents — the ONLY place period-scoped
      //    sales/expenses values live now.
      tx.set(dayRef, {
        date,
        [fieldKey]: newDayValue,
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      tx.set(monRef, {
        month,
        [fieldKey]: newMonValue,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    console.warn("Stats update failed:", error);
  }
}

// ── Subscribe to stats — LIVE, date-aware derivation, with
//    debounced emit. All 7 listeners (main, today, yesterday,
//    month, lastMonth, year, lastYear) schedule emit() via a
//    microtask flag rather than calling it directly — several
//    listeners firing in the same tick (e.g. right after a
//    transaction touches both main + day + month docs) coalesce
//    into a SINGLE callback/re-render instead of up to 7. ──
export function subscribeDashboardStats(
  restaurantId: string,
  callback:     (stats: DashboardStats) => void,
  onError?:     (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback(DEFAULT_STATS);
    return () => {};
  }

  const today     = todayISO();
  const yesterday = yesterdayISO(today);
  const month     = currentMonthStr();
  const lastMonth = prevMonthStr(month);
  const year      = currentYearStr();
  const lastYear  = prevYearStr(year);

  let mainData = {
    totalSales:        DEFAULT_STATS.totalSales,
    totalExpenses:     DEFAULT_STATS.totalExpenses,
    netProfit:         DEFAULT_STATS.netProfit,
    totalTransactions: DEFAULT_STATS.totalTransactions,
    labourCostPct:     DEFAULT_STATS.labourCostPct,
    inventoryValue:    DEFAULT_STATS.inventoryValue,
    employeesPresent:  DEFAULT_STATS.employeesPresent,
    employeesTotal:    DEFAULT_STATS.employeesTotal,
    profitMargin:      DEFAULT_STATS.profitMargin,
    lastUpdated:       DEFAULT_STATS.lastUpdated,
  };

  let todaySales = 0, todayExpenses = 0;
  let monthSales = 0, monthExpenses = 0;
  let yearSales  = 0, yearExpenses  = 0;
  let yesterdaySales = 0, yesterdayExpenses = 0;
  let lastMonthSales = 0, lastMonthExpenses = 0;
  let lastYearSales  = 0, lastYearExpenses  = 0;

  // ✅ Debounce — coalesce multiple near-simultaneous listener
  //    fires into a single callback via a microtask flag.
  let emitScheduled = false;
  const scheduleEmit = () => {
    if (emitScheduled) return;
    emitScheduled = true;
    queueMicrotask(() => {
      emitScheduled = false;
      callback({
        ...mainData,
        todaySales, todayExpenses,
        monthSales, monthExpenses,
        yearSales, yearExpenses,
        yesterdaySales, yesterdayExpenses,
        lastMonthSales, lastMonthExpenses,
        lastYearSales, lastYearExpenses,
      });
    });
  };

  const unsubMain = onSnapshot(
    statsRef(restaurantId),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      mainData = {
        totalSales:        Number(data.totalSales        ?? 0),
        totalExpenses:     Number(data.totalExpenses     ?? 0),
        netProfit:         Number(data.netProfit         ?? 0),
        totalTransactions: Number(data.totalTransactions ?? 0),
        labourCostPct:     Number(data.labourCostPct     ?? 0),
        inventoryValue:    Number(data.inventoryValue    ?? 0),
        employeesPresent:  Number(data.employeesPresent  ?? 0),
        employeesTotal:    Number(data.employeesTotal    ?? 0),
        profitMargin:      Number(data.profitMargin      ?? 0),
        lastUpdated:       (data.lastUpdated as Timestamp) ?? null,
      };
      scheduleEmit();
    },
    (err) => onError?.(err)
  );

  const unsubDay = onSnapshot(
    dailyStatsRef(restaurantId, today),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      todaySales    = Number(data.sales    ?? 0);
      todayExpenses = Number(data.expenses ?? 0);
      scheduleEmit();
    },
    () => {}
  );

  const unsubYesterday = onSnapshot(
    dailyStatsRef(restaurantId, yesterday),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      yesterdaySales    = Number(data.sales    ?? 0);
      yesterdayExpenses = Number(data.expenses ?? 0);
      scheduleEmit();
    },
    () => {}
  );

  const unsubMonth = onSnapshot(
    monthlyStatsRef(restaurantId, month),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      monthSales    = Number(data.sales    ?? 0);
      monthExpenses = Number(data.expenses ?? 0);
      scheduleEmit();
    },
    () => {}
  );

  const unsubLastMonth = onSnapshot(
    monthlyStatsRef(restaurantId, lastMonth),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      lastMonthSales    = Number(data.sales    ?? 0);
      lastMonthExpenses = Number(data.expenses ?? 0);
      scheduleEmit();
    },
    () => {}
  );

  const unsubYear = onSnapshot(
    collection(db, COL.STATS, restaurantId, SCOL.YEARLY, year, SCOL.MONTHLY),
    (snap) => {
      let sSum = 0, eSum = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        sSum += Number(data.sales    ?? 0);
        eSum += Number(data.expenses ?? 0);
      });
      yearSales    = sSum;
      yearExpenses = eSum;
      scheduleEmit();
    },
    () => {}
  );

  const unsubLastYear = onSnapshot(
    collection(db, COL.STATS, restaurantId, SCOL.YEARLY, lastYear, SCOL.MONTHLY),
    (snap) => {
      let sSum = 0, eSum = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        sSum += Number(data.sales    ?? 0);
        eSum += Number(data.expenses ?? 0);
      });
      lastYearSales    = sSum;
      lastYearExpenses = eSum;
      scheduleEmit();
    },
    () => {}
  );

  return () => {
    unsubMain();
    unsubDay();
    unsubYesterday();
    unsubMonth();
    unsubLastMonth();
    unsubYear();
    unsubLastYear();
  };
}

// ── ✅ Aggregate-based rebuild (kept for backward compatibility,
//    deprecated/legacy — not updated further, superseded by
//    recomputeDashboardStatsFromSource()). ──
export async function rebuildDashboardStats(
  restaurantId: string
): Promise<void> {
  if (!restaurantId) return;

  try {
    const year     = currentYearStr();
    const monthStr = currentMonthStr();

    const monthlySnap = await getDocs(
      collection(db, COL.STATS, restaurantId, SCOL.YEARLY, year, SCOL.MONTHLY)
    );

    let totalSales    = 0;
    let totalExpenses = 0;

    monthlySnap.docs.forEach((d) => {
      const data = d.data();
      totalSales    += Number(data.sales    ?? 0);
      totalExpenses += Number(data.expenses ?? 0);
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
      totalTransactions: Number(existingData.totalTransactions ?? 0),
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
//    doc (all-time totals only, no today/month/year duplication)
//    AND every daily/monthly sub-document by scanning the actual
//    sales/expenses collections directly. Sub-document repair
//    writes are chunked via writeBatch() (400 per batch) rather
//    than an unbounded Promise.all(), so a restaurant with years of
//    history doesn't fire thousands of concurrent writes. ──
export async function recomputeDashboardStatsFromSource(
  restaurantId: string
): Promise<void> {
  if (!restaurantId) return;

  const [salesSnap, expensesSnap] = await Promise.all([
    getDocs(collection(db, COL.RESTAURANTS, restaurantId, RCOL.SALES)),
    getDocs(collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES)),
  ]);

  let totalSales = 0, totalExpenses = 0;
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

    const mo = date.slice(0, 7);
    dailySales.set(date, (dailySales.get(date) ?? 0) + amount);
    monthlySales.set(mo, (monthlySales.get(mo) ?? 0) + amount);
  });

  expensesSnap.docs.forEach((d) => {
    const data = d.data();
    const amount = Number(data.amount ?? 0);
    const date = data.date as string | undefined;
    if (!date) return;

    totalExpenses += amount;

    const mo = date.slice(0, 7);
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
    labourCostPct:    Number(existingData.labourCostPct    ?? 0),
    inventoryValue:   Number(existingData.inventoryValue   ?? 0),
    employeesPresent: Number(existingData.employeesPresent ?? 0),
    employeesTotal:   Number(existingData.employeesTotal   ?? 0),
    lastUpdated:      serverTimestamp(),
  });

  // ── Repair every daily/monthly sub-document — chunked via
  //    writeBatch() (400 ops per batch) instead of an unbounded
  //    Promise.all(), so a large restaurant's years of history
  //    don't fire thousands of concurrent writes. ──
  const allDates = Array.from(new Set<string>([...dailySales.keys(), ...dailyExpenses.keys()]));
  for (let i = 0; i < allDates.length; i += REPAIR_BATCH_SIZE) {
    const chunk = allDates.slice(i, i + REPAIR_BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((date) => {
      batch.set(dailyStatsRef(restaurantId, date), {
        date,
        sales:       dailySales.get(date)    ?? 0,
        expenses:    dailyExpenses.get(date) ?? 0,
        lastUpdated: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  const allMonths = Array.from(new Set<string>([...monthlySales.keys(), ...monthlyExpenses.keys()]));
  for (let i = 0; i < allMonths.length; i += REPAIR_BATCH_SIZE) {
    const chunk = allMonths.slice(i, i + REPAIR_BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((mo) => {
      batch.set(monthlyStatsRef(restaurantId, mo), {
        month: mo,
        sales:       monthlySales.get(mo)    ?? 0,
        expenses:    monthlyExpenses.get(mo) ?? 0,
        lastUpdated: serverTimestamp(),
      });
    });
    await batch.commit();
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