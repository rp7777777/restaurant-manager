// ============================================
// SERVORA ERP — Schedule Repository
// ✅ Timezone safe — addDays() use
// ✅ Batch write — fast copy
// ✅ Lock check from Firestore — UI trust hudaina
// ✅ Delete pani locked check
// ✅ employeeSnapshot + restaurantSnapshot saved
// ✅ Fresh snapshot on copy
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, getDocs, getDoc,
  doc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { EmployeeSchedule, DaySchedule, WeekSummary } from "../types/schedule-types";
import { EmployeeDB } from "../types/employee-types";
import { RestaurantSettings } from "../types/restaurant-types";
import { buildScheduleData, buildEmployeeSnapshot } from "../utils/schedule-utils";
import { getWeekDates, addDays } from "../utils/date-utils";
import { buildWeekSummary } from "../utils/overtime-utils";
import { SCHEDULE_CONFIG } from "../constants/schedule-config";

const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "schedules");

const scheduleDoc = (restaurantId: string, scheduleId: string) =>
  doc(db, "restaurants", restaurantId, "schedules", scheduleId);

// ✅ Default settings fallback
const DEFAULT_SETTINGS: RestaurantSettings = {
  currency:          "EUR",
  currencySymbol:    "€",
  paymentType:       "MONTHLY",
  normalDailyHours:  8,
  normalWeeklyHours: 40,
  defaultTaxRate:    11,
  defaultSSRate:     11,
  payrollMonthDays:  30,
  defaultShiftStart: "09:00",
};

// ✅ Reusable lock check — Firestore bata verify
async function assertNotLocked(
  restaurantId: string,
  scheduleId: string
): Promise<void> {
  const snap = await getDoc(scheduleDoc(restaurantId, scheduleId));
  if (snap.data()?.locked === true) {
    throw new Error("Schedule is locked — payroll already generated");
  }
}

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

// ✅ employeeSnapshot + restaurantSnapshot saved!
export async function createSchedule(
  restaurantId: string,
  employee: EmployeeDB,
  weekStart: string,
  settings?: RestaurantSettings
): Promise<void> {
  const data = buildScheduleData(
    employee,
    weekStart,
    restaurantId,
    settings ?? DEFAULT_SETTINGS
  );
  await addDoc(col(restaurantId), {
    ...data,
    userId:    auth.currentUser?.uid ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ✅ Lock check from Firestore — not from UI!
export async function updateScheduleDay(
  restaurantId: string,
  scheduleId: string,
  dayKey: string,
  updatedDay: DaySchedule,
  stats: WeekSummary
): Promise<void> {
  await assertNotLocked(restaurantId, scheduleId);
  await updateDoc(scheduleDoc(restaurantId, scheduleId), {
    ["days." + dayKey]: updatedDay,
    ...stats,
    updatedAt: serverTimestamp(),
  });
}

// ✅ Delete pani locked check!
export async function deleteSchedule(
  restaurantId: string,
  scheduleId: string
): Promise<void> {
  await assertNotLocked(restaurantId, scheduleId);
  await deleteDoc(scheduleDoc(restaurantId, scheduleId));
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

// ✅ Batch write + timezone safe + fresh snapshot
export async function copyWeekSchedules(
  restaurantId: string,
  fromWeek: string,
  employeeMap: Record<string, EmployeeDB>
): Promise<{ copied: number; skipped: number }> {
  const nextWeek  = addDays(fromWeek, 7);
  const nextDates = getWeekDates(nextWeek);

  const [currentSchedules, existingSchedules] = await Promise.all([
    getSchedulesByWeek(restaurantId, fromWeek),
    getSchedulesByWeek(restaurantId, nextWeek),
  ]);

  const existingNos = new Set(existingSchedules.map((s) => s.employeeNo));
  const toCreate    = currentSchedules.filter((s) => !existingNos.has(s.employeeNo));
  const skipped     = currentSchedules.length - toCreate.length;

  if (toCreate.length === 0) return { copied: 0, skipped };

  let copied  = 0;
  const LIMIT = SCHEDULE_CONFIG.BATCH_WRITE_LIMIT;

  for (let i = 0; i < toCreate.length; i += LIMIT) {
    const chunk = toCreate.slice(i, i + LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((emp) => {
      const oldDates = getWeekDates(emp.weekStart);
      const newDays: Record<string, DaySchedule> = {};
      oldDates.forEach((oldDate, idx) => {
        if (emp.days[oldDate] && nextDates[idx]) {
          newDays[nextDates[idx]] = { ...emp.days[oldDate] };
        }
      });

      const stats         = buildWeekSummary(newDays, nextDates);
      const dbEmployee    = employeeMap[emp.employeeNo];
      const freshSnapshot = dbEmployee
        ? buildEmployeeSnapshot(dbEmployee)
        : emp.employeeSnapshot;

      const newRef = doc(col(restaurantId));
      batch.set(newRef, {
        employeeId:       emp.employeeId,
        employeeNo:       emp.employeeNo,
        employeeName:     emp.employeeName,
        position:         emp.position,
        weekStart:        nextWeek,
        days:             newDays,
        restaurantId,
        employeeSnapshot: freshSnapshot,
        ...stats,
        userId:    auth.currentUser?.uid ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      copied++;
    });

    await batch.commit();
  }

  return { copied, skipped };
}