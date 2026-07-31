// ============================================
// SERVORA ERP — usePermission Hook
// ✅ Phase 1 RBAC — wires the EXISTING static permission engine
//    (app/settings-module/constants/permissions.ts, previously used
//    in exactly one place) into every screen, replacing each
//    screen's own duplicated inline
//    `const isManager = ["MANAGER","OWNER"].includes(role)` check.
// ✅ Reads role from useApp() (userProfile.role) — no prop drilling.
// ✅ Deliberately does NOT read the customizable
//    settings.security.rolePermissions override (SecuritySettings.tsx's
//    own separate system) — Phase 1 is intentionally static-only;
//    per-restaurant customization is a later Phase 2, once core ERP
//    modules are stable. See servora-roadmap for the full reasoning.
// ✅ An unrecognized/missing role (e.g. still-loading userProfile,
//    or a role string that doesn't match any AppRole) safely denies
//    all permissions rather than throwing or defaulting to allow —
//    fail-closed, not fail-open.
// ============================================

import { useApp } from "../context/AppContext";
import {
  AppRole, Permission,
  hasPermission, hasAnyPermission, hasAllPermissions,
} from "../app/settings-module/constants/permissions";

const VALID_ROLES: ReadonlySet<string> = new Set<AppRole>([
  "OWNER", "MANAGER", "CHEF", "STORE", "SALESMAN",
]);

function resolveRole(rawRole: string | undefined): AppRole | null {
  if (rawRole && VALID_ROLES.has(rawRole)) return rawRole as AppRole;
  return null;
}

// ✅ Single-permission check — the common case.
//    const canEditInventory = usePermission("edit_inventory");
export function usePermission(permission: Permission): boolean {
  const { userProfile } = useApp();
  const role = resolveRole(userProfile?.role);
  if (!role) return false;
  return hasPermission(role, permission);
}

// ✅ "Can do at least one of these" — e.g. showing a shared nav
//    entry that's relevant if the user has EITHER of two related
//    permissions.
export function useAnyPermission(permissions: Permission[]): boolean {
  const { userProfile } = useApp();
  const role = resolveRole(userProfile?.role);
  if (!role) return false;
  return hasAnyPermission(role, permissions);
}

// ✅ "Can do all of these" — e.g. a bulk action needing multiple
//    distinct permissions at once.
export function useAllPermissions(permissions: Permission[]): boolean {
  const { userProfile } = useApp();
  const role = resolveRole(userProfile?.role);
  if (!role) return false;
  return hasAllPermissions(role, permissions);
}

// ✅ Returns the resolved AppRole itself (or null) — for the rare
//    case a screen needs the role, not just a yes/no permission
//    check (e.g. showing a role-specific label).
export function useAppRole(): AppRole | null {
  const { userProfile } = useApp();
  return resolveRole(userProfile?.role);
}