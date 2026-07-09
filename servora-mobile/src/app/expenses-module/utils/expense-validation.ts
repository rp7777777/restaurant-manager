// ============================================
// SERVORA ERP — Expense Validation
// Pure functions — no side effects, no Firestore
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ── Validate amount ──
export function isValidAmount(amount: number | string): boolean {
  const num = Number(amount);
  return !isNaN(num) && num > 0;
}

// ── Validate expense name ──
export function isValidExpenseName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 100;
}

// ── Validate a full expense entry before save ──
export function validateExpenseEntry(input: {
  expenseName: string;
  amount: string;
  categoryId: string;
  subCategoryId?: string;
  categoryHasSubCategories: boolean;
}): ValidationResult {
  if (!isValidExpenseName(input.expenseName)) {
    return { valid: false, error: "Enter an expense name" };
  }
  if (!isValidAmount(input.amount)) {
    return { valid: false, error: "Enter a valid amount" };
  }
  if (!input.categoryId) {
    return { valid: false, error: "Select a category" };
  }
  if (input.categoryHasSubCategories && !input.subCategoryId) {
    return { valid: false, error: "Select a sub-category" };
  }
  return { valid: true };
}