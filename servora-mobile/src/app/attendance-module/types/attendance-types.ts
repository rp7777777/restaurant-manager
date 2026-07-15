// ============================================
// SERVORA ERP — Attendance Types v1.1
// ✅ Worldwide ready — no country hardcoding
// ✅ Schedule integration — scheduledStart/End
// ✅ Payroll ready — workedHours/overtimeHours
// ✅ Employee snapshot — position freeze added
// ✅ OFF status — Sunday/Weekly/Rotating off
// ✅ scheduledHours — schedule vs actual compare
// ✅ attendanceSource — Manual/QR/GPS/Biometric ready
// ✅ AttendanceStats — KPI rates added
// ✅ normalDailyHours — persisted on record for accurate edits
// ✅ Future v2 — branchId/departmentId ready
// FROZEN
// ============================================

import { Timestamp } from "firebase/firestore";

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "SICK"
  | "VACATION"
  | "HOLIDAY"
  | "OFF"
  | "TRAINING";

export type AttendanceSource =
  | "MANUAL"
  | "CLOCK_IN"
  | "SCHEDULE";

export interface AttendanceEmployeeSnapshot {
  hourlyRate:    number;
  monthlySalary: number;
  position:      string;
}

export interface AttendanceRecord {
  id: string;
  restaurantId: string;

  employeeId:   string;
  employeeNo:   string;
  employeeName: string;

  date: string;

  status: AttendanceStatus;

  attendanceSource?: AttendanceSource;

  scheduledStart?: string;
  scheduledEnd?:   string;
  scheduledHours?: number;

  clockIn?:  string;
  clockOut?: string;

  breakMinutes:     number;
  normalDailyHours: number;
  workedHours:      number;
  overtimeHours:    number;
  lateMinutes:      number;

  employeeSnapshot: AttendanceEmployeeSnapshot;

  branchId?:     string;
  departmentId?: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceFilter {
  search: string;
  status: AttendanceStatus | "ALL";
  date:   string;
}

export interface AttendanceStats {
  total:    number;
  present:  number;
  absent:   number;
  late:     number;
  sick:     number;
  vacation: number;
  holiday:  number;
  off:      number;

  totalWorkedHours:    number;
  totalOvertimeHours:  number;
  totalLateMinutes:    number;
  totalScheduledHours: number;
  hoursVariance:       number;

  // ✅ Dashboard KPI rates
  attendanceRate: number;  // (present + late) / working total
  absenceRate:    number;  // absent / working total
  lateRate:       number;  // late / (present + late)
}