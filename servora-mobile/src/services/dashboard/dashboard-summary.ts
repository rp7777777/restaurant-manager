// ============================================
// SERVORA ERP — Dashboard Summary
// ✅ Monthly summaries
// ✅ Year totals
// ✅ Day map
// ✅ buildEmptyMonthSummary — null safety
// FROZEN
// ============================================

import { MONTHS } from "../../constants/dashboard";
import {
  SaleEntry, ExpenseEntry,
  MonthSummary, YearTotals, DayData,
} from "../../types/dashboard";
import {
  salesInMonth, expensesInMonth,
  expenseDateStr, safeNum, sumAmounts,
  parseSaleDate,
} from "./dashboard-utils";

// ── Monthly summaries ─────────────────────────
export function buildMonthlySummaries(
  allSales:    SaleEntry[],
  allExpenses: ExpenseEntry[],
  year:        number,
): MonthSummary[] {
  return MONTHS.map((_, idx) => {
    const mSales        = salesInMonth(allSales, idx, year);
    const mExpenses     = expensesInMonth(allExpenses, idx, year);
    const totalSales    = sumAmounts(mSales);
    const totalExpenses = sumAmounts(mExpenses);
    const netProfit     = totalSales - totalExpenses;
    return {
      month: idx,
      totalSales,
      totalExpenses,
      netProfit,
      profitMargin: totalSales > 0
        ? (netProfit / totalSales) * 100
        : 0,
    };
  });
}

// ── Year totals ───────────────────────────────
export function buildYearTotals(
  summaries: MonthSummary[]
): YearTotals {
  return {
    sales:    summaries.reduce((s, m) => s + m.totalSales,    0),
    expenses: summaries.reduce((s, m) => s + m.totalExpenses, 0),
    profit:   summaries.reduce((s, m) => s + m.netProfit,     0),
  };
}

// ✅ Empty month — null safety
export function buildEmptyMonthSummary(
  month: number
): MonthSummary {
  return {
    month,
    totalSales:    0,
    totalExpenses: 0,
    netProfit:     0,
    profitMargin:  0,
  };
}

// ── Day map ───────────────────────────────────
export function buildDayMap(
  allSales:    SaleEntry[],
  allExpenses: ExpenseEntry[],
  month:       number,
  year:        number,
): DayData[] {
  const map: Record<string, DayData> = {};

  salesInMonth(allSales, month, year).forEach((s) => {
    if (!map[s.date]) {
      map[s.date] = {
        date: s.date, sales: 0,
        expenses: 0, netProfit: 0, entries: [],
      };
    }
    map[s.date].sales += safeNum(s.amount);
    map[s.date].entries.push(s);
  });

  expensesInMonth(allExpenses, month, year).forEach((e) => {
    const dateStr = expenseDateStr(e);
    if (!map[dateStr]) {
      map[dateStr] = {
        date: dateStr, sales: 0,
        expenses: 0, netProfit: 0, entries: [],
      };
    }
    map[dateStr].expenses += safeNum(e.amount);
  });

  const days = Object.values(map);
  days.forEach((d) => { d.netProfit = d.sales - d.expenses; });

  return days.sort(
    (a, b) => parseSaleDate(a.date).getTime() -
              parseSaleDate(b.date).getTime()
  );
}