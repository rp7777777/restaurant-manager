// ============================================
// SERVORA ERP — Dashboard Constants
// ✅ Explicit types — MenuItem, QuickAction
// ✅ labelKey — i18n compatible
// ✅ route: string — Expo Router compatible
// ✅ icon: MaterialIcons type-safe
// ✅ color consistent — no colorKey mixing
// ✅ getYearRange() — function, not static
// FROZEN
// ============================================

import { MaterialIcons } from "@expo/vector-icons";

// ── Types ─────────────────────────────────────
export interface DashboardMenuItem {
  labelKey: string;
  icon:     keyof typeof MaterialIcons.glyphMap;
  route:    string;
  color:    string;
}

export interface DashboardQuickAction {
  labelKey: string;
  icon:     keyof typeof MaterialIcons.glyphMap;
  route:    string;
  color:    string;
}

// ── Months ────────────────────────────────────
export const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
] as const;

export const MONTH_NAMES = [
  "January","February","March","April",
  "May","June","July","August",
  "September","October","November","December",
] as const;

// ✅ Function — updates on new year
export const getYearRange = (): number[] =>
  Array.from(
    { length: 10 },
    (_, i) => new Date().getFullYear() - 5 + i
  );

// ✅ DashboardMenuItem[]
export const MENU_ITEMS: DashboardMenuItem[] = [
  { labelKey: "salesEntry", icon: "point-of-sale",  route: "/add-sale",           color: "#10b981" },
  { labelKey: "expenses",   icon: "receipt",         route: "/expenses",           color: "#ef4444" },
  { labelKey: "inventory",  icon: "inventory",       route: "/inventory-module",   color: "#f59e0b" },
  { labelKey: "kitchen",    icon: "restaurant",      route: "/kitchen-module",     color: "#06b6d4" },
  { labelKey: "store",      icon: "store",           route: "/store-module",       color: "#8b5cf6" },
  { labelKey: "payroll",    icon: "payments",        route: "/payroll-module",     color: "#14b8a6" },
  { labelKey: "schedule",   icon: "calendar-month",  route: "/schedule-module",    color: "#f97316" },
  { labelKey: "reports",    icon: "bar-chart",       route: "/analytics",          color: "#3b82f6" },
  { labelKey: "settings",   icon: "settings",        route: "/settings",           color: "#64748b" },
];

// ✅ DashboardQuickAction[]
export const QUICK_ACTIONS: DashboardQuickAction[] = [
  { labelKey: "salesEntry", icon: "add",            route: "/add-sale",           color: "#10b981" },
  { labelKey: "expenses",   icon: "add",            route: "/expenses",           color: "#ef4444" },
  { labelKey: "schedule",   icon: "calendar-month", route: "/schedule-module",    color: "#3b82f6" },
  { labelKey: "labourCost", icon: "bar-chart",      route: "/labour-cost-module", color: "#8b5cf6" },
  { labelKey: "backup",     icon: "backup",         route: "/backup",             color: "#64748b" },
];

// ── Labour Cost Thresholds ────────────────────
export const LABOUR_COST_THRESHOLDS = {
  HIGH:   35,
  MEDIUM: 30,
} as const;