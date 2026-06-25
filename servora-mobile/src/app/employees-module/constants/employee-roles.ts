// ============================================
// SERVORA ERP — Employee Roles & Access Levels
// ============================================

import { EmployeeRole, AccessLevel } from "../types/employee-types";

export const EMPLOYEE_ROLES: EmployeeRole[] = [
  "OWNER",
  "MANAGER",
  "SUPERVISOR",
  "CHEF",
  "WAITER",
  "CASHIER",
  "STORE_KEEPER",
  "DELIVERY",
  "STAFF",
];

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  OWNER:        "Owner",
  MANAGER:      "Manager",
  SUPERVISOR:   "Supervisor",
  CHEF:         "Chef",
  WAITER:       "Waiter / Waitress",
  CASHIER:      "Cashier",
  STORE_KEEPER: "Store Keeper",
  DELIVERY:     "Delivery",
  STAFF:        "Staff",
};

// ✅ Default role — new employee
export const DEFAULT_ROLE: EmployeeRole = "STAFF";

// ✅ Default access level
export const DEFAULT_ACCESS_LEVEL: AccessLevel = "STAFF";

// ✅ Role → AccessLevel default mapping
export const ROLE_ACCESS_MAP: Record<EmployeeRole, AccessLevel> = {
  OWNER:        "OWNER",
  MANAGER:      "MANAGER",
  SUPERVISOR:   "SUPERVISOR",
  CHEF:         "SUPERVISOR",
  WAITER:       "STAFF",
  CASHIER:      "STAFF",
  STORE_KEEPER: "STAFF",
  DELIVERY:     "STAFF",
  STAFF:        "STAFF",
};

export const ACCESS_LEVELS: AccessLevel[] = [
  "OWNER",
  "MANAGER",
  "SUPERVISOR",
  "STAFF",
];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  OWNER:      "Owner",
  MANAGER:    "Manager",
  SUPERVISOR: "Supervisor",
  STAFF:      "Staff",
};

// ✅ Firestore validation helper
export function isValidEmployeeRole(role: string): role is EmployeeRole {
  return EMPLOYEE_ROLES.includes(role as EmployeeRole);
}

export function isValidAccessLevel(level: string): level is AccessLevel {
  return ACCESS_LEVELS.includes(level as AccessLevel);
}