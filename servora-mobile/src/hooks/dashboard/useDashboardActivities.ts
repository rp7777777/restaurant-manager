// ============================================
// SERVORA ERP — useDashboardActivities
// ✅ Firestore real-time listener
// ✅ Yearly subcollection — archive friendly
// ✅ restaurantId null safe + error reset
// ✅ Error callback — Firestore errors handled
// ✅ safeLimit — negative/zero guard
// ✅ Cleanup on unmount
// ✅ Configurable limit
// FROZEN
// ============================================

import { useEffect, useState } from "react";
import {
subscribeRecentActivities,
ActivityLog,
} from "../../services/dashboard-service";

export interface UseDashboardActivitiesResult {
activities: ActivityLog[];
loading:    boolean;
error:      string | null;
}

export function useDashboardActivities(
restaurantId: string | null | undefined,
limit:        number = 8,
): UseDashboardActivitiesResult {
const [activities, setActivities] = useState<ActivityLog[]>([]);
const [loading,    setLoading]    = useState(true);
const [error,      setError]      = useState<string | null>(null);

useEffect(() => {
if (!restaurantId) {
setActivities([]);
setError(null);
setLoading(false);
return;
}

// ✅ safeLimit — negative/zero guard  
const safeLimit = Math.max(1, limit);  

setLoading(true);  
setError(null);  

const unsubscribe = subscribeRecentActivities(  
  restaurantId,  
  (data) => {  
    setActivities(data);  
    setLoading(false);  
  },  
  safeLimit,  
  // ✅ Error callback — Firestore errors handled  
  (err) => {  
    setActivities([]);  
    setError(err.message);  
    setLoading(false);  
  },  
);  

return unsubscribe;

}, [restaurantId, limit]);

return { activities, loading, error };
}