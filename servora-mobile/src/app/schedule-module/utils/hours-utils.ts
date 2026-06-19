// ============================================
// SERVORA ERP — Hours Utils
// Used by: Schedule, Payroll, Attendance
// ✅ Night shift fix (22:00 → 06:00 = 8h)
// ✅ Break time support
// ✅ OT + Night shift helpers
// ============================================

import { SCHEDULE_CONFIG } from "../constants/schedule-config";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Calculate worked hours
 * ✅ Night shift: 22:00 → 06:00 = 8h (not 0)
 * ✅ Break deducted
 */
export function calcHours(
  start: string,
  end: string,
  breakMinutes = SCHEDULE_CONFIG.DEFAULT_BREAK_MINUTES
): number {
  if (!start || !end) return 0;
  let startMins = toMinutes(start);
  let endMins   = toMinutes(end);

  // ✅ Night shift fix
  if (endMins <= startMins) endMins += 24 * 60;

  const total = endMins - startMins - breakMinutes;
  return Math.max(0, parseFloat((total / 60).toFixed(2)));
}

/**
 * Calculate night hours within a shift
 * Night window: 22:00 → 06:00
 * e.g. 20:00 → 02:00 = 4 night hours
 */
export function calcNightHours(start: string, end: string): number {
  if (!start || !end) return 0;
  let startMins = toMinutes(start);
  let endMins   = toMinutes(end);
  if (endMins <= startMins) endMins += 24 * 60;

  const nightStart = SCHEDULE_CONFIG.NIGHT_START_HOUR * 60;
  const nightEnd   = SCHEDULE_CONFIG.NIGHT_END_HOUR * 60;

  let nightMins = 0;
  for (let t = startMins; t < endMins; t++) {
    const tMod = t % (24 * 60);
    if (tMod >= nightStart || tMod < nightEnd) {
      nightMins++;
    }
  }
  return parseFloat((nightMins / 60).toFixed(2));
}

/**
 * ✅ Daily OT — per day (not weekly average)
 * e.g. 12h worked → 4h OT
 */
export function calcOvertimeHours(workedHours: number): number {
  return Math.max(
    0,
    parseFloat((workedHours - SCHEDULE_CONFIG.NORMAL_DAILY_HOURS).toFixed(2))
  );
}

/**
 * ✅ Is this a night shift?
 * Future: report ma "Night Shift Employees" filter
 */
export function isNightShift(start: string, end: string): boolean {
  return calcNightHours(start, end) > 0;
}

/**
 * Calculate paid hours after break
 */
export function calcPaidHours(
  totalHours: number,
  breakMinutes: number
): number {
  return Math.max(0, parseFloat((totalHours - breakMinutes / 60).toFixed(2)));
}

/**
 * Round hours to 2 decimal places
 */
export function roundHours(hours: number): number {
  return parseFloat(hours.toFixed(2));
}

/**
 * Convert decimal hours to display
 * e.g. 8.5 → "8h 30m"
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return h + "h";
  return h + "h " + m + "m";
}