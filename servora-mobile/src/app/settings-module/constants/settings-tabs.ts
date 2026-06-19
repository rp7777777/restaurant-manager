// ============================================
// SERVORA ERP — Settings Tabs
// ✅ Permission-based tab visibility
// ✅ No role hardcode
// ✅ 10/10 production ready
// ============================================

import { Permission } from "./permissions";

export type SettingsTabKey =
  | "general"
  | "finance"
  | "attendance"
  | "payroll"
  | "leave"
  | "employees"
  | "security";

export interface SettingsTab {
  key:                SettingsTabKey;
  label:              string;
  emoji:              string;
  requiredPermission: Permission;
}

export const SETTINGS_TABS: SettingsTab[] = [
  { key: "general",    label: "General",    emoji: "🏪", requiredPermission: "edit_settings" },
  { key: "finance",    label: "Finance",    emoji: "💰", requiredPermission: "edit_settings" },
  { key: "attendance", label: "Attendance", emoji: "🕐", requiredPermission: "edit_settings" },
  { key: "payroll",    label: "Payroll",    emoji: "💵", requiredPermission: "edit_payroll"  },
  { key: "leave",      label: "Leave",      emoji: "📅", requiredPermission: "edit_settings" },
  { key: "employees",  label: "Employees",  emoji: "👥", requiredPermission: "edit_employees"},
  { key: "security",   label: "Security",   emoji: "🔒", requiredPermission: "manage_permissions" },
];

// ✅ Permission-based filter
export function getAccessibleTabs(
  userPermissions: Permission[]
): SettingsTab[] {
  return SETTINGS_TABS.filter((tab) =>
    userPermissions.includes(tab.requiredPermission)
  );
}

export function canAccessTab(
  tab:             SettingsTab,
  userPermissions: Permission[]
): boolean {
  return userPermissions.includes(tab.requiredPermission);
}

