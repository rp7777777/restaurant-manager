// ============================================
// SERVORA ERP — Schedule Repository
// ✅ Lock check + mutation atomic (single runTransaction)
// ✅ employeeId read from the schedule document itself inside the
//    transaction — never trusted from a caller-passed parameter
// ✅ createSchedule — settings is a REQUIRED parameter (no silent
//    default fallback), deterministic ID + transaction prevents
//    duplicate create under concurrent/double-tap attempts
// ✅ updateScheduleDay — re-reads the LATEST committed day value
//    right before syncing to Attendance, instead of syncing the
//    caller-supplied snapshot. If two rapid edits to the same day
//    race (e.g. WORK then SICK moments later), whichever sync call
//    runs last always reads and syncs whatever is ACTUALLY committed
//    at that moment — converging Attendance to the true final
//    Schedule state instead of a stale snapshot based on network
//    timing.
// ✅ deleteSchedule — cleans up SCHEDULE-origin Attendance records
//    for every date in the deleted week. Only records whose origin
//    is confirmed "SCHEDULE" (with no clockIn) are removed —
//    CLOCK_IN/MANUAL/actual records are never touched.
// ✅ copyWeekSchedules() — REMOVED (unused dead code)
// FROZEN
// ============================================

import {
  collection, updateDoc, getDoc,
  onSnapshot, query, where, getDocs,
  doc, serverTimestamp, runTransaction,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { EmployeeSchedule, DaySchedule, WeekSummary } from "../types/schedule-types";
import { EmployeeDB } from "../types/employee-types";
import { RestaurantSettings } from "../types/restaurant-types";
import { buildScheduleData } from "../utils/schedule-utils";
import {
  syncScheduleDayToAttendance,
  syncScheduleDaysToAttendance,
  cleanupScheduleOriginAttendance,
  ScheduleSyncItem,
} from "../../../integrations/schedule-attendance-sync";

const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "schedules");

const scheduleDoc = (restaurantId: string, scheduleId: string) =>
  doc(db, "restaurants", restaurantId, "schedules", scheduleId);

export function subscribeToSchedules(
  restaurantId: string,
  weekStart: string,
  onData: (schedules: EmployeeSchedule[]) => void,
  onError?: (err?: unknown) => void
): () => void {
  const q = query(col(restaurantId), where("weekStart", "==", weekStart));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EmployeeSchedule, "id">),
      })));
    },
    (error) => {
      console.error("Schedule subscribe error:", error);
      onError?.(error);
    }
  );
}

// ✅ settings is REQUIRED — no silent hardcoded fallback.
// ✅ Deterministic ID (employeeNumber_weekStart) + transaction —
//    guarantees one schedule per employee per week even under a
//    double-tap or two concurrent "Add Employee" attempts.
export async function createSchedule(
  restaurantId: string,
  employee: EmployeeDB,
  weekStart: string,
  settings: RestaurantSettings
): Promise<{ syncFailedCount: number }> {
  const data = buildScheduleData(
    employee,
    weekStart,
    restaurantId,
    settings
  );

  const scheduleId = `${employee.employeeNumber}_${weekStart}`;
  const ref = scheduleDoc(restaurantId, scheduleId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      throw new Error(`${employee.firstName} already has a schedule for this week`);
    }

    transaction.set(ref, {
      ...data,
      userId:    auth.currentUser?.uid ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const items: ScheduleSyncItem[] = Object.entries(data.days).map(
    ([date, day]) => ({
      employeeId: employee.id,
      date,
      status: day.status,
      startTime: day.startTime || undefined,
      endTime: day.endTime || undefined,
      hours: day.hours,
    })
  );

  const { failures } = await syncScheduleDaysToAttendance(
    restaurantId,
    items,
    settings.normalDailyHours
  );

  return { syncFailedCount: failures.length };
}

// ✅ Lock check + day mutation are atomic (single transaction).
// ✅ employeeId read from the schedule document itself.
// ✅ Re-reads the LATEST committed day value right before syncing,
//    instead of syncing the caller-supplied `updatedDay` snapshot —
//    closes the race where two rapid edits to the same day could
//    otherwise sync out of order and leave Attendance stale relative
//    to the true final Schedule state. ──
export async function updateScheduleDay(
  restaurantId: string,
  scheduleId: string,
  dayKey: string,
  updatedDay: DaySchedule,
  stats: WeekSummary,
  normalDailyHours: number,
): Promise<{ syncFailed: boolean; syncError?: string }> {
  const ref = scheduleDoc(restaurantId, scheduleId);

  const employeeId = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error("Schedule not found");
    }

    const data = snap.data();
    if (data?.locked === true) {
      throw new Error("Schedule is locked — payroll already generated");
    }

    transaction.update(ref, {
      ["days." + dayKey]: updatedDay,
      ...stats,
      updatedAt: serverTimestamp(),
    });

    return data.employeeId as string;
  });

  // ── Re-read the actual committed value right before syncing. If a
  //    concurrent edit already overwrote this day again by the time
  //    we get here, we sync THAT (the true current state) rather than
  //    our own now-possibly-stale `updatedDay` parameter. ──
  const latestSnap = await getDoc(ref);
  const latestDay =
    (latestSnap.data()?.days?.[dayKey] as DaySchedule | undefined) ?? updatedDay;

  const syncResult = await syncScheduleDayToAttendance(
    restaurantId,
    employeeId,
    dayKey,
    latestDay.status,
    normalDailyHours,
    latestDay.startTime || undefined,
    latestDay.endTime   || undefined,
    latestDay.hours,
  );

  if (!syncResult.success) {
    return { syncFailed: true, syncError: syncResult.error };
  }
  return { syncFailed: false };
}

// ✅ Lock check + delete atomic (single transaction).
// ✅ Cleans up SCHEDULE-origin Attendance records for every date in
//    the deleted week — best-effort, never blocks the delete itself.
//    CLOCK_IN/MANUAL/actual records are never touched. ──
export async function deleteSchedule(
  restaurantId: string,
  scheduleId: string
): Promise<{ cleanupFailedCount: number }> {
  const ref = scheduleDoc(restaurantId, scheduleId);

  const { employeeId, dates } = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error("Schedule not found");
    }
    const data = snap.data();
    if (data?.locked === true) {
      throw new Error("Schedule is locked — payroll already generated");
    }

    transaction.delete(ref);

    return {
      employeeId: data.employeeId as string,
      dates: Object.keys(data.days ?? {}),
    };
  });

  const { failures } = await cleanupScheduleOriginAttendance(
    restaurantId, employeeId, dates
  );

  return { cleanupFailedCount: failures.length };
}

export async function lockSchedule(
  restaurantId: string,
  scheduleId: string
): Promise<void> {
  await updateDoc(scheduleDoc(restaurantId, scheduleId), {
    locked:    true,
    updatedAt: serverTimestamp(),
  });
}

export async function getSchedulesByWeek(
  restaurantId: string,
  weekStart: string
): Promise<EmployeeSchedule[]> {
  const snap = await getDocs(
    query(col(restaurantId), where("weekStart", "==", weekStart))
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<EmployeeSchedule, "id">),
  }));
}