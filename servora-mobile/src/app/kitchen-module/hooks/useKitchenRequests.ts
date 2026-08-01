// ============================================
// SERVORA ERP — useKitchenRequests Hook
// ✅ Raw kitchen request data ONLY — subscribe, loading, error.
//    Mirrors usePurchaseOrders.ts's shape exactly (which itself
//    mirrors useInventory.ts) so every data hook in Servora follows
//    the same { data, loading, error } contract.
// ✅ Live subscription (subscribeKitchenRequests) — new requests,
//    Store approve/reject/issue updates via the repository
//    automatically reflect here.
// ✅ Clears stale error state when restaurantId becomes null (e.g.
//    switching restaurants) — a previous restaurant's error must
//    never carry over and confuse the next one.
// ============================================

import { useState, useEffect } from "react";
import { subscribeKitchenRequests } from "../repository/kitchen-repository";
import { IngredientRequest } from "../types/kitchen-types";

export interface UseKitchenRequestsResult {
  requests: IngredientRequest[];
  loading:  boolean;
  error:    string | null;
}

export function useKitchenRequests(
  restaurantId: string | null | undefined
): UseKitchenRequestsResult {
  const [requests, setRequests] = useState<IngredientRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setRequests([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeKitchenRequests(
      restaurantId,
      (data) => {
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  return { requests, loading, error };
}