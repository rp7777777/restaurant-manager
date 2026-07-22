// ============================================
// SERVORA ERP — Supplier Types
// ✅ No duplicate-name enforcement (unlike Category/Department) —
//    real-world suppliers can legitimately share similar/same names
//    (different branches, different people with the same business
//    name), so this is intentionally NOT blocked at the repository
//    layer. A soft "similar name exists" warning belongs in the UI
//    layer (Phase 8), not a hard rejection here.
// FROZEN
// ============================================

export interface Supplier {
  id:             string;
  name:           string;
  contactPerson?: string;
  phone?:         string;
  email?:         string;
  address?:       string;
  notes?:         string;
  restaurantId:   string;
  createdAt?:     unknown;
  updatedAt?:     unknown;
}

export interface CreateSupplierInput {
  name:           string;
  contactPerson?: string;
  phone?:         string;
  email?:         string;
  address?:       string;
  notes?:         string;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;