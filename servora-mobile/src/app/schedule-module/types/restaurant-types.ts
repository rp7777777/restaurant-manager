// ============================================
// SERVORA ERP — Restaurant Settings Types
// Shared by: Schedule, Payroll, Attendance
// No circular dependency!
// ============================================

export interface RestaurantSettings {
  currency: string;
  currencySymbol: string;
  paymentType: "MONTHLY" | "HOURLY" | "WEEKLY";
  normalDailyHours: number;
  normalWeeklyHours: number;
  defaultTaxRate: number;
  defaultSSRate: number;
  payrollMonthDays: number;
  defaultShiftStart: string;
}