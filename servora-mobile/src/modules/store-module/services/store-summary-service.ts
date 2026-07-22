// ============================================
// SERVORA ERP — Store Summary Service
// ✅ Incremental fields (totalItems, totalStockValue, lowStockCount,
//    outOfStockCount) maintained via syncStoreSummaryForItemChange(),
//    called by inventory-repository.ts and stock-movement-service.ts
//    whenever an inventory item is created/updated/deleted or its
//    quantity changes.
// ✅ before/after are EXPLICITLY typed as
//    `InventorySummarySnapshot | null` in the function signature
//    itself — null `before` means the item didn't exist yet
//    (create), null `after` means it no longer exists (delete).
// ✅ Delta is ALWAYS computed inside this one function from the
//    actual before/after values — callers never pass a pre-computed
//    delta, closing off an entire class of incremental-drift bugs
//    (the same class of bug that corrupted Dashboard stats earlier).
// ✅ Transaction-safe — reads current summary + writes new summary
//    atomically, so concurrent inventory changes can never race
//    each other into an inconsistent summary.
// ✅ Sync failures are best-effort (console.warn, never thrown) —
//    an inventory/stock-movement operation must never be blocked by
//    a summary-sync problem. recomputeStoreSummaryFully() repairs
//    any drift.
// ✅ recomputeStoreSummaryFully() and syncStoreSummaryForItemChange()
//    both use { merge: true } — never clobbers future unrelated
//    fields that might later be added to this same document.
// ✅ Time-dependent counts (expiring/expired) are NEVER persisted
//    here — getExpiryCounts() computes them fresh on every call via
//    a targeted Firestore query (bounded to items with an
//    expiryDate set within a 90-day look-ahead window, not a full
//    inventory scan).
// ✅ getPendingCounts() similarly computed on-demand via targeted
//    status-filtered queries (small result sets, not full scans).
// ✅ DEFAULT_SUMMARY exported — useStoreSummary.ts (and any other
//    future caller) reuses this one shape instead of duplicating it.
// FROZEN
// ============================================

import {
  doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp,
  collection, query, where,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  StoreSummary,
  InventorySummarySnapshot,
  ExpiryCounts,
  PendingCounts,
} from "../types/store-summary";
import { classifyExpiry, resolveExpiryAlertDays } from "../../inventory-module/types/inventory";
import { todayISO } from "../../../utils/date-utils";

export const DEFAULT_SUMMARY: StoreSummary = {
  totalItems:       0,
  totalStockValue:  0,
  lowStockCount:    0,
  outOfStockCount:  0,
  lastCalculatedAt: null,
};

function storeSummaryDoc(restaurantId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.STORE, "summary");
}

function inventoryCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY);
}

function kitchenRequestsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.KITCHEN_REQUESTS);
}

function purchaseOrdersCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.PURCHASE_ORDERS);
}

