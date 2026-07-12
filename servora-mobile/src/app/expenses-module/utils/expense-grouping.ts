// ============================================
// SERVORA ERP — Expense History Grouping
// Pure functions — no side effects, no Firestore
// ============================================

import { ExpenseEntry } from "../types/expense-types";
import { parseExpenseDate } from "./expense-date";

export interface ExpenseDayTotal {
  date: string;
  total: number;
  entries: ExpenseEntry[];
}

export interface ExpenseMonthlySummaryEntry {
  month: number;
  total: number;
  count: number;
}

// ── Filter expenses to a specific month + year ──
export function filterExpensesByMonth(
  expenses: ExpenseEntry[],
  month: number,
  year: number
): ExpenseEntry[] {
  return expenses.filter((e) => {
    if (!e.date) return false;
    const d = parseExpenseDate(e.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

// ── Group a set of expenses by their date string ──
export function groupExpensesByDay(expenses: ExpenseEntry[]): Record<string, ExpenseEntry[]> {
  const dayMap: Record<string, ExpenseEntry[]> = {};
  expenses.forEach((e) => {
    if (!e.date) return;
    if (!dayMap[e.date]) dayMap[e.date] = [];
    dayMap[e.date].push(e);
  });
  return dayMap;
}

// ── Turn a day-grouped map into sorted ExpenseDayTotal entries (most recent first) ──
export function buildExpenseDayTotals(dayMap: Record<string, ExpenseEntry[]>): ExpenseDayTotal[] {
  return Object.entries(dayMap)
    .map(([date, entries]) => ({
      date,
      total: entries.reduce((sum, e) => sum + e.amount, 0),
      entries,
    }))
    .sort((a, b) => parseExpenseDate(b.date).getTime() - parseExpenseDate(a.date).getTime());
}

// ── Sum amounts for a set of expenses ──
export function sumExpenseAmounts(expenses: ExpenseEntry[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

// ── Build the 12-month summary (total + count per month) for a given year ──
export function buildExpenseMonthlySummary(
  allExpenses: ExpenseEntry[],
  year: number
): ExpenseMonthlySummaryEntry[] {
  return Array.from({ length: 12 }, (_, idx) => {
    const expenses = filterExpensesByMonth(allExpenses, idx, year);
    return {
      month: idx,
      total: sumExpenseAmounts(expenses),
      count: expenses.length,
    };
  });
}