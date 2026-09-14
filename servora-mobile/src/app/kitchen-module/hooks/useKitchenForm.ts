// ============================================
// SERVORA ERP — useKitchenForm Hook
// ✅ FIX — requestedBy fallback changed from `??` to `.trim() || ...`
//    (empty-string userProfile.name bug — see original comment).
// ✅ FIX — Kitchen Closing Stock is now ALWAYS the user's own typed
//    value, NEVER auto-overridden by Inventory's currentStock.
//    Previously: `const finalClosingStock = picked ? String(picked.currentStock) : closingStock;`
//    silently discarded whatever Kitchen typed and substituted
//    Inventory's live stock for "linked" items instead. Kitchen's
//    own physical count (which can legitimately differ from
//    Inventory's official record — spillage/wastage not yet logged)
//    was never actually saved for linked items. Now closingStock is
//    always the raw user input, optional (may be left blank —
//    saves as 0, no validation error).
// ✅ NEW — inventoryStockAtRequest: a separate, reference-only
//    snapshot of Inventory's currentStock captured at add-to-list
//    time (only when the item is linked) — never used to override
//    closingStock, purely informational for later display.
// ============================================

import { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { auth } from "../../../firebase";
import { useItemSearch } from "./useItemSearch";
import { sendKitchenRequest, SendKitchenRequestItem } from "../services/kitchen-request-service";
import { todayStr } from "../utils/kitchen-format";

export interface DraftKitchenRequestItem {
  itemName: string;
  inventoryId?: string | null;
  categoryId?: string | null;
  closingStock: string;
  inventoryStockAtRequest?: number | null;
  minimumLevel: string;
  orderQuantity: string;
  unit: string;
}

export interface UseKitchenFormResult {
  itemSearch:        ReturnType<typeof useItemSearch>;
  closingStock:       string;
  setClosingStock:    (v: string) => void;
  minimumLevel:       string;
  setMinimumLevel:    (v: string) => void;
  orderQuantity:      string;
  setOrderQuantity:   (v: string) => void;
  unit:               string;
  setUnit:            (v: string) => void;
  showUnitPicker:      boolean;
  setShowUnitPicker:   (v: boolean) => void;
  requiredDate:        string;
  setRequiredDate:     (v: string) => void;
  note:                string;
  setNote:             (v: string) => void;
  requestItems:        DraftKitchenRequestItem[];
  addItemToList:       () => void;
  removeItem:          (idx: number) => void;
  saving:              boolean;
  handleSendRequest:   () => Promise<boolean>;
}

export function useKitchenForm(
  restaurantId: string | null | undefined
): UseKitchenFormResult {
  const { userProfile } = useApp();
  const itemSearch = useItemSearch(restaurantId);

  const [closingStock, setClosingStock] = useState("");
  const [minimumLevel, setMinimumLevel] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [requiredDate, setRequiredDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [requestItems, setRequestItems] = useState<DraftKitchenRequestItem[]>([]);
  const [saving, setSaving] = useState(false);

  const addItemToList = () => {
    const picked = itemSearch.pickedItem;
    const finalUnit = picked?.unit ?? unit;
    const finalMinimumLevel = picked ? String(picked.minStock) : minimumLevel;

    if (!itemSearch.itemName.trim() || !orderQuantity) {
      throw new Error("Item name and order quantity required");
    }

    if (picked && requestItems.some((i) => i.inventoryId === picked.id)) {
      throw new Error(`${picked.itemName} is already in the list`);
    }

    setRequestItems((prev) => [...prev, {
      itemName: itemSearch.itemName.trim(),
      inventoryId: picked?.id ?? null,
      categoryId: itemSearch.selectedCategoryId ?? null,
      closingStock,
      inventoryStockAtRequest: picked ? picked.currentStock : null,
      minimumLevel: finalMinimumLevel,
      orderQuantity,
      unit: finalUnit,
    }]);

    itemSearch.reset();
    setClosingStock(""); setMinimumLevel(""); setOrderQuantity("");
  };

  const removeItem = (idx: number) => {
    setRequestItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSendRequest = async (): Promise<boolean> => {
    if (!restaurantId) {
      throw new Error("Restaurant not configured");
    }
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    setSaving(true);
    try {
      const items: SendKitchenRequestItem[] = requestItems.map((item) => ({
        itemName: item.itemName,
        inventoryId: item.inventoryId,
        categoryId: item.categoryId,
        closingStock: Number(item.closingStock || 0),
        inventoryStockAtRequest: item.inventoryStockAtRequest ?? null,
        minimumLevel: Number(item.minimumLevel || 0),
        orderQuantity: Number(item.orderQuantity),
        unit: item.unit,
      }));

      await sendKitchenRequest({
        items,
        requiredDate,
        requestedBy: userProfile?.name?.trim() || auth.currentUser?.email || "Chef",
        note: note.trim(),
        restaurantId,
        userId,
      });

      setRequestItems([]);
      setNote("");
      setRequiredDate(todayStr());
      setClosingStock("");
      setMinimumLevel("");
      setOrderQuantity("");
      setUnit("kg");
      return true;
    } finally {
      setSaving(false);
    }
  };

  return {
    itemSearch,
    closingStock, setClosingStock,
    minimumLevel, setMinimumLevel,
    orderQuantity, setOrderQuantity,
    unit, setUnit,
    showUnitPicker, setShowUnitPicker,
    requiredDate, setRequiredDate,
    note, setNote,
    requestItems,
    addItemToList,
    removeItem,
    saving,
    handleSendRequest,
  };
}