// ============================================
// SERVORA ERP — useSuppliers Hook
// ✅ Raw supplier list — used by InventoryForm's supplier picker
//    now, and will be reused by the Suppliers screen (Phase 8.3).
// ✅ error state added for consistency with useInventory.ts's API —
//    all data hooks in Servora follow the same
//    { data, loading, error } shape.
// ✅ Clears stale error/data when restaurantId becomes null.
// FROZEN
// ============================================

import { useState, useEffect } from "react";
import { subscribeSuppliers } from "../repository/supplier-repository";
import { Supplier } from "../types/supplier";

export interface UseSuppliersResult {
  suppliers: Supplier[];
  loading:   boolean;
  error:     string | null;
}

export function useSuppliers(
  restaurantId: string | null | undefined
): UseSuppliersResult {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setSuppliers([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeSuppliers(
      restaurantId,
      (data) => { setSuppliers(data); setLoading(false); },
      (err) => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, [restaurantId]);

  return { suppliers, loading, error };
}