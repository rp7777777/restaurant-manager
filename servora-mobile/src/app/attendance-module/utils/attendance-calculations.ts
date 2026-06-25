// ============================================
// SERVORA ERP — Attendance Calculations
// ✅ Pure functions only
// ✅ timeToMinutes — NaN protection
// ✅ minutesToTime — negative protection
// ✅ determineStatusFromClockIn — clear naming
// ✅ Unused import removed
// ✅ No Firestore, No Settings, No UI
// FROZEN
// ============================================

import { AttendanceStatus } from "../types/attendance-types";

// ── Time to minutes ───────────────────────────
// ✅ NaN protection — empty/invalid string → 0
export function timeToMinutes(time: string): number {
  if (!time?.trim()) return 0;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

// ── Minutes to time ───────────────────────────
// ✅ Negative protection
export function minutesToTime(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const h = Math.floor(safeMinutes / 60) % 24;
  const m = safeMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Is late ───────────────────────────────────
export function isLate(
  clockIn: string,
  scheduledStart: string,
  gracePeriodMinutes: number = 0,
): boolean {
  return timeToMinutes(clockIn) >
    timeToMinutes(scheduledStart) + gracePeriodMinutes;
}

// ── Is overnight ──────────────────────────────
export function isOvernightShift(
  clockIn: string,
  clockOut: string,
): boolean {
  return timeToMinutes(clockOut) < timeToMinutes(clockIn);
}

// ── Status from clock in only ─────────────────
// ✅ Renamed — only handles clock-in based status
// SICK / VACATION / HOLIDAY / OFF → manual entry
export function determineStatusFromClockIn(
  clockIn: string | undefined,
  scheduledStart: string | undefined,
  lateThresholdMinutes: number = 15,
): AttendanceStatus {
  if (!clockIn) return "ABSENT";
  if (!scheduledStart) return "PRESENT";
  const late = timeToMinutes(clockIn) - timeToMinutes(scheduledStart);
  if (late > lateThresholdMinutes) return "LATE";
  return "PRESENT";
}

// ── Format duration ───────────────────────────
// 8.5 → "8h 30m"
export function formatDuration(hours: number): string {
  if (hours <= 0) return "0h";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Format late minutes ───────────────────────
// 75 → "1h 15m late"
export function formatLateMinutes(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes < 60) return `${minutes}m late`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h late`;
  return `${h}h ${m}m late`;
}