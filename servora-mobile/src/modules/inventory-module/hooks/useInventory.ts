// ============================================
// SERVORA ERP — useInventory Hook
// ✅ Raw inventory data ONLY — subscribe, loading, error.
//    Deliberately does NOT include search/filter/sort/grouping —
//    that's useInventoryFilters.ts's job.
// ✅ Live subscription (subscribeInventoryItems) — Add/Edit/Delete
//    via the repository automatically reflect here.
// ✅ Clears stale error state when restaurantId becomes null (e.g.
//    switching restaurants) — a previous restaurant's error must
//    never carry over and confuse the next one.
// FROZEN
// ============================================

import { useState, useEffect } from "react";
import { subscribeInventoryItems } from "../repository/inventory-repository";
import { InventoryItem } from "../types/inventory";

export interface UseInventoryResult {
  items:   InventoryItem[];
  loading: boolean;
  error:   string | null;
}

export function useInventory(
  restaurantId: string | null | undefined
): UseInventoryResult {
  const [items,   setItems]   = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeInventoryItems(
      restaurantId,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  return { items, loading, error };
}