// ============================================
// SERVORA ERP — Payment Method Constants
// Single source of truth for accepted payment methods
// FROZEN
// ============================================

import { PaymentMethod } from "../types/sales-types";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "Cash",
  "Card",
  "MBWay",
  "Uber Eats",
  "Glovo",
  "Bolt Food",
  "Other",
] as const;