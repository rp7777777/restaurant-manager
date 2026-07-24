// ============================================
// SERVORA ERP — usePurchaseOrders Hook
// ✅ Raw purchase order data ONLY — subscribe, loading, error.
//    Mirrors useInventory.ts's shape exactly so every data hook in
//    Servora follows the same { data, loading, error } contract.
// ✅ Live subscription (subscribePurchaseOrders) — Create/status
//    updates via the repository automatically reflect here.
// ✅ Clears stale error state when restaurantId becomes null (e.g.
//    switching restaurants) — a previous restaurant's error must
//    never carry over and confuse the next one.
// PHASE 8.2
// ============================================

import { useState, useEffect } from "react";
import { subscribePurchaseOrders } from "../repository/purchase-order-repository";
import { PurchaseOrder } from "../types/purchase-order";

export interface UsePurchaseOrdersResult {
  orders:  PurchaseOrder[];
  loading: boolean;
  error:   string | null;
}

export function usePurchaseOrders(
  restaurantId: string | null | undefined
): UsePurchaseOrdersResult {
  const [orders,  setOrders]  = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setOrders([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribePurchaseOrders(
      restaurantId,
      (data) => {
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [restaurantId]);

  return { orders, loading, error };
}