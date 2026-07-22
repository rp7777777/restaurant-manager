// ============================================
// SERVORA ERP — Inventory Category Types
// ✅ Per-restaurant customizable categories
// ✅ departmentId — optional link to a parent Department
// ✅ isSystem — true for auto-seeded default categories
// ✅ expiryAlertDays — category-level default for "alert before
//    expiry" (e.g. Frozen Foods = 30, Dairy = 7, Fresh Vegetables
//    = 3). Middle tier of the 3-level priority:
//    Item Override → Category Setting (this field) → Restaurant
//    Default → hardcoded 7-day fallback. Optional — categories
//    without this set fall through to the next tier.
// ✅ Duplicate-name prevention handled at the repository layer
// FROZEN
// ============================================

export interface Category {
  id:               string;
  name:             string;
  departmentId?:    string;
  color?:           string;
  icon?:            string;
  isSystem:         boolean;
  expiryAlertDays?: number;
  restaurantId:     string;
  createdAt?:       unknown;
  updatedAt?:       unknown;
}

export interface CreateCategoryInput {
  name:             string;
  departmentId?:    string;
  color?:           string;
  icon?:            string;
  isSystem?:        boolean;
  expiryAlertDays?: number;
}

export type UpdateCategoryInput = Partial<Omit<CreateCategoryInput, "isSystem">>;