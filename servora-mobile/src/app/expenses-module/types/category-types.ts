// ============================================
// SERVORA ERP — Expense Category Types
// User-editable 2-level hierarchy: Category → SubCategory
// ============================================

import { Timestamp } from "firebase/firestore";

// ── Main category (e.g. "Ingredients", "Staff", "Rent") ──
export interface ExpenseCategory {
  id?: string;
  name: string;
  normalizedName: string;
  color: string;
  restaurantId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ── Sub-category, nested under a category (e.g. "Vegetables" under "Ingredients") ──
export interface ExpenseSubCategory {
  id?: string;
  categoryId: string;
  name: string;
  normalizedName: string;
  restaurantId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ── Payload shapes for creating new categories/subcategories.
//    normalizedName is excluded — the service derives it internally
//    from name via normalize(), so callers never need to supply it. ──
export type CreateCategoryInput = Omit<
  ExpenseCategory,
  "id" | "createdAt" | "updatedAt" | "normalizedName"
>;
export type CreateSubCategoryInput = Omit<
  ExpenseSubCategory,
  "id" | "createdAt" | "updatedAt" | "normalizedName"
>;

// ── A category with its subcategories nested — convenient shape for pickers ──
export interface ExpenseCategoryWithSubs extends ExpenseCategory {
  subCategories: ExpenseSubCategory[];
}