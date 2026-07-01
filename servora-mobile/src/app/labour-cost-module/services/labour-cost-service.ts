// ============================================
// SERVORA ERP — Labour Cost Service
// ✅ Strongly typed — no any[]
// ✅ employeeNo — matches AttendanceRecord
// ✅ overtimeRate — default 1.5 (not in snapshot)
// ✅ employeeId — temp: employeeNumber, future: PayrollDocument.employeeId
// ✅ buildDailyLabourCost — workedHours * hourlyRate
// ✅ Schedule query — overlap weeks handled
// ✅ salesData.byDay — reserved for v2 analytics
// ✅ Error handling — all fetches
// ✅ branchId/departmentId passed to summary
// ✅ Parallel reads — Promise.all
// FROZEN
// ============================================

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import {
  DailyLabourCost,
  LabourCostSummary,
  DateRange,
} from "../types/labour-cost-types";
import { PayrollDocument } from "../../payroll-module/types/payroll-types";
import { AttendanceRecord } from "../../attendance-module/types/attendance-types";
import {
  calcEmployeeLabourCost,
  addLabourCostPct,
  buildLabourCostSummary,
  calcDailyTrend,
} from "../utils/labour-cost-calculations";

// ── Sales Record ──────────────────────────────
interface SaleRecord {
  id:           string;
  date:         string;
  totalAmount?: number;
  amount?:      number;
}

// ── Schedule Record ───────────────────────────
interface ScheduleRecord {
  employeeNumber: string;
  scheduledHours: number;
}

// ── Get overlapping weeks ─────────────────────
function getOverlappingWeeks(startDate: string, endDate: string): string[] {
  const weeks: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end   = new Date(`${endDate}T00:00:00`);

  const dow  = start.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + diff);

  const cur = new Date(start);
  while (cur <= end) {
    const tz  = cur.getTimezoneOffset();
    const iso = new Date(cur.getTime() - tz * 60000)
      .toISOString().split("T")[0];
    weeks.push(iso);
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

// ── Fetch payroll by month ────────────────────
async function fetchPayrollData(
  restaurantId: string,
  monthStr:     string,
): Promise<PayrollDocument[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "restaurants", restaurantId, "payroll"),
        where("month", "==", monthStr),
      )
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PayrollDocument, "id">),
    }));
  } catch (err) {
    console.error("Labour cost — payroll fetch error:", err);
    return [];
  }
}

// ── Fetch attendance by date range ────────────
// Firestore index required: date ASC, employeeNo ASC
async function fetchAttendanceData(
  restaurantId: string,
  startDate:    string,
  endDate:      string,
): Promise<AttendanceRecord[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "restaurants", restaurantId, "attendance"),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
      )
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AttendanceRecord, "id">),
    }));
  } catch (err) {
    console.error("Labour cost — attendance fetch error:", err);
    return [];
  }
}

// ── Fetch schedule data ───────────────────────
async function fetchScheduleData(
  restaurantId: string,
  startDate:    string,
  endDate:      string,
): Promise<ScheduleRecord[]> {
  try {
    const weeks = getOverlappingWeeks(startDate, endDate);
    if (weeks.length === 0) return [];

    const snaps = await Promise.all(
      weeks.map((week) =>
        getDocs(query(
          collection(db, "restaurants", restaurantId, "schedules"),
          where("weekStart", "==", week),
        ))
      )
    );

    const empMap: Record<string, number> = {};
    snaps.forEach((snap) => {
      snap.docs.forEach((d) => {
        const data = d.data();
        const no   = (data.employeeNumber ?? data.employeeNo ?? "") as string;
        if (!no) return;
        const days = data.days as Record<string, { hours?: number }> ?? {};
        Object.entries(days).forEach(([date, day]) => {
          if (date >= startDate && date <= endDate) {
            empMap[no] = (empMap[no] ?? 0) + Number(day?.hours ?? 0);
          }
        });
      });
    });

    return Object.entries(empMap).map(([employeeNumber, scheduledHours]) => ({
      employeeNumber,
      scheduledHours,
    }));
  } catch (err) {
    console.error("Labour cost — schedule fetch error:", err);
    return [];
  }
}

// ── Fetch sales by date range ─────────────────
async function fetchSalesData(
  restaurantId: string,
  startDate:    string,
  endDate:      string,
): Promise<{ totalSales: number; byDay: Record<string, number> }> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "restaurants", restaurantId, "sales"),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
      )
    );

    let totalSales = 0;
    const byDay: Record<string, number> = {};

    snap.docs.forEach((d) => {
      const data   = d.data() as SaleRecord;
      const date   = data.date ?? "";
      const amount = Number(data.totalAmount ?? data.amount ?? 0);
      totalSales    += amount;
      byDay[date]    = (byDay[date] ?? 0) + amount;
    });

    return { totalSales, byDay };
  } catch (err) {
    console.error("Labour cost — sales fetch error:", err);
    return { totalSales: 0, byDay: {} };
  }
}

