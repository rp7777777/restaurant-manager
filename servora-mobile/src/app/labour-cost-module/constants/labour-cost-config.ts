// ============================================
// SERVORA ERP — Labour Cost Config
// ✅ Industry standard thresholds
// ✅ Worldwide ready — no country hardcoding
// ✅ Settings override ready
// FROZEN
// ============================================

import { LabourCostThresholds } from "../types/labour-cost-types";

// ── Industry standard thresholds ─────────────
// Restaurant industry: 25-35% labour cost ideal
export const DEFAULT_LABOUR_COST_THRESHOLDS: LabourCostThresholds = {
  labourCostWarning:  30,   // % — yellow
  labourCostDanger:   35,   // % — red
  overtimeWarning:    40,   // hours per month
  attendanceMinimum:  85,   // %
};

// ── Chart config ──────────────────────────────
export const LABOUR_COST_CHART_CONFIG = {
  MAX_DAYS_DAILY_VIEW:   31,  // 1 month max daily points
  MAX_WEEKS_WEEKLY_VIEW: 12,  // 3 months weekly view
  // ✅ v1: 12 months — v2: increase to 24/36 for YoY analysis
  MAX_MONTHS_TREND:      12,
  ANIMATION_DURATION:    300, // ms — chart transition
} as const;

// ── Table config ──────────────────────────────
export const LABOUR_COST_TABLE_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,   // ✅ Initial table page — virtualization ready
  MAX_PAGE_SIZE:     100,  // ✅ Performance limit — avoid large renders
} as const;

// ── Rounding ──────────────────────────────────
export const LABOUR_COST_DECIMAL_PLACES = 2;