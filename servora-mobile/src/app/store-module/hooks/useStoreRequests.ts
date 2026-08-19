// ============================================
// SERVORA ERP — useStoreRequests Hook
// ✅ EVOLUTIONARY EXTRACTION — subscription/loading/refresh/date-
//    navigation logic moved out of index.tsx as part of the
//    file-by-file split. No Firestore query logic changed —
//    subscribeKitchenRequests() (kitchen-module/repository) is
//    still the single source of truth, unchanged.
// ✅ Tab system REMOVED (per confirmed redesign) — single-date
//    model matching MovementHistoryModal.tsx's UX: default to
//    Today, `<`/`>` navigate to adjacent dates, ALL statuses shown
//    together for whichever date is selected, filtered by
//    requiredDate. Intentional consequence: an old PENDING request
//    no longer appears on "Today" once its requiredDate has
//    passed — the store keeper navigates back to find it.
// ✅ FIX — explicit Dispatch/SetStateAction import instead of the
//    React.Dispatch namespace reference, which relied on the
//    ambient React namespace being globally resolvable rather than
//    being an explicit import — cleaner and more portable.
// ✅ subscriptionKey — bumping it forces unsubscribe/re-subscribe,
//    giving pull-to-refresh a genuine effect.
// ✅ Returns displayRequests already filtered to selectedDate — no
//    filtering logic duplicated in consuming components.
// FROZEN
// ============================================

import { useEffect, useState, useCallback, useMemo, Dispatch, SetStateAction } from "react";
import { subscribeKitchenRequests } from "../../kitchen-module/repository/kitchen-repository";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { todayISO } from "../../../utils/date-utils";

export interface UseStoreRequestsResult {
  requests:          IngredientRequest[];
  displayRequests:   IngredientRequest[];
  loading:           boolean;
  refreshing:        boolean;
  onRefresh:         () => void;
  today:             string;
  selectedDate:      string;
  setSelectedDate:   Dispatch<SetStateAction<string>>;
}

export function useStoreRequests(restaurantId: string | null | undefined): UseStoreRequestsResult {
  const [requests, setRequests] = useState<IngredientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptionKey, setSubscriptionKey] = useState(0);

  const today = useMemo(() => todayISO(), []);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    const unsubscribe = subscribeKitchenRequests(
      restaurantId,
      (data) => {
        setRequests(data);
        setLoading(false);
        setRefreshing(false);
      },
      () => { setLoading(false); setRefreshing(false); }
    );
    return unsubscribe;
  }, [restaurantId, subscriptionKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSubscriptionKey((k) => k + 1);
  }, []);

  const displayRequests = useMemo(
    () => requests.filter((r) => r.requiredDate === selectedDate),
    [requests, selectedDate]
  );

  return {
    requests,
    displayRequests,
    loading,
    refreshing,
    onRefresh,
    today,
    selectedDate,
    setSelectedDate,
  };
}