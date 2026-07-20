// ============================================
// SERVORA ERP — Inventory Category Types
// ✅ Per-restaurant customizable categories
// ✅ departmentId — optional link to a parent Department
// ✅ isSystem — true for auto-seeded default categories, false for
//    anything the owner creates themselves (same pattern as
//    Department). Set only at creation time — never editable via
//    UpdateCategoryInput.
// ✅ Duplicate-name prevention handled at the repository layer
// FROZEN
// ============================================

export interface Category {
  id:            string;
  name:          string;
  departmentId?: string;
  color?:        string;
  icon?:         string;
  isSystem:      boolean;
  restaurantId:  string;
  createdAt?:    unknown;
  updatedAt?:    unknown;
}

export interface CreateCategoryInput {
  name:          string;
  departmentId?: string;
  color?:        string;
  icon?:         string;
  isSystem?:     boolean;  // defaults to false in the repository
}

export type UpdateCategoryInput = Partial<Omit<CreateCategoryInput, "isSystem">>;