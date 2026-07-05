// ============================================
// SERVORA ERP — Sales Module Types
// Single source of truth for sale entry shapes
// ============================================

import { Timestamp } from "firebase/firestore";

export type Shift = "Morning" | "Afternoon" | "Night";

export type PaymentMethod =
  | "Cash"
  | "Card"
  | "MBWay"
  | "Uber Eats"
  | "Glovo"
  | "Bolt Food"
  | "Other";

// ── Core sale entry — one document per shift entry ──
export interface SaleEntry {
  id?: string;
  date: string;              // YYYY-MM-DD, timezone-safe (todayISO)
  shift: Shift;
  amount: number;
  paymentMethod: PaymentMethod;
  entryName?: string;        // was "note" — optional label for the entry
  locked: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  userId: string;
  restaurantId: string;
}

// ── Payload shape for creating a new sale ──
export type CreateSaleInput = Omit<
  SaleEntry,
  "id" | "createdAt" | "updatedAt" | "userId" | "restaurantId" | "locked"
>;

// ── Payload shape for updating an existing sale ──
export type UpdateSaleInput = Partial<
  Omit<SaleEntry, "id" | "userId" | "restaurantId" | "createdAt">
>;

// ── Derived / computed shapes used by UI ──
export interface ShiftSummary {
  shift: Shift;
  total: number;
  locked: boolean;
  entryCount: number;
  paymentBreakdown: Record<string, number>;
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  amount: number;
}