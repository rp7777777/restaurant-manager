// ============================================
// SERVORA ERP — useStoreSummary Hook
// ✅ Combines the LIVE incremental summary (totalItems,
//    totalStockValue, lowStockCount, outOfStockCount) with the
//    ON-DEMAND time-dependent counts (expiringSoon, expired,
//    pendingKitchenRequests, approvedPurchaseOrders).
// ✅ On-demand counts are fetched on mount and whenever refresh()
//    is called — intentional, NOT a live subscription, since a
//    live listener can't detect "midnight passed" without an
//    actual document write.
// ✅ DEFAULT_SUMMARY reused from store-summary-service.ts — one
//    default shape, not duplicated here.
// ✅ Effect guards !restaurantId before even calling refresh().
// ✅ Cancellation guard (via a ref, not a stale "isMounted" bool)
//    prevents setting state after unmount if refresh() resolves
//    late — avoids the classic React "update on unmounted
//    component" warning.
// ✅ NOTE (deferred to Phase 8 UI): a separate `refreshing` state
//    (distinct from `loading`) for pull-to-refresh spinners is a
//    reasonable future addition once the actual Store screen UI
//    with pull-to-refresh exists — not built yet, so not added
//    prematurely here.
// FROZEN
// ============================================

import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeStoreSummary,
  getExpiryCounts,
  getPendingCounts,
  DEFAULT_SUMMARY,
} from "../services/store-summary-service";
import { StoreSummary } from "../types/store-summary";

export interface StoreSummaryData extends StoreSummary {
  expiringSoon:           number;
  expired:                number;
  pendingKitchenRequests: number;
  approvedPurchaseOrders: number;
}

export interface UseStoreSummaryResult {
  data:    StoreSummaryData;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useStoreSummary(
  restaurantId: string | null | undefined,
  restaurantDefaultExpiryAlertDays?: number,
): UseStoreSummaryResult {
  const [summary, setSummary] = useState<StoreSummary>(DEFAULT_SUMMARY);
  const [expiringSoon, setExpiringSoon] = useState(0);
  const [expired, setExpired]           = useState(0);
  const [pendingKitchenRequests, setPendingKitchenRequests] = useState(0);
  const [approvedPurchaseOrders, setApprovedPurchaseOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  // ✅ Cancellation guard — prevents setting state after unmount if
  // an in-flight refresh() resolves after the component is gone.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  // ── Live incremental summary ──
  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeStoreSummary(
      restaurantId,
      (s) => {
        if (cancelledRef.current) return;
        setSummary(s);
        setLoading(false);
      },
      () => { if (!cancelledRef.current) setLoading(false); }
    );
    return unsub;
  }, [restaurantId]);

  // ── On-demand time-dependent + status-filtered counts ──
  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [expiry, pending] = await Promise.all([
        getExpiryCounts(restaurantId, restaurantDefaultExpiryAlertDays),
        getPendingCounts(restaurantId),
      ]);
      if (cancelledRef.current) return;
      setExpiringSoon(expiry.expiringSoon);
      setExpired(expiry.expired);
      setPendingKitchenRequests(pending.pendingKitchenRequests);
      setApprovedPurchaseOrders(pending.approvedPurchaseOrders);
    } catch (error) {
      console.warn("useStoreSummary: on-demand refresh failed:", error);
    }
  }, [restaurantId, restaurantDefaultExpiryAlertDays]);

  useEffect(() => {
    if (!restaurantId) return;
    refresh();
  }, [refresh, restaurantId]);

  return {
    data: {
      ...summary,
      expiringSoon,
      expired,
      pendingKitchenRequests,
      approvedPurchaseOrders,
    },
    loading,
    refresh,
  };
}