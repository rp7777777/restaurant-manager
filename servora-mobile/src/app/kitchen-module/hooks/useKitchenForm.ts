// ============================================
// SERVORA ERP — useKitchenForm Hook
// ✅ Owns the "New Request" form's remaining state — requiredDate,
//    note, closingStock/minimumLevel/unit/orderQuantity for the
//    item currently being added, and the requestItems list built up
//    before sending. Composes useItemSearch() for the item-search/
//    pick side rather than duplicating that logic.
// ✅ Calls kitchen-request-service.ts's sendKitchenRequest() —
//    never talks to Firestore directly.
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
  requiredDate:        string;
  setRequiredDate:     (v: string) => void;
  note:                string;
  setNote:             (v: string) => void;
  requestItems:        DraftKitchenRequestItem[];
  addItemToList:       () => void;
  removeItem:          (idx: number) => void;
  saving:              boolean;
  handleSendRequest:   () => Promise<boolean>;  // true on success
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
  const [requiredDate, setRequiredDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [requestItems, setRequestItems] = useState<DraftKitchenRequestItem[]>([]);
  const [saving, setSaving] = useState(false);

  const addItemToList = () => {
    const picked = itemSearch.pickedItem;
    const finalUnit = picked?.unit ?? unit;
    const finalClosingStock = picked ? String(picked.currentStock) : closingStock;
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
      closingStock: finalClosingStock,
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
    // ✅ Validated explicitly rather than falling back to `?? ""` —
    // an empty userId would still satisfy the service's `userId:
    // string` type and get written to Firestore silently, which is
    // a data-quality gap worth catching here at the form boundary
    // instead.
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
        minimumLevel: Number(item.minimumLevel || 0),
        orderQuantity: Number(item.orderQuantity),
        unit: item.unit,
      }));

      await sendKitchenRequest({
        items,
        requiredDate,
        requestedBy: userProfile?.name ?? auth.currentUser?.email ?? "Chef",
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
    requiredDate, setRequiredDate,
    note, setNote,
    requestItems,
    addItemToList,
    removeItem,
    saving,
    handleSendRequest,
  };
}