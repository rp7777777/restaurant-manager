// ============================================
// SERVORA ERP — Dashboard Service v7.1 — FINAL
// ✅ Aggregate stats — 1 document read (main) + live sub-doc reads
// ✅ runTransaction — race condition safe
// ✅ Shared constants — COL/RCOL/SCOL/ACOL
// ✅ Shared status — ATTENDANCE_STATUS etc
// ✅ Activity logs — yearly subcollection
// ✅ updateDashboardKPI — module KPI updates
// ✅ lastUpdated: Timestamp | null
// ✅ profitMargin — live update in transaction
// ✅ Date-aware bucketing (today/month/year) in updateDashboardStats
// ✅ transactionCountDelta — accurate counting (+1 create, -1
//    delete, 0 edit), clamped to [-1, 1]
// ✅ Negative protection on MAIN doc AND daily/monthly sub-docs
// ✅ amount === undefined/null check — amount=0 no longer skipped
// ⚠️ NOTE: `amount` here can legitimately be a signed DIFF (e.g.
//    from updateSale()/updateExpense() editing an amount down),
//    combined with operation="add" as the calling convention. A
//    Math.abs(amount) guard was tried here and reverted — it broke
//    edits that reduce an amount (the diff's negative sign carries
//    the "decrease" meaning and must NOT be stripped). Callers are
//    responsible for passing amount/operation correctly; this
//    function trusts the sign of `amount` combined with `operation`.
// ✅ subscribeDashboardStats() — todaySales/todayExpenses,
//    monthSales/monthExpenses, and yearSales/yearExpenses are read
//    LIVE from their own date-scoped sub-documents (daily doc for
//    today, monthly doc for this month, all this-year monthly docs
//    summed for this year) rather than trusted from the main
//    aggregate doc's stored fields — fixes stale values after a
//    day/month/year rollover with zero new transactions yet.
// ✅ recomputeDashboardStatsFromSource() — true source-of-truth
//    repair from actual sales/expenses collections
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
  monthSales:        number;
  monthExpenses:     number;
  yearSales:         number;
  yearExpenses:      number;
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

const DEFAULT_STATS: DashboardStats = {
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
  labourCostPct:     0,
  inventoryValue:    0,
  employeesPresent:  0,
  employeesTotal:    0,
  profitMargin:      0,
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

// ── ✅ Update aggregate stats — date-aware bucketing + negative
//    protection (main doc AND daily/monthly sub-docs) + accurate,
//    clamped transaction counting.
//    `date` MUST be the actual sale/expense's own date (YYYY-MM-DD).
//    `amount` may be a signed diff (edits) — its sign is trusted
//    together with `operation`, never stripped via Math.abs().
//    `transactionCountDelta`: +1 on create, -1 on delete, 0 on edit
//    (default) — clamped to [-1, 1] per call.
//    ALL reads (main + day + month) happen before any writes, as
//    Firestore transactions require. ──
export async function updateDashboardStats(
  restaurantId: string,
  type:          "sales" | "expenses",
  amount:        number,
  operation:     "add" | "subtract",
  date:          string,
  transactionCountDelta: number = 0,
): Promise<void> {
  if (!restaurantId || amount === undefined || amount === null || !date) return;

  const value       = operation === "add" ? amount : -amount;
  const month       = date.slice(0, 7);
  const year        = date.slice(0, 4);
  const isToday     = date  === todayISO();
  const isThisMonth = month === currentMonthStr();
  const isThisYear  = year  === currentYearStr();
  const safeCountDelta = Math.max(-1, Math.min(1, transactionCountDelta));
  const mainRef = statsRef(restaurantId);
  const dayRef  = dailyStatsRef(restaurantId, date);
  const monRef  = monthlyStatsRef(restaurantId, month);
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
          ...DEFAULT_STATS,
          totalSales:        initSales,
          totalExpenses:     initExpenses,
          netProfit:         initProfit,
          profitMargin:      initSales > 0
            ? Math.round((initProfit / initSales) * 10000) / 100
            : 0,
          totalTransactions: Math.max(0, safeCountDelta),
          todaySales:        (type === "sales"    && isToday)     ? Math.max(0, value) : 0,
          todayExpenses:     (type === "expenses" && isToday)     ? Math.max(0, value) : 0,
          monthSales:        (type === "sales"    && isThisMonth) ? Math.max(0, value) : 0,
          monthExpenses:     (type === "expenses" && isThisMonth) ? Math.max(0, value) : 0,
          yearSales:         (type === "sales"    && isThisYear)  ? Math.max(0, value) : 0,
          yearExpenses:      (type === "expenses" && isThisYear)  ? Math.max(0, value) : 0,
          lastUpdated:       serverTimestamp(),
        });
      } else {
        const data = snap.data();

        const curSales        = Number(data.totalSales        ?? 0);
        const curExpenses     = Number(data.totalExpenses     ?? 0);
        const curToday        = Number(data.todaySales        ?? 0);
        const curTodayExp     = Number(data.todayExpenses     ?? 0);
        const curMonth        = Number(data.monthSales        ?? 0);
        const curMonthExp     = Number(data.monthExpenses     ?? 0);
        const curYear         = Number(data.yearSales         ?? 0);
        const curYearExp      = Number(data.yearExpenses      ?? 0);
        const curTransactions = Number(data.totalTransactions ?? 0);

        const newSales    = type === "sales"    ? Math.max(0, curSales    + value) : curSales;
        const newExpenses = type === "expenses" ? Math.max(0, curExpenses + value) : curExpenses;
        const newProfit   = newSales - newExpenses;
        const newMargin   = newSales > 0
          ? Math.round((newProfit / newSales) * 10000) / 100
          : 0;

        const updates: Record<string, unknown> = {
          totalSales:        newSales,
          totalExpenses:     newExpenses,
          netProfit:         newProfit,
          profitMargin:      newMargin,
          totalTransactions: Math.max(0, curTransactions + safeCountDelta),
          lastUpdated:       serverTimestamp(),
        };

        if (type === "sales") {
          if (isToday)     updates.todaySales = Math.max(0, curToday + value);
          if (isThisMonth) updates.monthSales  = Math.max(0, curMonth + value);
          if (isThisYear)  updates.yearSales   = Math.max(0, curYear + value);
        } else {
          if (isToday)     updates.todayExpenses = Math.max(0, curTodayExp + value);
          if (isThisMonth) updates.monthExpenses  = Math.max(0, curMonthExp + value);
          if (isThisYear)  updates.yearExpenses   = Math.max(0, curYearExp + value);
        }
        tx.update(mainRef, updates);
      }

      // ✅ Day/month sub-documents — computed + clamped (Math.max 0),
      //    not a blind increment() — matches main doc's protection.
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

