// ============================================
// SERVORA ERP — Default Expense Categories
// Seed data — auto-created for new restaurants on first sign-up.
// Subcategories start empty; the restaurant owner adds their own
// via the Category Manager (Settings).
// ============================================

export interface DefaultCategorySeed {
  name: string;
  color: string;
}

export const DEFAULT_EXPENSE_CATEGORIES: readonly DefaultCategorySeed[] = [
  { name: "Ingredients", color: "#10b981" },
  { name: "Utilities",   color: "#3b82f6" },
  { name: "Staff",       color: "#8b5cf6" },
  { name: "Rent",        color: "#f59e0b" },
  { name: "Equipment",   color: "#06b6d4" },
  { name: "Cleaning",    color: "#84cc16" },
  { name: "Marketing",   color: "#ec4899" },
  { name: "Other",       color: "#94a3b8" },
] as const;