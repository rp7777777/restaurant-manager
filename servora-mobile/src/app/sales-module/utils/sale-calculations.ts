// ============================================
// SERVORA ERP — Sale Calculations
// Pure functions — no side effects, no Firestore
// ============================================

import { SaleEntry, Shift, PaymentMethod } from "../types/sales-types";

// ── Total for a single shift ──
export function getShiftTotal(sales: SaleEntry[], shift: Shift): number {
  return sales
    .filter((s) => s.shift === shift)
    .reduce((sum, s) => sum + Number(s.amount), 0);
}

// ── Total across all shifts ──
export function getGrandTotal(sales: SaleEntry[]): number {
  return sales.reduce((sum, s) => sum + Number(s.amount), 0);
}

// ── Payment method breakdown for a single shift ──
export function getShiftPaymentBreakdown(
  sales: SaleEntry[],
  shift: Shift
): Partial<Record<PaymentMethod, number>> {
  const shiftSales = sales.filter((s) => s.shift === shift);
  const breakdown: Partial<Record<PaymentMethod, number>> = {};
  shiftSales.forEach((s) => {
    breakdown[s.paymentMethod] = (breakdown[s.paymentMethod] ?? 0) + Number(s.amount);
  });
  return breakdown;
}

// ── Payment method breakdown across all sales ──
export function getTotalPaymentBreakdown(sales: SaleEntry[]): Partial<Record<PaymentMethod, number>> {
  const breakdown: Partial<Record<PaymentMethod, number>> = {};
  sales.forEach((s) => {
    breakdown[s.paymentMethod] = (breakdown[s.paymentMethod] ?? 0) + Number(s.amount);
  });
  return breakdown;
}

// ── Is a given shift locked? (any entry in that shift locked = shift locked) ──
export function isShiftLocked(sales: SaleEntry[], shift: Shift): boolean {
  return sales.some((s) => s.shift === shift && s.locked);
}

// ── Entries belonging to a given shift ──
export function getShiftEntries(sales: SaleEntry[], shift: Shift): SaleEntry[] {
  return sales.filter((s) => s.shift === shift);
}