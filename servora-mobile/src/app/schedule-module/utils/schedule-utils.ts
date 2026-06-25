// ============================================
// SERVORA ERP — Schedule Utils
// ✅ Updated to new EmployeeDB fields
// ✅ employeeNumber (not employeeNo)
// ✅ firstName + lastName (not fullName)
// ✅ monthlySalary (not basicSalary)
// ✅ taxRate/ssRate — null not undefined
// ✅ EmployeeSnapshot explicit return type
// ✅ No circular dependency
// ✅ 7.5h → 16:30 correct time calc
// ✅ Negative hours protection
// ✅ Both snapshots saved
// ============================================

import {
  EmployeeSchedule,
  DaySchedule,
  RestaurantSnapshot,
  EmployeeSnapshot,
} from "../types/schedule-types";
import { RestaurantSettings } from "../types/restaurant-types";
import { SCHEDULE_CONFIG } from "../constants/schedule-config";
import { calcHours } from "./hours-utils";
import { buildWeekSummary } from "./overtime-utils";
import { getWeekDates } from "./date-utils";
import { EmployeeDB } from "../types/employee-types";

export function isAlreadyAdded(
  schedules: EmployeeSchedule[],
  employeeNo: string
): boolean {
  return schedules.some((s) => s.employeeNo === employeeNo);
}

export function buildDefaultDays(
  weekDates: string[],
  normalDailyHours?: number,
  defaultShiftStart?: string
): Record<string, DaySchedule> {
  const safeHours  = Math.max(0, normalDailyHours ?? SCHEDULE_CONFIG.NORMAL_DAILY_HOURS);
  const shiftStart = defaultShiftStart ?? SCHEDULE_CONFIG.DEFAULT_START_TIME;

  const parts  = shiftStart.split(":");
  const startH = parseInt(parts[0], 10) || 9;
  const startM = parseInt(parts[1], 10) || 0;

  const totalMinutes      = startH * 60 + startM + Math.round(safeHours * 60);
  const normalizedMinutes = totalMinutes % (24 * 60);
  const endH              = Math.floor(normalizedMinutes / 60);
  const endM              = normalizedMinutes % 60;
  const endTime           =
    String(endH).padStart(2, "0") + ":" +
    String(endM).padStart(2, "0");

  const days: Record<string, DaySchedule> = {};
  weekDates.forEach((date) => {
    days[date] = {
      status:       SCHEDULE_CONFIG.DEFAULT_STATUS,
      startTime:    shiftStart,
      endTime,
      hours:        calcHours(shiftStart, endTime),
      breakMinutes: SCHEDULE_CONFIG.DEFAULT_BREAK_MINUTES,
      nightHours:   0,
    };
  });
  return days;
}

// ✅ null not undefined — Firestore safe
// ✅ explicit return type
export function buildEmployeeSnapshot(employee: EmployeeDB): EmployeeSnapshot {
  return {
    basicSalary:  employee.monthlySalary,
    hourlyRate:   employee.hourlyRate,
    overtimeRate: 0,
    holidayRate:  0,
    nightRate:    0,
    taxRate:      employee.taxRate ?? null,
    ssRate:       employee.ssRate  ?? null,
  };
}

export function buildRestaurantSnapshot(
  settings: RestaurantSettings
): RestaurantSnapshot {
  return {
    currency:          settings.currency          ?? "EUR",
    currencySymbol:    settings.currencySymbol    ?? "€",
    paymentType:       settings.paymentType       ?? "MONTHLY",
    normalDailyHours:  settings.normalDailyHours  ?? 8,
    normalWeeklyHours: settings.normalWeeklyHours ?? 40,
    defaultShiftStart: settings.defaultShiftStart ?? "09:00",
    defaultTaxRate:    settings.defaultTaxRate    ?? 11,
    defaultSSRate:     settings.defaultSSRate     ?? 11,
    payrollMonthDays:  settings.payrollMonthDays  ?? 30,
  };
}

export function buildScheduleData(
  employee: EmployeeDB,
  weekStart: string,
  restaurantId: string,
  settings: RestaurantSettings
): Omit<EmployeeSchedule, "id"> {
  const weekDates = getWeekDates(weekStart);
  const rSnap     = buildRestaurantSnapshot(settings);
  const days      = buildDefaultDays(
    weekDates,
    rSnap.normalDailyHours,
    rSnap.defaultShiftStart
  );
  const stats = buildWeekSummary(days, weekDates);

  return {
    employeeId:   employee.id,
    employeeNo:   employee.employeeNumber,
    employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
    position:     employee.position,
    weekStart,
    days,
    restaurantId,
    employeeSnapshot:   buildEmployeeSnapshot(employee),
    restaurantSnapshot: rSnap,
    ...stats,
  };
}

export function getAddedEmployeeNos(
  schedules: EmployeeSchedule[]
): Set<string> {
  return new Set(schedules.map((s) => s.employeeNo));
}

export function isScheduleLocked(schedule: EmployeeSchedule): boolean {
  return schedule.locked === true;
}

export function getTotalOT(schedules: EmployeeSchedule[]): number {
  return parseFloat(
    schedules.reduce((s, e) => s + (e.overtimeHours || 0), 0).toFixed(2)
  );
}

export function getTotalAbsent(schedules: EmployeeSchedule[]): number {
  return schedules.reduce((s, e) => s + (e.absentDays || 0), 0);
}