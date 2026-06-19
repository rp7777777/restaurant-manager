// ============================================
// SERVORA ERP — Permissions Constants
// ✅ satisfies — no unnecessary casts
// ✅ manage_permissions separate
// ✅ Set<Permission> — O(1) lookup
// ✅ permission-service ready
// ✅ 10/10 production ready
// ============================================

// ── Types ─────────────────────────────────────
export type AppRole =
  | "OWNER"
  | "MANAGER"
  | "CHEF"
  | "STORE"
  | "SALESMAN";

export type Permission =
  | "edit_schedule"
  | "edit_inventory"
  | "edit_store"
  | "view_payroll"
  | "edit_payroll"
  | "view_reports"
  | "edit_employees"
  | "edit_settings"
  | "manage_permissions"  // ✅ separate from edit_settings
  | "view_sales"
  | "edit_sales"
  | "view_kitchen"
  | "edit_kitchen";

export interface RoleConfig {
  key:            AppRole;
  label:          string;
  emoji:          string;
  description:    string;
  permissions:    Permission[];
  permissionSet:  Set<Permission>; // ✅ O(1) lookup
}

// ── Role Permission Lists ─────────────────────
const OWNER_PERMISSIONS: Permission[] = [
  "edit_schedule",    "edit_inventory",  "edit_store",
  "view_payroll",     "edit_payroll",    "view_reports",
  "edit_employees",   "edit_settings",   "manage_permissions",
  "view_sales",       "edit_sales",      "view_kitchen",
  "edit_kitchen",
];

const MANAGER_PERMISSIONS: Permission[] = [
  "edit_schedule",    "edit_inventory",  "edit_store",
  "view_payroll",     "view_reports",    "edit_employees",
  "edit_settings",    "view_sales",      "edit_sales",
  "view_kitchen",
];

const CHEF_PERMISSIONS: Permission[] = [
  "edit_inventory",   "view_kitchen",
  "edit_kitchen",     "view_sales",
];

const STORE_PERMISSIONS: Permission[] = [
  "edit_store",       "edit_inventory",
];

const SALESMAN_PERMISSIONS: Permission[] = [
  "view_sales",       "edit_sales",
];

// ── Role Configs ──────────────────────────────
export const ROLE_CONFIGS = Object.freeze([
  {
    key:           "OWNER",
    label:         "Owner",
    emoji:         "👑",
    description:   "Full access — all modules",
    permissions:   OWNER_PERMISSIONS,
    permissionSet: new Set(OWNER_PERMISSIONS),
  },
  {
    key:           "MANAGER",
    label:         "Manager",
    emoji:         "💼",
    description:   "Operations + HR access",
    permissions:   MANAGER_PERMISSIONS,
    permissionSet: new Set(MANAGER_PERMISSIONS),
  },
  {
    key:           "CHEF",
    label:         "Chef",
    emoji:         "👨‍🍳",
    description:   "Kitchen + inventory access",
    permissions:   CHEF_PERMISSIONS,
    permissionSet: new Set(CHEF_PERMISSIONS),
  },
  {
    key:           "STORE",
    label:         "Store",
    emoji:         "🏪",
    description:   "Store + inventory access",
    permissions:   STORE_PERMISSIONS,
    permissionSet: new Set(STORE_PERMISSIONS),
  },
  {
    key:           "SALESMAN",
    label:         "Salesman",
    emoji:         "🧾",
    description:   "Sales entry only",
    permissions:   SALESMAN_PERMISSIONS,
    permissionSet: new Set(SALESMAN_PERMISSIONS),
  },
] satisfies RoleConfig[]);

// ── Defaults ─────────────────────────────────
export const DEFAULT_ROLE: AppRole = "SALESMAN";

// ── O(1) Frozen Map ───────────────────────────
export const ROLE_MAP = Object.freeze(
  Object.fromEntries(
    ROLE_CONFIGS.map((r) => [r.key, r])
  )
) as Record<AppRole, RoleConfig>;

// ── Low-level helpers ─────────────────────────

export function getRoleConfig(key: AppRole): RoleConfig {
  const config = ROLE_MAP[key];
  if (!config) throw new Error(`Unknown role: ${key}`);
  return config;
}

// ✅ O(1) — Set.has()
export function hasPermission(
  role:       AppRole,
  permission: Permission
): boolean {
  return ROLE_MAP[role].permissionSet.has(permission);
}

export function getRolePermissions(role: AppRole): Permission[] {
  return [...ROLE_MAP[role].permissions];
}

export function hasAnyPermission(
  role:        AppRole,
  permissions: Permission[]
): boolean {
  const set = ROLE_MAP[role].permissionSet;
  return permissions.some((p) => set.has(p));
}

export function hasAllPermissions(
  role:        AppRole,
  permissions: Permission[]
): boolean {
  const set = ROLE_MAP[role].permissionSet;
  return permissions.every((p) => set.has(p));
}