// ── THE single place a store summary delta is ever computed.
//    Pass `before: null` for a create, `after: null` for a delete. ──
export async function syncStoreSummaryForItemChange(
  restaurantId: string,
  before: InventorySummarySnapshot | null,
  after: InventorySummarySnapshot | null,
): Promise<void> {
  if (!restaurantId) return;
  if (!before && !after) return; // nothing changed

  const itemsDelta      = (after ? 1 : 0) - (before ? 1 : 0);
  const valueDelta       = (after?.totalValue ?? 0) - (before?.totalValue ?? 0);
  const lowStockDelta    = (after?.isLowStock ? 1 : 0) - (before?.isLowStock ? 1 : 0);
  const outOfStockDelta  = (after?.quantity === 0 ? 1 : 0) - (before?.quantity === 0 ? 1 : 0);

  const ref = storeSummaryDoc(restaurantId);

  try {
    await runTransaction(db, async (transaction) => {
      const snap    = await transaction.get(ref);
      const current = snap.exists() ? snap.data() : DEFAULT_SUMMARY;

      const totalItems      = Math.max(0, Number(current.totalItems      ?? 0) + itemsDelta);
      const totalStockValue = Math.max(0, Number(current.totalStockValue ?? 0) + valueDelta);
      const lowStockCount   = Math.max(0, Number(current.lowStockCount   ?? 0) + lowStockDelta);
      const outOfStockCount = Math.max(0, Number(current.outOfStockCount ?? 0) + outOfStockDelta);

      transaction.set(
        ref,
        {
          totalItems,
          totalStockValue: Math.round(totalStockValue * 100) / 100,
          lowStockCount,
          outOfStockCount,
          lastCalculatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (error) {
    // ── Best-effort — a summary sync failure must never block the
    //    actual inventory/stock-movement operation that triggered it.
    //    recomputeStoreSummaryFully() below can repair any drift. ──
    console.warn("Store summary sync failed:", error);
  }
}

// ── Full recompute — repairs any drift by scanning the actual
//    inventory collection once. Same "true source of truth" pattern
//    as recomputeDashboardStatsFromSource(). Intended as a manual
//    repair tool, not a normal-path operation. ──
export async function recomputeStoreSummaryFully(
  restaurantId: string
): Promise<void> {
  if (!restaurantId) return;

  const snap = await getDocs(inventoryCollection(restaurantId));

  let totalItems      = 0;
  let totalStockValue = 0;
  let lowStockCount   = 0;
  let outOfStockCount = 0;

  snap.docs.forEach((d) => {
    const data     = d.data();
    const quantity = Number(data.quantity   ?? 0);
    const value    = Number(data.totalValue ?? 0);
    const isLow    = Boolean(data.isLowStock);

    totalItems += 1;
    totalStockValue += value;
    if (isLow) lowStockCount += 1;
    if (quantity === 0) outOfStockCount += 1;
  });

  await runTransaction(db, async (transaction) => {
    transaction.set(
      storeSummaryDoc(restaurantId),
      {
        totalItems,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        lowStockCount,
        outOfStockCount,
        lastCalculatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

// ── Live subscription to the incremental summary doc ──
export function subscribeStoreSummary(
  restaurantId: string,
  callback: (summary: StoreSummary) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback(DEFAULT_SUMMARY);
    return () => {};
  }

  return onSnapshot(
    storeSummaryDoc(restaurantId),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_SUMMARY);
        return;
      }
      const data = snap.data();
      callback({
        totalItems:       Number(data.totalItems      ?? 0),
        totalStockValue:  Number(data.totalStockValue ?? 0),
        lowStockCount:    Number(data.lowStockCount   ?? 0),
        outOfStockCount:  Number(data.outOfStockCount ?? 0),
        lastCalculatedAt: data.lastCalculatedAt ?? null,
      });
    },
    (err) => onError?.(err)
  );
}

// ── On-demand expiry counts — computed FRESH every call, never
//    persisted. Bounded query: only items with an expiryDate set
//    within a generous look-ahead window (90 days) are fetched, not
//    the entire inventory collection.
//    NOTE: category-tier resolution is not yet wired in (Category
//    linking via categoryId doesn't exist on InventoryItem until
//    Phase 8) — this currently resolves Item Override → Restaurant
//    Default → 7-day fallback only. ──
export async function getExpiryCounts(
  restaurantId: string,
  restaurantDefaultExpiryAlertDays?: number,
): Promise<ExpiryCounts> {
  const empty: ExpiryCounts = { expiringSoon: 0, expired: 0 };
  if (!restaurantId) return empty;

  const today = todayISO();
  const lookAheadDate = new Date(`${today}T00:00:00`);
  lookAheadDate.setDate(lookAheadDate.getDate() + 90);
  const lookAheadISO = lookAheadDate.toISOString().slice(0, 10);

  const snap = await getDocs(
    query(
      inventoryCollection(restaurantId),
      where("expiryDate", "<=", lookAheadISO),
    )
  );

  let expiringSoon = 0;
  let expired = 0;

  snap.docs.forEach((d) => {
    const data = d.data();
    const expiryDate = data.expiryDate as string | undefined;
    if (!expiryDate) return;

    const resolvedDays = resolveExpiryAlertDays(
      data.expiryAlertDaysOverride as number | undefined,
      null, // category tier not wired yet — see NOTE above
      restaurantDefaultExpiryAlertDays,
    );

    const status = classifyExpiry(expiryDate, today, resolvedDays);
    if (status === "expired") expired += 1;
    else if (status === "expiringSoon") expiringSoon += 1;
  });

  return { expiringSoon, expired };
}

// ── On-demand pending counts — targeted status-filtered queries,
//    never a full collection scan. ──
export async function getPendingCounts(
  restaurantId: string
): Promise<PendingCounts> {
  const empty: PendingCounts = { pendingKitchenRequests: 0, approvedPurchaseOrders: 0 };
  if (!restaurantId) return empty;

  const [kitchenSnap, poSnap] = await Promise.all([
    getDocs(query(
      kitchenRequestsCollection(restaurantId),
      where("status", "==", "PENDING"),
    )),
    getDocs(query(
      purchaseOrdersCollection(restaurantId),
      where("status", "==", "APPROVED"),
    )),
  ]);

  return {
    pendingKitchenRequests: kitchenSnap.size,
    approvedPurchaseOrders: poSnap.size,
  };
}