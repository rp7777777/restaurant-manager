// ============================================
// SERVORA ERP — usePurchaseOrderForm Hook
// ✅ Order-stage form ONLY (Phase 8.2b) — supplier, expected
//    delivery date, and a dynamic list of items (itemName,
//    quantity ORDERED, unit, unitCost). Deliberately has NO
//    receivedQty/lotNumber/expiryDate fields — those don't exist
//    yet at order time (goods haven't arrived), and are entered
//    later at the separate Receive Goods step (Phase 8.2c).
// ✅ Item rows are local, editable state — each row can link to an
//    existing Inventory item (itemId set) or be free-text for a
//    new item not yet in Inventory (itemId left undefined).
// ✅ lineTotal/totalAmount are NOT computed here for the saved
//    record — repository always server-computes those from
//    quantity × unitCost (per its FROZEN contract). This hook only
//    computes a live preview total for the UI as the user types.
// PHASE 8.2b
// ============================================

import { useState, useCallback, useMemo } from "react";
import { createPurchaseOrder } from "../repository/purchase-order-repository";
import { CreatePurchaseOrderItemInput } from "../types/purchase-order";

export interface DraftPOItem {
rowId:      string;  // local-only key for React lists, never sent to Firestore
itemId?:    string;  // set when picked from existing Inventory
itemName:   string;
quantity:   string;  // kept as string while editing, parsed on save
unit:       string;
unitCost:   string;  // kept as string while editing, parsed on save
}

function makeEmptyRow(): DraftPOItem {
return {
rowId:    `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
itemName: "",
quantity: "",
unit:     "kg",
unitCost: "",
};
}

export interface UsePurchaseOrderFormResult {
supplierId:            string;
setSupplierId:         (id: string) => void;
expectedDeliveryDate:  string;
setExpectedDeliveryDate: (d: string) => void;
items:                 DraftPOItem[];
addItemRow:            () => void;
removeItemRow:         (rowId: string) => void;
updateItemRow:         (rowId: string, patch: Partial<DraftPOItem>) => void;
previewTotal:          number;
saving:                boolean;
error:                 string | null;
submit:                (restaurantId: string) => Promise<boolean>;
}

export function usePurchaseOrderForm(): UsePurchaseOrderFormResult {
const [supplierId, setSupplierId] = useState("");
const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
const [items, setItems] = useState<DraftPOItem[]>([makeEmptyRow()]);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);

const addItemRow = useCallback(() => {
setItems((prev) => [...prev, makeEmptyRow()]);
}, []);

const removeItemRow = useCallback((rowId: string) => {
setItems((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.rowId !== rowId)));
}, []);

const updateItemRow = useCallback((rowId: string, patch: Partial<DraftPOItem>) => {
setItems((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
}, []);

// ✅ UI preview only — real lineTotal/totalAmount are always
// server-computed by the repository from the same inputs.
const previewTotal = useMemo(() => {
return items.reduce((sum, row) => {
const qty  = Number(row.quantity);
const cost = Number(row.unitCost);
if (Number.isNaN(qty) || Number.isNaN(cost)) return sum;
return sum + qty * cost;
}, 0);
}, [items]);

const submit = useCallback(
async (restaurantId: string): Promise<boolean> => {
setError(null);

if (!supplierId) {  
    setError("Please select a supplier");  
    return false;  
  }  

  const cleanItems: CreatePurchaseOrderItemInput[] = [];  
  for (const row of items) {  
    if (!row.itemName.trim()) continue; // skip fully-empty rows silently  
    const qty  = Number(row.quantity);  
    const cost = Number(row.unitCost);  
    if (Number.isNaN(qty) || qty <= 0) {  
      setError(`"${row.itemName}": quantity must be a positive number`);  
      return false;  
    }  
    if (Number.isNaN(cost) || cost < 0) {  
      setError(`"${row.itemName}": unit cost must be a valid number`);  
      return false;  
    }  
    cleanItems.push({  
      itemId:   row.itemId,  
      itemName: row.itemName.trim(),  
      quantity: qty,  
      unit:     row.unit,  
      unitCost: cost,  
    });  
  }  

  if (cleanItems.length === 0) {  
    setError("Add at least one item");  
    return false;  
  }  

  setSaving(true);  
  try {  
    // ✅ createdBy is NOT passed here — createPurchaseOrder  
    // (repository, FROZEN) sets it internally from  
    // auth.currentUser.uid. Passing it would be ignored.  
    await createPurchaseOrder(restaurantId, {  
      supplierId,  
      items: cleanItems,  
      expectedDeliveryDate: expectedDeliveryDate.trim() || undefined,  
    });  
    return true;  
  } catch (err) {  
    setError(err instanceof Error ? err.message : "Failed to create purchase order");  
    return false;  
  } finally {  
    setSaving(false);  
  }  
},  
[supplierId, expectedDeliveryDate, items]

);

return {
supplierId, setSupplierId,
expectedDeliveryDate, setExpectedDeliveryDate,
items, addItemRow, removeItemRow, updateItemRow,
previewTotal,
saving, error,
submit,
};
}