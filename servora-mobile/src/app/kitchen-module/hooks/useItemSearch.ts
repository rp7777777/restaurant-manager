// ============================================
// SERVORA ERP — useItemSearch Hook
// ✅ Owns ONLY the search/category-narrowing mechanics — debounced
//    Inventory item search, optional category filter. Deliberately
//    does NOT own what happens when an item is picked (filling
//    itemName/inventoryId/unit/closingStock/minimumLevel on the
//    request form) — that's the calling hook's job
//    (useKitchenForm.ts), since those are FORM fields, not search
//    state. Keeps this hook reusable anywhere Inventory search is
//    needed, not tied to the shape of one particular form.
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