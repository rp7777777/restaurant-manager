// ============================================
// SERVORA ERP — Overtime Utils
// Used by: Schedule, Payroll, Attendance
// ✅ Per-day OT (not weekly average)
// ✅ buildWeekSummary — one function for all
// ============================================

import { SCHEDULE_CONFIG } from "../constants/schedule-config";
import { DaySchedule, WeekSummary } from "../types/schedule-types";
import { calcOvertimeHours, calcNightHours } from "./hours-utils";

export function calcDailyOT(workedHours: number): number {
  return calcOvertimeHours(workedHours);
}

export function calcWeeklyOT(
  days: Record<string, DaySchedule>,
  weekDates: string[]
): number {
  return parseFloat(weekDates.reduce((total, date) => {
    const day = days[date];
    if (!day || day.status !== "WORK") return total;
    return total + calcDailyOT(day.hours);
  }, 0).toFixed(2));
}

export function calcWeeklyNightHours(
  days: Record<string, DaySchedule>,
  weekDates: string[]
): number {
  return parseFloat(weekDates.reduce((total, date) => {
    const day = days[date];
    if (!day || day.status !== "WORK") return total;
    return total + calcNightHours(day.startTime, day.endTime);
  }, 0).toFixed(2));
}

export function calcHolidayHours(holidayDays: number): number {
  return holidayDays * SCHEDULE_CONFIG.NORMAL_DAILY_HOURS;
}

export function calcTrainingHours(
  days: Record<string, DaySchedule>,
  weekDates: string[]
): number {
  return parseFloat(weekDates.reduce((total, date) => {
    const day = days[date];
    if (!day || day.status !== "TRAINING") return total;
    return total + (day.hours || SCHEDULE_CONFIG.NORMAL_DAILY_HOURS);
  }, 0).toFixed(2));
}

/**
 * ✅ Master function — full WeekSummary
 * Reuses existing functions — no duplicate loops!
 */
export function buildWeekSummary(
  days: Record<string, DaySchedule>,
  weekDates: string[]
): WeekSummary {
  // ✅ Reuse existing functions
  const overtimeHours  = calcWeeklyOT(days, weekDates);
  const nightHours     = calcWeeklyNightHours(days, weekDates);
  const trainingHours  = calcTrainingHours(days, weekDates);

  let totalHours   = 0;
  let holidayHours = 0;
  let workingDays  = 0;
  let absentDays   = 0;
  let holidayDays  = 0;
  let sickDays     = 0;
  let vacationDays = 0;
  let trainingDays = 0;

  weekDates.forEach((date) => {
    const day = days[date];
    if (!day) return;
    switch (day.status) {
      case "WORK":
        totalHours += day.hours;
        workingDays++;
        break;
      case "ABSENT":   absentDays++;   break;
      case "HOLIDAY":
        holidayDays++;
        holidayHours += SCHEDULE_CONFIG.NORMAL_DAILY_HOURS;
        break;
      case "SICK":     sickDays++;     break;
      case "VACATION": vacationDays++; break;
      case "TRAINING":
      trainingDays++;
      workingDays++;
      totalHours += day.hours || SCHEDULE_CONFIG.NORMAL_DAILY_HOURS;
      break;
    }
  });

  const r = (n: number) => parseFloat(n.toFixed(2));

  return {
    totalHours:    r(totalHours),
    overtimeHours: r(overtimeHours),
    nightHours:    r(nightHours),
    holidayHours:  r(holidayHours),
    trainingHours: r(trainingHours),
    // ✅ Fixed: totalHours + holidayHours + trainingHours only
   // ✅ Training = paid, already in totalHours
    grossPayHours: r(totalHours + holidayHours),
    workingDays,
    absentDays,
    holidayDays,
    sickDays,
    vacationDays,
    trainingDays,
  };
}

export function calcOTPay(
  overtimeHours: number,
  hourlyRate: number,
  otRate = SCHEDULE_CONFIG.DEFAULT_OT_RATE
): number {
  return parseFloat((overtimeHours * hourlyRate * otRate).toFixed(2));
}

export function calcHolidayPay(
  holidayHours: number,
  hourlyRate: number,
  holidayRate = SCHEDULE_CONFIG.DEFAULT_HOLIDAY_RATE
): number {
  return parseFloat((holidayHours * hourlyRate * holidayRate).toFixed(2));
}

export function calcNightPay(
  nightHours: number,
  hourlyRate: number,
  nightRate = SCHEDULE_CONFIG.DEFAULT_NIGHT_RATE
): number {
  return parseFloat((nightHours * hourlyRate * (nightRate - 1)).toFixed(2));
}