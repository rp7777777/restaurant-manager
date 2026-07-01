// ============================================
// SERVORA ERP — Dashboard Types
// ============================================

import { Timestamp } from "firebase/firestore";

// ── Sales ─────────────────────────────────────
export interface SaleEntry {
  id:            string;
  date:          string;
  shift:         string;
  amount:        number;
  paymentMethod: string;
  note?:         string;
}

// ── Expenses ──────────────────────────────────
export interface ExpenseEntry {
  id:          string;
  createdAt?:  Timestamp | null;
  amount:      number;
  expenseName: string;
  category:    string;
}

// ── Attendance Summary ────────────────────────
export interface AttendanceSummary {
  total:   number;
  present: number;
  absent:  number;
  late:    number;
}

// ── Monthly Summary ───────────────────────────
export interface MonthSummary {
  month:         number;
  totalSales:    number;
  totalExpenses: number;
  netProfit:     number;
  profitMargin:  number;
}

// ── Year Totals ───────────────────────────────
export interface YearTotals {
  sales:    number;
  expenses: number;
  profit:   number;
}

// ── Day Data ──────────────────────────────────
export interface DayData {
  date:      string;
  sales:     number;
  expenses:  number;
  netProfit: number;
  entries:   SaleEntry[];
}

// ── Chart Data ────────────────────────────────
export interface ChartData {
  labels:    string[];
  salesData: number[];
  expData:   number[];
}

// ── Dashboard Filter State ────────────────────
export interface DashboardFilters {
  selectedYear:   number;
  selectedMonth:  number;
  viewMode:       "monthly" | "yearly";
  selectedDay:    string | null;
  showYearPicker: boolean;
}
