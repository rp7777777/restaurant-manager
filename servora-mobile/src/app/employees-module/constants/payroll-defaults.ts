// ============================================
// SERVORA ERP — Payroll Defaults
// ✅ Worldwide ready — no country hardcoding
// ✅ Hours → employee-defaults.ts (single source)
// ✅ Country rules → settings-module
// ✅ Calculation formatting only
// FROZEN
// ============================================

export const PAYROLL_DEFAULTS = {
  // ── Rounding ────────────────────────────
  // Worldwide standard — no country specific
  SALARY_DECIMAL_PLACES: 2,
  HOURS_DECIMAL_PLACES:  2,

  // MIN_MONTHS_FOR_SUBSIDY ❌ → settings.payroll.minMonthsForAdditionalPay
  // DAILY_HOURS            ❌ → employee-defaults.DEFAULT_DAILY_HOURS
  // WEEKLY_HOURS           ❌ → employee-defaults.DEFAULT_WEEKLY_HOURS
  // MONTHLY_HOURS          ❌ → employee-defaults.DEFAULT_MONTHLY_HOURS
  // DEFAULT_TAX_RATE       ❌ → settings.defaultTaxRate
  // DEFAULT_SS_RATE        ❌ → settings.defaultSSRate
} as const;