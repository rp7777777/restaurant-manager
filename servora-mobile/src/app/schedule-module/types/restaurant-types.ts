// ============================================
// SERVORA ERP — Restaurant Settings Types
// Shared by: Schedule, Payroll, Attendance, Store
// No circular dependency!
// ✅ defaultExpiryAlertDays — restaurant-wide fallback for the
//    Store Module's expiry alert system (lowest priority tier:
//    Item Override → Category Setting → Restaurant Default →
//    hardcoded 7-day fallback). OPTIONAL — 13 existing files
//    construct RestaurantSettings objects that predate this field;
//    making it required would break all of them. Callers should use
//    `settings?.defaultExpiryAlertDays ?? 7`.
//    Convention: 0 = expiry alerts disabled for this restaurant
//    (reserved for a future "turn off expiry notifications" toggle
//    — not yet built, but the resolver function honors 0 as
//    "disabled" rather than "alert 0 days before", to leave this
//    door open).
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
  defaultExpiryAlertDays?: number;
}