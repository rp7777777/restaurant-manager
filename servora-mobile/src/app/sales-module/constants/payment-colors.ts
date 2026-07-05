// ============================================
// SERVORA ERP — Payment Method Colors
// Single source of truth for payment method color coding
// FROZEN
// ============================================

import { PaymentMethod } from "../types/sales-types";

export const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  Cash: "#10b981",
  Card: "#3b82f6",
  MBWay: "#8b5cf6",
  "Uber Eats": "#f97316",
  Glovo: "#84cc16",
  "Bolt Food": "#06b6d4",
  Other: "#94a3b8",
};