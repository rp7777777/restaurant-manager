// ============================================
// SERVORA ERP — Kitchen Route
// ✅ This route file is now a thin wrapper — all real logic lives
//    in src/app/kitchen-module/screens/KitchenScreen.tsx
//    (composition) + its hooks/repository/services/components.
// ✅ The OLD inline implementation (825 lines of direct Firestore
//    calls, screen-owned form/search/history state) has been fully
//    replaced by the new repository → service → hooks →
//    components → screens architecture.
// FROZEN
// ============================================

import KitchenScreen from "./screens/KitchenScreen";

export default KitchenScreen;