// ============================================
// SERVORA ERP — Attendance Status Constants
// FROZEN
// ============================================

import { AttendanceStatus } from "../types/attendance-types";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT", "ABSENT", "LATE",
  "SICK", "VACATION", "HOLIDAY", "OFF",
];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT:  "Present",
  ABSENT:   "Absent",
  LATE:     "Late",
  SICK:     "Sick Leave",
  VACATION: "Vacation",
  HOLIDAY:  "Holiday",
  OFF:      "Day Off",
};

export function isValidAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}