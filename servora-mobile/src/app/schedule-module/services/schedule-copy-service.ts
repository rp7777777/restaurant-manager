// ============================================
// SERVORA ERP — Schedule Copy Service
// ✅ Timezone safe — addDays() use
// ✅ Batch write — fast
// ✅ Fresh snapshot on copy
// ✅ Deterministic ID — duplicate impossible
// ✅ Empty newDays — skipped++ correct
// ✅ No snapshot — skip safely
// ✅ Syncs every copied day to Attendance via the centralized
//    syncScheduleDaysToAttendance() helper — a sync failure never
//    blocks the copy itself; caller can inspect syncFailedCount
// FROZEN
// ============================================

import { writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { EmployeeDB } from "../types/employee-types";
import { RestaurantSettings } from "../types/restaurant-types";
import { getSchedulesByWeek } from "../firestore/schedule-repository";
import { buildEmployeeSnapshot, buildRestaurantSnapshot } from "../utils/schedule-utils";
import { getWeekDates, addDays } from "../utils/date-utils";
import { buildWeekSummary } from "../utils/overtime-utils";
import { DaySchedule } from "../types/schedule-types";
import { SCHEDULE_CONFIG } from "../constants/schedule-config";
import {
  syncScheduleDaysToAttendance,
  ScheduleSyncItem,
} from "../../../integrations/schedule-attendance-sync";

export async function copyScheduleToNextWeek(
  restaurantId: string,
  fromWeek: string,
  employeeMap: Record<string, EmployeeDB>,
  settings: RestaurantSettings
): Promise<{ copied: number; skipped: number; syncFailedCount: number }> {

  const nextWeek  = addDays(fromWeek, 7);
  const nextDates = getWeekDates(nextWeek);

  const [currentSchedules, existingSchedules] = await Promise.all([
    getSchedulesByWeek(restaurantId, fromWeek),
    getSchedulesByWeek(restaurantId, nextWeek),
  ]);

  // ✅ Duplicate check
  const existingKeys = new Set(
    existingSchedules.map((s) => s.employeeNo + "_" + s.weekStart)
  );

  const toCreate = currentSchedules.filter(
    (s) => !existingKeys.has(s.employeeNo + "_" + nextWeek)
  );

  // ✅ let — so skipped++ works
  let skipped = currentSchedules.length - toCreate.length;

  if (toCreate.length === 0) return { copied: 0, skipped, syncFailedCount: 0 };

  const rSnap = buildRestaurantSnapshot(settings);
  const LIMIT = SCHEDULE_CONFIG.BATCH_WRITE_LIMIT;
  let copied  = 0;

  // ── Accumulate sync items across every chunk, then sync once at
  //    the end (after all batches have committed successfully). ──
  const syncItems: ScheduleSyncItem[] = [];

  for (let i = 0; i < toCreate.length; i += LIMIT) {
    const chunk = toCreate.slice(i, i + LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((emp) => {
      // ✅ No snapshot — skip safely
      const dbEmployee = employeeMap[emp.employeeNo];
      if (!dbEmployee && !emp.employeeSnapshot) {
        skipped++;
        return;
      }

      const oldDates = getWeekDates(emp.weekStart);
      const newDays: Record<string, DaySchedule> = {};

      oldDates.forEach((oldDate, idx) => {
        if (emp.days[oldDate] && nextDates[idx]) {
          newDays[nextDates[idx]] = { ...emp.days[oldDate] };
        }
      });

      // ✅ Empty newDays — skipped++ correct
      if (Object.keys(newDays).length === 0) {
        skipped++;
        return;
      }

      const stats        = buildWeekSummary(newDays, nextDates);
      const freshEmpSnap = dbEmployee
        ? buildEmployeeSnapshot(dbEmployee)
        : emp.employeeSnapshot;

      // ✅ Deterministic ID — race condition impossible
      const newRef = doc(
        db,
        "restaurants",
        restaurantId,
        "schedules",
        emp.employeeNo + "_" + nextWeek
      );

      batch.set(newRef, {
        employeeId:         emp.employeeId,
        employeeNo:         emp.employeeNo,
        employeeName:       emp.employeeName,
        position:           emp.position,
        weekStart:          nextWeek,
        days:               newDays,
        restaurantId,
        employeeSnapshot:   freshEmpSnap,
        restaurantSnapshot: rSnap,
        ...stats,
        userId:    auth.currentUser?.uid ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      copied++;

      Object.entries(newDays).forEach(([date, day]) => {
        syncItems.push({
          employeeId: emp.employeeId,
          date,
          status: day.status,
          startTime: day.startTime || undefined,
          endTime: day.endTime || undefined,
          hours: day.hours,
        });
      });
    });

    await batch.commit();
  }

  const { failures } = await syncScheduleDaysToAttendance(
    restaurantId,
    syncItems,
    settings.normalDailyHours
  );

  return { copied, skipped, syncFailedCount: failures.length };
}