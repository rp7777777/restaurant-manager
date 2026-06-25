// ============================================
// SERVORA ERP — Schedule Types
// ✅ EmployeeSnapshot — salary history
// ✅ RestaurantSnapshot — settings history
// ============================================

import { Timestamp } from "firebase/firestore";

export type DayStatus =
  | "WORK"
  | "DO"
  | "DC"
  | "ABSENT"
  | "HOLIDAY"
  | "SICK"
  | "VACATION"
  | "TRAINING";

export interface DaySchedule {
  status: DayStatus;
  startTime: string;
  endTime: string;
  hours: number;
  breakMinutes?: number;
  nightHours?: number;
}

export interface WeekSummary {
  totalHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  trainingHours: number;
  grossPayHours: number;
  workingDays: number;
  absentDays: number;
  holidayDays: number;
  sickDays: number;
  vacationDays: number;
  trainingDays: number;
}

export interface EmployeeSnapshot {
  basicSalary:  number;
  hourlyRate:   number;
  overtimeRate: number;
  holidayRate:  number;
  nightRate:    number;
  taxRate?:     number | null;  // ✅ null accept garxa
  ssRate?:      number | null;  // ✅ null accept garxa
}
export interface RestaurantSnapshot {
  currency: string;
  currencySymbol: string;
  paymentType: string;
  normalDailyHours: number;
  normalWeeklyHours: number;
  defaultShiftStart: string;
  defaultTaxRate: number;
  defaultSSRate: number;
  payrollMonthDays: number;
}

export interface EmployeeSchedule extends WeekSummary {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  position: string;
  weekStart: string;
  days: Record<string, DaySchedule>;
  restaurantId: string;
  userId?: string;
  employeeSnapshot: EmployeeSnapshot;
  restaurantSnapshot: RestaurantSnapshot;
  locked?: boolean;
  removed?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}