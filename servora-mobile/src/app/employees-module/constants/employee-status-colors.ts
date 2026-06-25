// ============================================
// SERVORA ERP — Employee Status Colors
// ============================================

import { EmployeeStatus } from "../types/employee-types";

export const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ACTIVE:     "#10b981",
  PROBATION:  "#f59e0b",
  ON_LEAVE:   "#3b82f6",
  INACTIVE:   "#94a3b8",
  TERMINATED: "#ef4444",
};

export const STATUS_BG_COLORS: Record<EmployeeStatus, string> = {
  ACTIVE:     "#10b98120",
  PROBATION:  "#f59e0b20",
  ON_LEAVE:   "#3b82f620",
  INACTIVE:   "#94a3b820",
  TERMINATED: "#ef444420",
};