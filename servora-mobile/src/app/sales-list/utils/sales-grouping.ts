// ============================================
// SERVORA ERP — Sales History Grouping
// Pure functions — no side effects, no Firestore
// ============================================

import { SaleHistoryEntry, DayTotal, MonthlySummaryEntry } from "../types/sales-history-types";
import { parseSaleDate } from "./sales-date";

// ── Filter sales to a specific month + year ──
export function filterByMonth(
  sales: SaleHistoryEntry[],
  month: number,
  year: number
): SaleHistoryEntry[] {
  return sales.filter((s) => {
    if (!s.date) return false;
    const d = parseSaleDate(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

// ── Group a set of sales by their date string ──
export function groupByDay(sales: SaleHistoryEntry[]): Record<string, SaleHistoryEntry[]> {
  const dayMap: Record<string, SaleHistoryEntry[]> = {};
  sales.forEach((s) => {
    if (!s.date) return;
    if (!dayMap[s.date]) dayMap[s.date] = [];
    dayMap[s.date].push(s);
  });
  return dayMap;
}

// ── Turn a day-grouped map into sorted DayTotal entries (most recent first) ──
export function buildDayTotals(dayMap: Record<string, SaleHistoryEntry[]>): DayTotal[] {
  return Object.entries(dayMap)
    .map(([date, entries]) => ({
      date,
      total: entries.reduce((sum, e) => sum + Number(e.amount), 0),
      entries,
    }))
    .sort((a, b) => parseSaleDate(b.date).getTime() - parseSaleDate(a.date).getTime());
}

// ── Sum amounts for a set of sales ──
export function sumAmounts(sales: SaleHistoryEntry[]): number {
  return sales.reduce((sum, s) => sum + Number(s.amount), 0);
}

// ── Build the 12-month summary (total + count per month) for a given year ──
export function buildMonthlySummary(
  allSales: SaleHistoryEntry[],
  year: number
): MonthlySummaryEntry[] {
  return Array.from({ length: 12 }, (_, idx) => {
    const sales = filterByMonth(allSales, idx, year);
    return {
      month: idx,
      total: sumAmounts(sales),
      count: sales.length,
    };
  });
}