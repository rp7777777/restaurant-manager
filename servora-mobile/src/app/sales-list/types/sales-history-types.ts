// ============================================
// SERVORA ERP — Sales History Types
// Shared interfaces for the sales-list (history) module
// ============================================

import type { Shift, PaymentMethod } from "../../sales-module/types/sales-types";

export interface SaleHistoryEntry {
  id?: string;
  date: string;
  shift: Shift;
  amount: number;
  paymentMethod: PaymentMethod;
  note: string;
  entryName?: string;
  locked: boolean;
  createdAt?: unknown;
}

export interface DayTotal {
  date: string;
  total: number;
  entries: SaleHistoryEntry[];
}

export interface MonthlySummaryEntry {
  month: number;
  total: number;
  count: number;
}