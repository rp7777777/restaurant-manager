// ============================================
// SERVORA ERP — useHistoricalInventoryStats Hook
// ✅ Computes the SAME stat shape as InventoryStats.tsx's internal
//    calculation (totalItems, lowStock, outOfStock, expiringSoon),
//    from HISTORICAL data (closing stock as of selectedDate) instead
//    of live InventoryItem.currentStock.
// ✅ Joins itemsWithHistoricalStock against live inventoryItems ONLY
//    for fields that don't exist in historical reconstruction:
//    minStock and expiryAlertDaysOverride.
// ⚠️ DOCUMENTED LIMITATION — minStock is the item's CURRENT
//    threshold, not "as of selectedDate" (minStock represents an
//    ongoing policy, not a historical snapshot). If a user changed
//    minStock AFTER selectedDate, this "Low Stock" count reflects
//    today's policy applied retroactively — a batch that was NOT
//    low-stock under the OLD threshold on selectedDate could appear
//    low-stock here under the CURRENT threshold, or vice versa. This
//    is accepted as the practical alternative to tracking a
//    minStock-change history, which does not currently exist in this
//    system.
// ✅ totalValue is NOT computed here (Historical has no per-date
//    unitCost tracking) — omitted from the Historical stats row.
// ✅ expiringSoon checks ALL of an item's VISIBLE batches on
//    selectedDate — an item counts as "expiring soon" if ANY visible
//    batch individually falls within the alert window.
// ✅ categoryId is properly null-checked (HistoricalItemStock.categoryId
//    is `string | null`) before the Map lookup, avoiding a `?? ""`
//    fallback that could accidentally match a real empty-string
//    category key.
// FROZEN
// ============================================

import { useMemo } from "react";
import { InventoryItem, classifyExpiry, resolveExpiryAlertDays } from "../types/inventory";
import { Category } from "../types/category";
import { HistoricalItemStock } from "./useHistoricalInventory";

export interface HistoricalInventoryStats {
  totalItems:    number;
  lowStock:      number;
  outOfStock:    number;
  expiringSoon:  number;
}

export function useHistoricalInventoryStats(
  itemsWithHistoricalStock: HistoricalItemStock[],
  inventoryItems: InventoryItem[],
  categoryMap: Map<string, Category>,
  selectedDate: string,
  restaurantDefaultExpiryAlertDays?: number
): HistoricalInventoryStats {
  return useMemo(() => {
    const liveItemById = new Map(inventoryItems.map((it) => [it.id, it]));

    let lowStock = 0;
    let outOfStock = 0;
    let expiringSoon = 0;

    for (const histItem of itemsWithHistoricalStock) {
      const liveItem = liveItemById.get(histItem.inventoryId);
      const minStock = liveItem?.minStock ?? 0;

      if (histItem.historicalStock <= 0) {
        outOfStock += 1;
      } else if (histItem.historicalStock <= minStock) {
        lowStock += 1;
      }

      const category = histItem.categoryId ? categoryMap.get(histItem.categoryId) : undefined;
      const resolvedDays = resolveExpiryAlertDays(
        liveItem?.expiryAlertDaysOverride,
        category?.expiryAlertDays,
        restaurantDefaultExpiryAlertDays
      );

      const hasExpiringBatch = histItem.batches.some((batch) => {
        if (!batch.expiryDate) return false;
        return classifyExpiry(batch.expiryDate, selectedDate, resolvedDays) === "expiringSoon";
      });
      if (hasExpiringBatch) {
        expiringSoon += 1;
      }
    }

    return {
      totalItems: itemsWithHistoricalStock.length,
      lowStock,
      outOfStock,
      expiringSoon,
    };
  }, [itemsWithHistoricalStock, inventoryItems, categoryMap, selectedDate, restaurantDefaultExpiryAlertDays]);
}