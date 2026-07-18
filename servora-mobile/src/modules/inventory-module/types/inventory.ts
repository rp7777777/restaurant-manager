// ============================================
// SERVORA ERP — Inventory Types
// ✅ Backward compatible — same core fields as the existing
//    src/app/inventory-module/index.tsx screen
// ✅ NEW optional fields — expiryDate, batchNo, storageLocation,
//    supplierId — added for expiry tracking + supplier linking
// FROZEN
// ============================================

export type InventoryCategory =
  | "Meat" | "Vegetables" | "Dairy" | "Dry Goods"
  | "Beverages" | "Sauces" | "Spices" | "Oils" | "Other";

export type InventoryUnit =
  | "kg" | "g" | "L" | "ml" | "pcs" | "box" | "bag" | "bottle" | "pac";

export interface InventoryItem {
  id:               string;
  itemName:         string;
  category:         InventoryCategory;
  quantity:         number;
  unit:             InventoryUnit;
  unitCost:         number;
  totalValue:       number;
  minStock:         number;
  isLowStock:       boolean;
  expiryDate?:      string;  // YYYY-MM-DD
  batchNo?:         string;
  storageLocation?: string;
  supplierId?:      string;
  restaurantId:     string;
  userId?:          string;
  createdAt?:       unknown;
  updatedAt?:       unknown;
}

export interface CreateInventoryItemInput {
  itemName:         string;
  category:         InventoryCategory;
  quantity:         number;
  unit:             InventoryUnit;
  unitCost:         number;
  minStock:         number;
  expiryDate?:      string;
  batchNo?:         string;
  storageLocation?: string;
  supplierId?:      string;
}

export type UpdateInventoryItemInput = Partial<CreateInventoryItemInput>;

export type ExpiryStatus = "expired" | "expiringSoon" | "ok" | "none";

export function classifyExpiry(
  expiryDate: string | undefined,
  todayISO: string,
  soonThresholdDays: number = 3
): ExpiryStatus {
  if (!expiryDate) return "none";
  if (expiryDate < todayISO) return "expired";

  const today = new Date(`${todayISO}T00:00:00`);
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86400000);

  if (diffDays <= soonThresholdDays) return "expiringSoon";
  return "ok";
}