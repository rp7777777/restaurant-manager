// ============================================
// SERVORA ERP — Inventory Module Barrel Export
// ✅ Public surface of the Inventory Module for consumers outside
//    this folder (other modules, app/ routes). Internal files
//    within inventory-module continue to import directly from each
//    other's specific paths (e.g. "../types/inventory") — this
//    barrel is for EXTERNAL consumers only, so internal imports
//    never get an extra indirection layer or risk a circular import
//    through this file.
// ✅ Exports the screen (primary entry point), the service layer
//    (for other modules that need to call e.g. adjustStock() or
//    duplicateInventoryItem() — mirrors how purchase-order-module
//    and kitchen-module already import inventory-repository
//    directly today; this barrel doesn't change those existing
//    call sites, it just gives FUTURE external consumers a single,
//    stable import path instead of reaching into repository/
//    or services/ directly).
// ✅ Types are re-exported since any external consumer handling
//    InventoryItem data needs them.
// ✅ Repositories are intentionally NOT re-exported here — direct
//    repository access from outside the module bypasses the
//    service-layer business rules (e.g. adjustStock's delegation to
//    recordStockMovement). External consumers should go through the
//    service layer, not the repository layer.
// FROZEN
// ============================================

// Screen (primary entry point)
export { default as InventoryScreen } from "./screens/InventoryScreen";

// Types
export type {
  InventoryItem,
  InventoryUnit,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  ExpiryStatus,
} from "./types/inventory";
export type { Category, CreateCategoryInput, UpdateCategoryInput } from "./types/category";
export type { Department, CreateDepartmentInput, UpdateDepartmentInput } from "./types/department";

// Type helpers
export {
  calculateInventoryTotalValue,
  resolveExpiryAlertDays,
  classifyExpiry,
  DEFAULT_EXPIRY_ALERT_DAYS,
} from "./types/inventory";

// Service layer (business operations — the correct entry point for
// external modules, NOT the repository layer)
export {
  adjustStock,
  archiveInventoryItem,
  restoreInventoryItem,
  duplicateInventoryItem,
} from "./services/inventory-service";

// Hooks (for external screens that need inventory data, e.g. a
// future cross-module dashboard widget)
export { useInventory } from "./hooks/useInventory";
export { useCategoriesForPicker } from "./hooks/useCategoriesForPicker";
export type { CategoryPickerGroup } from "./hooks/useCategoriesForPicker";