// ── Build daily labour cost ───────────────────
// ✅ workedHours * hourlyRate — actual cost per day
// ✅ overtimeRate default 1.5 — not in AttendanceEmployeeSnapshot
function buildDailyLabourCost(
  attendanceData: AttendanceRecord[],
  startDate:      string,
  endDate:        string,
): DailyLabourCost[] {
  const dayMap: Record<string, {
    totalHours:    number;
    overtimeHours: number;
    totalCost:     number;
    employeeIds:   Set<string>;
  }> = {};

  attendanceData.forEach((rec) => {
    const date = rec.date;
    if (!date || date < startDate || date > endDate) return;

    if (!dayMap[date]) {
      dayMap[date] = {
        totalHours:    0,
        overtimeHours: 0,
        totalCost:     0,
        employeeIds:   new Set(),
      };
    }

    const hours    = Number(rec.workedHours   ?? 0);
    const ot       = Number(rec.overtimeHours ?? 0);
    const hourRate = Number(rec.employeeSnapshot?.hourlyRate ?? 0);
    // ✅ Fix #2 — overtimeRate not in AttendanceEmployeeSnapshot
    const otRate   = 1.5;

    const regularHours = Math.max(0, hours - ot);
    const cost = (regularHours * hourRate) + (ot * hourRate * otRate);

    dayMap[date].totalHours    += hours;
    dayMap[date].overtimeHours += ot;
    dayMap[date].totalCost     += cost;
    dayMap[date].employeeIds.add(rec.employeeId ?? "");
  });

  return calcDailyTrend(
    Object.entries(dayMap).map(([date, data]) => ({
      date,
      totalHours:    Math.round(data.totalHours    * 100) / 100,
      overtimeHours: Math.round(data.overtimeHours * 100) / 100,
      totalCost:     Math.round(data.totalCost     * 100) / 100,
      employeeCount: data.employeeIds.size,
    }))
  );
}

// ── Main: Get Labour Cost Summary ─────────────
export async function getLabourCostSummary(
  restaurantId:  string,
  dateRange:     DateRange,
  monthStr:      string,
  branchId?:     string,
  departmentId?: string,
): Promise<LabourCostSummary> {

  const [payrollData, attendanceData, scheduleData, salesData] =
    await Promise.all([
      fetchPayrollData(restaurantId, monthStr),
      fetchAttendanceData(restaurantId, dateRange.startDate, dateRange.endDate),
      fetchScheduleData(restaurantId, dateRange.startDate, dateRange.endDate),
      fetchSalesData(restaurantId, dateRange.startDate, dateRange.endDate),
    ]);

  // ── Schedule map ──────────────────────────
  const scheduleMap: Record<string, number> = {};
  scheduleData.forEach((s) => {
    scheduleMap[s.employeeNumber] = s.scheduledHours;
  });

  // ── Attendance map ────────────────────────
  // ✅ Fix #1 — rec.employeeNo matches AttendanceRecord
  const attendanceMap: Record<string, {
    presentDays:  number;
    absentDays:   number;
    lateDays:     number;
    lateMinutes:  number;
  }> = {};

  attendanceData.forEach((rec) => {
    // ✅ Fix #1 — employeeNo not employeeNumber
    const key = rec.employeeNo ?? "";
    if (!key) return;
    if (!attendanceMap[key]) {
      attendanceMap[key] = {
        presentDays:  0,
        absentDays:   0,
        lateDays:     0,
        lateMinutes:  0,
      };
    }
    const att    = attendanceMap[key];
    const status = rec.status;

    if (status === "PRESENT" || status === "LATE") {
      att.presentDays++;
      if (status === "LATE") {
        att.lateDays++;
        att.lateMinutes += Number(rec.lateMinutes ?? 0);
      }
    } else if (status === "ABSENT") {
      att.absentDays++;
    }
  });

  // ── Build employee labour costs ───────────
  const employeesRaw = payrollData.map((p) => {
    // ✅ payroll uses employeeNumber — attendance uses employeeNo
    // both map to same employee via employeeNumber field
    const att = attendanceMap[p.employeeNumber] ?? {
      presentDays:  0,
      absentDays:   0,
      lateDays:     0,
      lateMinutes:  0,
    };

    return calcEmployeeLabourCost({
      // ✅ Temporary: employeeNumber used as stable ID
      // Future: replace with PayrollDocument.employeeId
      employeeId:     p.employeeNumber,
      employeeNumber: p.employeeNumber,
      employeeName:   p.employeeName   ?? "",
      position:       p.position       ?? "",
      workedHours:    Number(p.attendance?.totalHours    ?? 0),
      scheduledHours: scheduleMap[p.employeeNumber]      ?? 0,
      overtimeHours:  Number(p.attendance?.overtimeHours ?? 0),
      hourlyRate:     Number(p.snapshot?.hourlyRate      ?? 0),
      overtimeRate:   Number(p.snapshot?.overtimeRate    ?? 1.5),
      presentDays:    att.presentDays,
      absentDays:     att.absentDays,
      lateDays:       att.lateDays,
      lateMinutes:    att.lateMinutes,
    });
  });

  const totalCost = employeesRaw.reduce((s, e) => s + e.totalCost, 0);
  const employees = addLabourCostPct(employeesRaw, totalCost);

  const byDay = buildDailyLabourCost(
    attendanceData,
    dateRange.startDate,
    dateRange.endDate,
  );

  // ✅ salesData.byDay reserved for v2 analytics
  const { totalSales } = salesData;

  return buildLabourCostSummary({
    period:      dateRange,
    employees,
    byDay,
    totalSales,
    branchId,
    departmentId,
  });
}