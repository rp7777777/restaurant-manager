// ============================================
// SERVORA ERP — Suppliers Route
// ✅ This route file is now a thin wrapper — all real logic lives
//    in src/modules/supplier-module/screens/SuppliersScreen.tsx
//    (composition) + its hooks/components (Phase 8.3).
// ✅ The OLD implementation (local useState<any[]>([]) array, no
//    Firestore connection at all — data was lost on refresh and
//    never reached the real supplier-module used by the Purchase
//    Order form's supplier picker) has been fully replaced by the
//    repository → hooks → components → screen architecture, same
//    pattern as Inventory (Phase 8.1) and Purchase Orders (Phase 8.2).
// PHASE 8.3
// ============================================

import SuppliersScreen from "../modules/supplier-module/screens/SuppliersScreen";

export default SuppliersScreen;