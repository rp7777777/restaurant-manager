// ============================================
// SERVORA ERP — Payroll Attendance Utils
// ✅ NORMAL_DAILY_HOURS — not hardcoded
// ✅ restaurantSnapshot bata normalDailyHours
// ✅ Safe month parsing — malformed date check
// ✅ Snapshot skip — fallback in generator
// ✅ Per-day OT fix
// ✅ Training = paid working day
// ============================================

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { MonthlyAttendance } from "../types/payroll-types";
import { SCHEDULE_CONFIG } from "../../schedule-module/constants/schedule-config";

function getOverlappingWeeks(year: number, month: number): string[] {
  const weeks: string[] = [];
  const start = new Date(year, month, 1);
  const dow   = start.getDay();
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  const end = new Date(year, month + 1, 0);
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    weeks.push(y + "-" + m + "-" + d);
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

// ✅ Safe month check — malformed dates rejected
function isInMonth(dateStr: string, year: number, month: number): boolean {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return false;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  return (
    Number.isFinite(y) &&
    Number.isFinite(m) &&
    y === year &&
    m === month + 1
  );
}

export async function getMonthlyAttendance(
  restaurantId: string,
  year: number,
  month: number
): Promise<MonthlyAttendance[]> {
  const weeks = getOverlappingWeeks(year, month);

  // ✅ Parallel reads
  const weekSnaps = await Promise.all(
    weeks.map((week) =>
      getDocs(query(
        collection(db, "restaurants", restaurantId, "schedules"),
        where("weekStart", "==", week)
      ))
    )
  );

  const empMap: Record<string, MonthlyAttendance> = {};

  weekSnaps.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      const s  = docSnap.data() as any;
      const no = s.employeeNo ?? "";
      if (!no) return;

      // ✅ No snapshot = skip here
      // payroll-generator will fallback to Employee DB
      if (!s.employeeSnapshot && !empMap[no]?.employeeSnapshot) return;

      if (!empMap[no]) {
        empMap[no] = {
        employeeNo:           no,
        employeeName:         s.employeeName ?? "",
        position:             s.position ?? s.category ?? "",
        employeeSnapshot:     s.employeeSnapshot,
        // ✅ restaurantSnapshot bata payrollMonthDays
        restaurantPayrollDays: s.restaurantSnapshot?.payrollMonthDays ?? 30,
        allowances:           [],
        totalHours:           0,
        overtimeHours:        0,
        nightHours:           0,
        workingDays:          0,
        absentDays:           0,
        holidayDays:          0,
        holidayHours:         0,
        sickDays:             0,
        vacationDays:         0,
        trainingHours:        0,
      };
     }

      // ✅ Most recent snapshot wins
      if (s.employeeSnapshot) {
        empMap[no].employeeSnapshot = s.employeeSnapshot;
      }

      // ✅ Restaurant normalDailyHours from snapshot
      const normalDailyHours =
        s.restaurantSnapshot?.normalDailyHours ??
        SCHEDULE_CONFIG.NORMAL_DAILY_HOURS;

      Object.entries(s.days || {}).forEach(([dateStr, dayData]: [string, any]) => {
        // ✅ Safe month check
        if (!isInMonth(dateStr, year, month)) return;

        const emp   = empMap[no];
        const hours = Math.max(0, dayData.hours || 0);

        switch (dayData.status) {
          case "WORK":
            emp.totalHours    += hours;
            emp.nightHours    += Math.max(0, dayData.nightHours || 0);
            emp.workingDays   += 1;
            if (hours > normalDailyHours) {
              emp.overtimeHours += hours - normalDailyHours;
            }
            break;
          case "TRAINING":
            emp.totalHours    += hours || normalDailyHours;
            emp.workingDays   += 1;
            emp.trainingHours += hours || normalDailyHours;
            break;
          case "HOLIDAY":
            emp.holidayDays  += 1;
            emp.holidayHours += normalDailyHours;
            break;
          case "ABSENT":   emp.absentDays++;   break;
          case "SICK":     emp.sickDays++;     break;
          case "VACATION": emp.vacationDays++; break;
        }
      });
    });
  });

  return Object.values(empMap);
}