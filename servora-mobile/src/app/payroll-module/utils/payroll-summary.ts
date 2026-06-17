// ============================================
// SERVORA ERP — Payroll Summary Utils
// ✅ round2() — professional rounding
// ✅ switch — type-safe status count
// ✅ Single loop — performance optimized
// ============================================

import { PayrollDocument } from "../types/payroll-types";

export interface PayrollSummary {
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  totalSS: number;
  totalOTHours: number;
  totalWorkDays: number;
  paidCount: number;
  generatedCount: number;
  draftCount: number;
}

// ✅ Professional rounding
const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildPayrollSummary(
  payrolls: PayrollDocument[]
): PayrollSummary {
  let totalGross    = 0;
  let totalNet      = 0;
  let totalTax      = 0;
  let totalSS       = 0;
  let totalOTHours  = 0;
  let totalWorkDays = 0;
  let paid          = 0;
  let generated     = 0;
  let draft         = 0;

  payrolls.forEach((p) => {
    totalGross    += p.calculation?.grossSalary          ?? 0;
    totalNet      += p.calculation?.netSalary            ?? 0;
    totalTax      += p.calculation?.taxAmount            ?? 0;
    totalSS       += p.calculation?.socialSecurityAmount ?? 0;
    totalOTHours  += p.attendance?.overtimeHours         ?? 0;
    totalWorkDays += p.attendance?.workingDays           ?? 0;

    // ✅ switch — type-safe
    switch (p.payrollStatus) {
      case "PAID":      paid++;      break;
      case "GENERATED": generated++; break;
      case "DRAFT":     draft++;     break;
    }
  });

  return {
    totalEmployees: payrolls.length,
    totalGross:     round2(totalGross),
    totalNet:       round2(totalNet),
    totalTax:       round2(totalTax),
    totalSS:        round2(totalSS),
    totalOTHours:   round2(totalOTHours),
    totalWorkDays,
    paidCount:      paid,
    generatedCount: generated,
    draftCount:     draft,
  };
}