// ============================================
// SERVORA ERP — Purchase Orders Route
// ✅ This route file is now a thin wrapper — all real logic lives
//    in src/modules/purchase-order-module/screens/PurchaseOrdersScreen.tsx
//    (composition) + its hooks/components (Phase 8.2).
// ✅ The OLD inline implementation (local useState mock data, no
//    Firestore, no repository, no supplier linkage) has been fully
//    replaced by the repository → hooks → components → screen
//    architecture built in Phase 1-7 (backend) + Phase 8.2 (UI),
//    same pattern as the Inventory route (Phase 8.1).
// PHASE 8.2
// ============================================

import PurchaseOrdersScreen from "../modules/purchase-order-module/screens/PurchaseOrdersScreen";

export default PurchaseOrdersScreen;