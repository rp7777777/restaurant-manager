// ============================================
// SERVORA ERP — useItemSearch Hook
// ✅ FIX — itemMatches now excludes:
//    - Archived items (isActive === false) — Kitchen should never
//      be able to request an item the restaurant has explicitly
//      archived/discontinued. Previously an archived item could
//      appear in search results and be selected, only to be
//      rejected much later at issue time with "Cannot issue — this
//      inventory item is archived" — confusing for both Kitchen
//      (who successfully submitted the request) and Store (who only
//      discovers the problem when trying to fulfill it). Filtering
//      it out at search time prevents the dead-end request from
//      ever being created.
//    - Zero-stock items (currentStock === 0) — requesting an item
//      that currently has no stock at all invites an immediate
//      "Cannot issue" rejection at Store's end too. Filtering it out
//      here steers Kitchen toward items that can actually be
//      fulfilled right now, rather than creating a request that's
//      guaranteed to fail (or sit blocked) until Store separately
//      receives more stock.
//    Both checks happen BEFORE the existing category/name-search
//    filters, so they apply uniformly regardless of how the item was
//    being searched for.
// ============================================

import { useState, useEffect, useMemo } from "react";
import { useInventory } from "../../../modules/inventory-module/hooks/useInventory";
import { useCategoriesForPicker } from "../../../modules/inventory-module/hooks/useCategoriesForPicker";
import { InventoryItem } from "../../../modules/inventory-module/types/inventory";

export interface UseItemSearchResult {
  itemName:            string;
  setItemName:         (name: string) => void;
  itemMatches:          InventoryItem[];
  inventoryItems:       InventoryItem[];
  categories:           ReturnType<typeof useCategoriesForPicker>["categories"];
  selectedCategoryId:   string | undefined;
  setSelectedCategoryId: (id: string | undefined) => void;
  showItemPicker:        boolean;
  setShowItemPicker:     (show: boolean) => void;
  showCategoryPicker:    boolean;
  setShowCategoryPicker: (show: boolean) => void;
  debouncedItemName:     string;
  pickedItem:           InventoryItem | undefined;
  selectItem:           (item: InventoryItem) => void;
  reset:                () => void;
}

export function useItemSearch(
  restaurantId: string | null | undefined
): UseItemSearchResult {
  const { items: inventoryItems } = useInventory(restaurantId);
  const { categories } = useCategoriesForPicker(restaurantId);

  const [itemName, setItemNameRaw] = useState("");
  const [debouncedItemName, setDebouncedItemName] = useState("");
  const [selectedCategoryId, setSelectedCategoryIdRaw] = useState<string | undefined>(undefined);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [pickedItem, setPickedItem] = useState<InventoryItem | undefined>(undefined);

  const setItemName = (name: string) => {
    setItemNameRaw(name);
    setPickedItem(undefined);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedItemName(itemName), 300);
    return () => clearTimeout(timer);
  }, [itemName]);

  const itemMatches = useMemo(() => {
    const q = debouncedItemName.trim().toLowerCase();
    if (q.length < 2 && !selectedCategoryId) return [];
    return inventoryItems
      // ✅ FIX — exclude archived and zero-stock items from Kitchen's
      // request picker (see FROZEN header).
      .filter((it) => it.isActive !== false)
      .filter((it) => it.currentStock > 0)
      .filter((it) => !selectedCategoryId || it.categoryId === selectedCategoryId)
      .filter((it) => q.length < 2 || it.itemName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [debouncedItemName, inventoryItems, selectedCategoryId]);

  const reset = () => {
    setItemNameRaw("");
    setShowItemPicker(false);
    setPickedItem(undefined);
  };

  const handleSetSelectedCategoryId = (id: string | undefined) => {
    setSelectedCategoryIdRaw(id);
    setShowItemPicker(!!id);
    setItemNameRaw("");
    setPickedItem(undefined);
  };

  const selectItem = (item: InventoryItem) => {
    setItemNameRaw(item.itemName);
    setPickedItem(item);
    setShowItemPicker(false);
    if (!selectedCategoryId) setSelectedCategoryIdRaw(item.categoryId);
  };

  return {
    itemName, setItemName,
    itemMatches, inventoryItems, categories,
    selectedCategoryId, setSelectedCategoryId: handleSetSelectedCategoryId,
    showItemPicker, setShowItemPicker,
    showCategoryPicker, setShowCategoryPicker,
    debouncedItemName,
    pickedItem, selectItem,
    reset,
  };
}