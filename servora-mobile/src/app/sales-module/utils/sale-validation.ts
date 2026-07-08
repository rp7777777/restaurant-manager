// ============================================
// SERVORA ERP — Sale Validation
// Pure functions — no side effects, no Firestore
// ============================================

import { Shift } from "../types/sales-types";

export const MAX_ENTRIES_PER_SHIFT = 3;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ── Validate amount ──
export function isValidAmount(amount: number | string): boolean {
  const num = Number(amount);
  return !isNaN(num) && num > 0;
}

// ── Validate a full sale entry before save ──
export function validateSaleEntry(
  input: {
    amount: string;
    shift: Shift;
  },
  isShiftLocked: boolean,
  isEditing: boolean,
  currentShiftEntryCount: number
): ValidationResult {
  if (!isValidAmount(input.amount)) {
    return { valid: false, error: "Enter a valid amount" };
  }
  if (isShiftLocked && !isEditing) {
    return { valid: false, error: `${input.shift} shift is already locked.` };
  }
  if (!isEditing && currentShiftEntryCount >= MAX_ENTRIES_PER_SHIFT) {
    return {
      valid: false,
      error: `${input.shift} shift already has ${MAX_ENTRIES_PER_SHIFT} entries. Maximum reached.`,
    };
  }
  return { valid: true };
}

// ── Validate restaurant context exists ──
export function validateRestaurantContext(restaurantId: string | null | undefined): ValidationResult {
  if (!restaurantId) {
    return { valid: false, error: "Restaurant not configured" };
  }
  return { valid: true };
}