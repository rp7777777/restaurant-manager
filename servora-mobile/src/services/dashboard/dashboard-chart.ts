// ============================================
// SERVORA ERP — Dashboard Chart
// ✅ Monthly + daily chart data
// ✅ Real expenses in daily view
// ✅ Unused import removed
// FROZEN
// ============================================

import { MONTHS } from "../../constants/dashboard";
import {
  SaleEntry, ExpenseEntry,
  ChartData, MonthSummary,
} from "../../types/dashboard";
import {
  salesOnDate, expensesOnDate, sumAmounts,
} from "./dashboard-utils";

// ── Yearly chart ──────────────────────────────
export function buildYearlyChartData(
  summaries: MonthSummary[]
): ChartData {
  return {
    labels:    [...MONTHS],
    salesData: summaries.map((m) => m.totalSales),
    expData:   summaries.map((m) => m.totalExpenses),
  };
}

// ── Monthly chart (daily) ─────────────────────
export function buildMonthlyChartData(
  allSales:    SaleEntry[],
  allExpenses: ExpenseEntry[],
  year:        number,
  month:       number,
): ChartData {
  const days    = new Date(year, month + 1, 0).getDate();
  const labels:    string[] = [];
  const salesData: number[] = [];
  const expData:   number[] = [];

  for (let i = 0; i < days; i++) {
    if (i % 5 !== 0 && i !== 0) continue;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    labels.push(`${i + 1}`);
    salesData.push(sumAmounts(salesOnDate(allSales,    dateStr)));
    expData.push(  sumAmounts(expensesOnDate(allExpenses, dateStr)));
  }

  return { labels, salesData, expData };
}

// ── Has data ──────────────────────────────────
export function hasChartData(data: ChartData): boolean {
  return data.salesData.some((v) => v > 0) ||
         data.expData.some((v)   => v > 0);
}