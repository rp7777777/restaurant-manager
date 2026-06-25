// ============================================
// SERVORA ERP — Attendance Status Colors
// FROZEN
// ============================================

import { AttendanceStatus } from "../types/attendance-types";

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT:  "#10b981",
  ABSENT:   "#ef4444",
  LATE:     "#f59e0b",
  SICK:     "#3b82f6",
  VACATION: "#8b5cf6",
  HOLIDAY:  "#FFD700",
  OFF:      "#94a3b8",
};

export const ATTENDANCE_STATUS_BG_COLORS: Record<AttendanceStatus, string> = {
  PRESENT:  "#10b98120",
  ABSENT:   "#ef444420",
  LATE:     "#f59e0b20",
  SICK:     "#3b82f620",
  VACATION: "#8b5cf620",
  HOLIDAY:  "#FFD70020",
  OFF:      "#94a3b820",
};