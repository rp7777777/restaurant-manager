// ============================================
// SERVORA ERP — Theme System
// ✅ Theme interface — reusable
// ✅ Future-proof colors
// ✅ THEMES only — Language system separated
// FROZEN
// ============================================

export type ThemeName = "navyDark" | "purpleDark" | "light";

// ✅ Theme interface — reusable
export interface Theme {
  name:              string;
  bg:                string;
  surface:           string;
  card:              string;
  sidebar:           string;
  sidebarText:       string;
  sidebarActive:     string;
  sidebarActiveText: string;
  sidebarSection:    string;
  text:              string;
  textSecondary:     string;
  border:            string;
  primary:           string;
  accent:            string;
  error:             string;
  navBg:             string;
  navText:           string;
  // ✅ Future-proof colors
  success:           string;
  warning:           string;
  info:              string;
  disabled:          string;
  overlay:           string;
  shadow:            string;
}

export const THEMES: Record<ThemeName, Theme> = {
  navyDark: {
    name:              "Navy Dark",
    bg:                "#eef2f7",
    surface:           "#ffffff",
    card:              "#ffffff",
    sidebar:           "#00154f",
    sidebarText:       "rgba(255,255,255,0.8)",
    sidebarActive:     "rgba(255,215,0,0.15)",
    sidebarActiveText: "#FFD700",
    sidebarSection:    "rgba(255,255,255,0.3)",
    text:              "#1a1a2e",
    textSecondary:     "#64748b",
    border:            "rgba(255,255,255,0.1)",
    primary:           "#00154f",
    accent:            "#FFD700",
    error:             "#ef4444",
    navBg:             "#00154f",
    navText:           "#ffffff",
    success:           "#10b981",
    warning:           "#f59e0b",
    info:              "#3b82f6",
    disabled:          "#94a3b8",
    overlay:           "rgba(0,0,0,0.5)",
    shadow:            "rgba(0,0,0,0.15)",
  },
  purpleDark: {
    name:              "Purple Dark",
    bg:                "#0f0f1a",
    surface:           "#1a1a2e",
    card:              "#16213e",
    sidebar:           "#1a1a2e",
    sidebarText:       "rgba(255,255,255,0.75)",
    sidebarActive:     "rgba(124,58,237,0.25)",
    sidebarActiveText: "#a78bfa",
    sidebarSection:    "rgba(255,255,255,0.25)",
    text:              "#f1f5f9",
    textSecondary:     "#94a3b8",
    border:            "rgba(255,255,255,0.08)",
    primary:           "#7c3aed",
    accent:            "#a78bfa",
    error:             "#ef4444",
    navBg:             "#1a1a2e",
    navText:           "#f1f5f9",
    success:           "#10b981",
    warning:           "#f59e0b",
    info:              "#a78bfa",
    disabled:          "#64748b",
    overlay:           "rgba(0,0,0,0.6)",
    shadow:            "rgba(0,0,0,0.3)",
  },
  light: {
    name:              "Light",
    bg:                "#f8fafc",
    surface:           "#ffffff",
    card:              "#ffffff",
    sidebar:           "#1e293b",
    sidebarText:       "rgba(255,255,255,0.8)",
    sidebarActive:     "rgba(59,130,246,0.15)",
    sidebarActiveText: "#60a5fa",
    sidebarSection:    "rgba(255,255,255,0.3)",
    text:              "#0f172a",
    textSecondary:     "#64748b",
    border:            "#e2e8f0",
    primary:           "#1e40af",
    accent:            "#3b82f6",
    error:             "#ef4444",
    navBg:             "#1e293b",
    navText:           "#ffffff",
    success:           "#10b981",
    warning:           "#f59e0b",
    info:              "#3b82f6",
    disabled:          "#94a3b8",
    overlay:           "rgba(0,0,0,0.4)",
    shadow:            "rgba(0,0,0,0.1)",
  },
};