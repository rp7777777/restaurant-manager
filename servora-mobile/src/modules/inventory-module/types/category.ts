// ============================================
// SERVORA ERP — Inventory Category Types
// ✅ Per-restaurant customizable categories (replacing the
//    hardcoded string enum used by the current inventory screen)
// ✅ Duplicate-name prevention handled at the repository layer
//    (case-insensitive check) — this file is types only
// FROZEN
// ============================================

export interface Category {
  id:           string;
  name:         string;
  color?:       string;
  icon?:        string;
  restaurantId: string;
  createdAt?:   unknown;
  updatedAt?:   unknown;
}

export interface CreateCategoryInput {
  name:   string;
  color?: string;
  icon?:  string;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;