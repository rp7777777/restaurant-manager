// ============================================
// SERVORA ERP — Inventory Route
// ✅ This route file is now a thin wrapper — all real logic lives
//    in src/modules/inventory-module/screens/InventoryScreen.tsx
//    (composition) + its hooks/components (Phase 8.1 complete).
// ✅ The OLD inline implementation (605 lines of direct Firestore
//    calls, hardcoded category strings, no Stock Movement
//    integration) has been fully replaced by the new
//    repository → hooks → components → screen architecture built
//    across Phase 1-8.1.
// FROZEN
// ============================================

import InventoryScreen from "../../modules/inventory-module/screens/InventoryScreen";

export default InventoryScreen;