// ── Subscribe to stats — LIVE, date-aware derivation.
//    todaySales/todayExpenses, monthSales/monthExpenses, and
//    yearSales/yearExpenses are NEVER trusted directly from the
//    main aggregate doc (which only updates when a transaction
//    happens, and can go stale the moment the actual day/month/
//    year rolls over with zero new transactions yet). Instead:
//    - today  → read live from today's own daily sub-doc
//    - month  → read live from this month's own monthly sub-doc
//    - year   → summed live across every monthly sub-doc this year
//    If the relevant sub-doc(s) don't exist yet (no entries this
//    period), the value correctly shows 0 — never a stale prior
//    period's number. ──
export function subscribeDashboardStats(
  restaurantId: string,
  callback:     (stats: DashboardStats) => void,
  onError?:     (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback(DEFAULT_STATS);
    return () => {};
  }

  const today = todayISO();
  const month = currentMonthStr();
  const year  = currentYearStr();

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

  const emit = () => {
    callback({
      ...mainData,
      todaySales,
      todayExpenses,
      monthSales,
      monthExpenses,
      yearSales,
      yearExpenses,
    });
  };

  // ── Main doc — all-time totals + non-date-sensitive fields ──
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
      emit();
    },
    (err) => onError?.(err)
  );

  // ── Today's daily sub-doc — live, correctly 0 if no entries today ──
  const unsubDay = onSnapshot(
    dailyStatsRef(restaurantId, today),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      todaySales    = Number(data.sales    ?? 0);
      todayExpenses = Number(data.expenses ?? 0);
      emit();
    },
    () => { /* doc doesn't exist yet — todaySales/Expenses stay 0 */ }
  );

  // ── This month's monthly sub-doc — live, correctly 0 if no
  //    entries this month ──
  const unsubMonth = onSnapshot(
    monthlyStatsRef(restaurantId, month),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      monthSales    = Number(data.sales    ?? 0);
      monthExpenses = Number(data.expenses ?? 0);
      emit();
    },
    () => { /* doc doesn't exist yet — monthSales/Expenses stay 0 */ }
  );

  // ── This year's total — summed live across every monthly sub-doc
  //    for the current year. Correctly 0 on Jan 1 before any entry. ──
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
      emit();
    },
    () => { /* no monthly docs yet this year — yearSales/Expenses stay 0 */ }
  );

  return () => {
    unsubMain();
    unsubDay();
    unsubMonth();
    unsubYear();
  };
}

// ── ✅ Aggregate-based rebuild (kept for backward compatibility) —
//    NOTE: this only re-sums the EXISTING monthly/daily sub-documents.
//    Prefer recomputeDashboardStatsFromSource() below for a true
//    repair. ──
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
      yearSales:        Number(existingData.yearSales        ?? 0),
      yearExpenses:     Number(existingData.yearExpenses     ?? 0),
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
//    doc (including yearSales/yearExpenses) AND every daily/monthly
//    sub-document by scanning the actual sales/expenses collections
//    directly. ──
export async function recomputeDashboardStatsFromSource(
  restaurantId: string
): Promise<void> {
  if (!restaurantId) return;

  const today = todayISO();
  const month = currentMonthStr();
  const year  = currentYearStr();

  const [salesSnap, expensesSnap] = await Promise.all([
    getDocs(collection(db, COL.RESTAURANTS, restaurantId, RCOL.SALES)),
    getDocs(collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES)),
  ]);

  let totalSales = 0, totalExpenses = 0;
  let todaySales = 0, todayExpenses = 0;
  let monthSales = 0, monthExpenses = 0;
  let yearSales  = 0, yearExpenses  = 0;
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
    const yr = date.slice(0, 4);
    if (mo === month) monthSales += amount;
    if (yr === year)  yearSales  += amount;

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
    const yr = date.slice(0, 4);
    if (mo === month) monthExpenses += amount;
    if (yr === year)  yearExpenses  += amount;

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
    yearSales,
    yearExpenses,
    labourCostPct:    Number(existingData.labourCostPct    ?? 0),
    inventoryValue:   Number(existingData.inventoryValue   ?? 0),
    employeesPresent: Number(existingData.employeesPresent ?? 0),
    employeesTotal:   Number(existingData.employeesTotal   ?? 0),
    lastUpdated:      serverTimestamp(),
  });

  // ── Repair every daily/monthly sub-document too. Full overwrite
  //    (not merge) — these values ARE the corrected truth. ──
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