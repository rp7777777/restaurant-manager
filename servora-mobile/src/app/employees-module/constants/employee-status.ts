// ============================================
// SERVORA ERP — Employee Statuses
// ============================================

import { EmployeeStatus } from "../types/employee-types";

export const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  "ACTIVE",
  "PROBATION",
  "ON_LEAVE",
  "INACTIVE",
  "TERMINATED",
];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE:     "Active",
  PROBATION:  "Probation",
  ON_LEAVE:   "On Leave",
  INACTIVE:   "Inactive",
  TERMINATED: "Terminated",
};

export function isValidEmployeeStatus(status: string): status is EmployeeStatus {
  return EMPLOYEE_STATUSES.includes(status as EmployeeStatus);
}