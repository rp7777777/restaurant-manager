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
// ✅ Moved from the old kitchen-module/index.tsx's inline
//    debouncedItemName/itemMatches/selectedCategoryId logic —
//    mechanics unchanged, just relocated.
// ✅ No exact precedent to mirror here — Purchase Order's own item
//    picker (usePurchaseOrderForm.ts) has no live search at all
//    (itemId is just an optional field on each row), so this split
//    (search hook vs form hook) was reasoned through directly for
//    Kitchen's more complex search-as-you-type UX rather than
//    copied from an existing pattern.
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
  reset:                 () => void;
}

export function useItemSearch(
  restaurantId: string | null | undefined
): UseItemSearchResult {
  const { items: inventoryItems } = useInventory(restaurantId);
  const { categories } = useCategoriesForPicker(restaurantId);

  const [itemName, setItemName] = useState("");
  const [debouncedItemName, setDebouncedItemName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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
    setItemName("");
    setShowItemPicker(false);
  };

  // ✅ Selecting a category also opens the item picker automatically
  // — pairs with the itemMatches fix above (category selected +
  // empty search now returns that category's items) so the Chef
  // actually SEES those items immediately, rather than picking a
  // category and then still needing to tap/type in the search box
  // before anything appears. !!id also means CLEARING the category
  // closes the picker symmetrically, not just opening it on select.
  const handleSetSelectedCategoryId = (id: string | undefined) => {
    setSelectedCategoryId(id);
    setShowItemPicker(!!id);
  };

  return {
    itemName, setItemName,
    itemMatches, inventoryItems, categories,
    selectedCategoryId, setSelectedCategoryId: handleSetSelectedCategoryId,
    showItemPicker, setShowItemPicker,
    showCategoryPicker, setShowCategoryPicker,
    debouncedItemName,
    reset,
  };
}