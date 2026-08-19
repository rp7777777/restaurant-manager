// ============================================
// SERVORA ERP — useStoreRequests Hook
// ✅ Single-date model — default to Today, `<`/`>` navigate to
//    adjacent dates, ALL statuses shown for the selected requiredDate.
// ✅ batchAllocationsByRequestId: for each displayed request that
//    has been ISSUED, fetches the associated StockMovement via the
//    TARGETED getMovementsByReference() lookup (referenceType:
//    "KITCHEN_REQUEST", referenceId: request.id) — NOT a client-side
//    filter over a recent-N window, so an older request's batch
//    allocation is never missed.
// ✅ batchLookupKey encodes id:status:issuedQuantity for every
//    ISSUED request — so an in-place APPROVED→ISSUED transition
//    (same id, changed status/quantity) is detected and triggers a
//    fresh lookup, not just a change in which request IDs exist.
// ✅ subscriptionKey is part of the effect's dependency array, so
//    pull-to-refresh always forces a fresh batch lookup too.
// ✅ Each per-request getMovementsByReference() call has its own
//    try/catch — one failed lookup never blocks every other
//    request's successful lookup from populating the map.
// ✅ cancelled guard — prevents a stale async response from a
//    previous date/subscription cycle overwriting current state.
// ✅ FIX — explicit Promise<readonly [string, BatchAllocationRecord[]]>
//    return-type annotation on the map callback, and an explicit
//    `[] as BatchAllocationRecord[]` in the catch branch. Without
//    these, TypeScript inferred two DIFFERENT tuple types for the
//    try-branch (`[string, BatchAllocationRecord[]]`) vs the
//    catch-branch (`[string, readonly never[]]`), producing a union
//    type that `new Map(entries)` couldn't accept — a compile error
//    (ts(2769)), not a runtime bug. Both branches now return the
//    exact same type, so Map's constructor overload resolves
//    correctly.
// FROZEN
// ============================================

import { useEffect, useState, useCallback, useMemo } from "react";
import { Dispatch, SetStateAction } from "react";
import { subscribeKitchenRequests } from "../../kitchen-module/repository/kitchen-repository";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { getMovementsByReference } from "../../../modules/stock-movement-module/services/stock-movement-service";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { todayISO } from "../../../utils/date-utils";

export interface UseStoreRequestsResult {
  requests:                    IngredientRequest[];
  displayRequests:             IngredientRequest[];
  loading:                     boolean;
  refreshing:                  boolean;
  onRefresh:                   () => void;
  today:                       string;
  selectedDate:                string;
  setSelectedDate:             Dispatch<SetStateAction<string>>;
  batchAllocationsByRequestId: Map<string, BatchAllocationRecord[]>;
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

  const [batchAllocationsByRequestId, setBatchAllocationsByRequestId] =
    useState<Map<string, BatchAllocationRecord[]>>(new Map());

  const batchLookupKey = displayRequests
    .filter((r) => r.status === "ISSUED")
    .map((r) => `${r.id}:${r.status}:${r.issuedQuantity ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!restaurantId) return;

    const issuedIds = displayRequests
      .filter((r) => r.status === "ISSUED")
      .map((r) => r.id);

    if (issuedIds.length === 0) {
      setBatchAllocationsByRequestId(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        issuedIds.map(async (id): Promise<readonly [string, BatchAllocationRecord[]]> => {
          try {
            const movements = await getMovementsByReference(restaurantId, "KITCHEN_REQUEST", id);
            const allocations = movements.flatMap((m) => m.batchAllocations ?? []);
            return [id, allocations];
          } catch (error) {
            console.warn(`Failed to load batch allocations for request ${id}:`, error);
            return [id, [] as BatchAllocationRecord[]];
          }
        })
      );
      if (!cancelled) {
        setBatchAllocationsByRequestId(new Map(entries));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, subscriptionKey, batchLookupKey]);

  return {
    requests,
    displayRequests,
    loading,
    refreshing,
    onRefresh,
    today,
    selectedDate,
    setSelectedDate,
    batchAllocationsByRequestId,
  };
}