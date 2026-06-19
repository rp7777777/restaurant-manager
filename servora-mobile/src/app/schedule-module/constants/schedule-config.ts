// ============================================
// SERVORA ERP — Schedule Config
// Business rules — change here = change everywhere
// Portugal labour law defaults
// ============================================

import { DayStatus } from "../types/schedule-types";

export const SCHEDULE_CONFIG = {
  // Work hours
  NORMAL_DAILY_HOURS:    8,
  NORMAL_WEEKLY_HOURS:   40,
  MONTHLY_HOURS:         160,

  // Default rates
  DEFAULT_OT_RATE:       1.5,
  DEFAULT_HOLIDAY_RATE:  2.0,
  DEFAULT_NIGHT_RATE:    1.25,

  // Night shift window
  NIGHT_START_HOUR:      22,
  NIGHT_END_HOUR:        6,

  // Default shift
  DEFAULT_START_TIME:    "09:00",
  DEFAULT_END_TIME:      "17:00",
  DEFAULT_BREAK_MINUTES: 0,
  DEFAULT_DAY_HOURS:     8,
  DEFAULT_STATUS:        "WORK" as DayStatus,

  // Payroll
  DEFAULT_TAX_RATE:      11,
  DEFAULT_SS_RATE:       11,
  DEFAULT_TOTAL_DAYS:    30,

  // Firestore limits
  FIRESTORE_IN_QUERY_LIMIT: 30,
  BATCH_WRITE_LIMIT:        400,
} as const;

export const DAYS_EN = [
  "MON","TUE","WED","THU","FRI","SAT","SUN",
] as const;

export const MONTHS_EN = [
  "January","February","March","April",
  "May","June","July","August",
  "September","October","November","December",
] as const;