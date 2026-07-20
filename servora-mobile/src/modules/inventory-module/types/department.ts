// ============================================
// SERVORA ERP — Department Types
// ✅ Top-level grouping above Category (Food, Beverage, Alcohol,
//    Bakery, Cleaning, Packaging, Kitchen, Hotel, Maintenance,
//    Office) — works for any hospitality business type
// ✅ isSystem — true for auto-seeded default departments, false
//    for anything the owner creates themselves. Lets Phase 8 UI
//    warn before deleting a system department, and enables a
//    future "Reset to Default" feature.
// FROZEN
// ============================================

export interface Department {
  id:           string;
  name:         string;
  icon?:        string;
  color?:       string;
  isSystem:     boolean;
  restaurantId: string;
  createdAt?:   unknown;
  updatedAt?:   unknown;
}

export interface CreateDepartmentInput {
  name:       string;
  icon?:      string;
  color?:     string;
  isSystem?:  boolean;  // defaults to false in the repository
}

export type UpdateDepartmentInput = Partial<Omit<CreateDepartmentInput, "isSystem">>;