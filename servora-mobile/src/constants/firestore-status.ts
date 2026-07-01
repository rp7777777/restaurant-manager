// ============================================
// SERVORA ERP — Firestore Status Constants
// ✅ All status strings in one place
// ✅ No magic strings anywhere
// FROZEN
// ============================================

// ── Attendance ────────────────────────────────
export const ATTENDANCE_STATUS = {
  PRESENT:  "PRESENT",
  ABSENT:   "ABSENT",
  LATE:     "LATE",
  SICK:     "SICK",
  VACATION: "VACATION",
  HOLIDAY:  "HOLIDAY",
  OFF:      "OFF",
} as const;

export type AttendanceStatusType =
  typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

// ── Payroll ───────────────────────────────────
export const PAYROLL_STATUS = {
  DRAFT:     "DRAFT",
  GENERATED: "GENERATED",
  PAID:      "PAID",
} as const;

export type PayrollStatusType =
  typeof PAYROLL_STATUS[keyof typeof PAYROLL_STATUS];

// ── Inventory ─────────────────────────────────
export const INVENTORY_STATUS = {
  IN_STOCK:    "IN_STOCK",
  LOW_STOCK:   "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
} as const;

export type InventoryStatusType =
  typeof INVENTORY_STATUS[keyof typeof INVENTORY_STATUS];

// ── Schedule ──────────────────────────────────
export const SCHEDULE_STATUS = {
  WORK:     "WORK",
  OFF:      "OFF",
  HOLIDAY:  "HOLIDAY",
  SICK:     "SICK",
  VACATION: "VACATION",
  TRAINING: "TRAINING",
  ABSENT:   "ABSENT",
} as const;

export type ScheduleStatusType =
  typeof SCHEDULE_STATUS[keyof typeof SCHEDULE_STATUS];

// ── Document ──────────────────────────────────
export const DOCUMENT_STATUS = {
  VALID:    "VALID",
  EXPIRING: "EXPIRING",  // within 30 days
  EXPIRED:  "EXPIRED",
} as const;

export type DocumentStatusType =
  typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

// ── HACCP ─────────────────────────────────────
export const HACCP_STATUS = {
  PENDING:   "PENDING",
  COMPLETED: "COMPLETED",
  FAILED:    "FAILED",
  SKIPPED:   "SKIPPED",
} as const;

export type HACCPStatusType =
  typeof HACCP_STATUS[keyof typeof HACCP_STATUS];

// ── Employee ──────────────────────────────────
export const EMPLOYEE_STATUS = {
  ACTIVE:    "ACTIVE",
  INACTIVE:  "INACTIVE",
  ON_LEAVE:  "ON_LEAVE",
} as const;

export type EmployeeStatusType =
  typeof EMPLOYEE_STATUS[keyof typeof EMPLOYEE_STATUS];

// ── Payment ───────────────────────────────────
export const PAYMENT_METHOD = {
  CASH:   "CASH",
  CARD:   "CARD",
  ONLINE: "ONLINE",
  OTHER:  "OTHER",
} as const;

export type PaymentMethodType =
  typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];