// ============================================
// SERVORA ERP — InventoryFormDraftContext
// ✅ NEW — enables the "+ New Supplier" detour from Add Item to
//    preserve the user's in-progress form state (category, item
//    search/selection, quantity, batch fields, etc.) across the
//    navigation to Suppliers and back — professional UX: the user
//    never loses their work just because they needed to create a
//    supplier mid-flow.
// ✅ IN-MEMORY ONLY (React Context state, not AsyncStorage/
//    localStorage) — deliberate choice. This draft only needs to
//    survive a same-session navigation (Inventory → Suppliers →
//    back), not a page refresh or app restart. Keeping it in-memory
//    avoids persistence-layer complexity (serialization, storage
//    quotas, stale-draft cleanup) for a need that's purely
//    navigation-scoped.
// ✅ consumeDraft() is WRITE-ONCE-READ-ONCE by design: reading it
//    clears it immediately. This guarantees a draft is only ever
//    applied ONE time — if the user later opens Add Item fresh
//    (unrelated to the supplier-creation detour), no stale draft
//    from a previous session could accidentally reappear.
// ✅ Provider is mounted at the Inventory module level (not app
//    root) — this draft concept has no meaning outside Inventory's
//    Add Item flow, so it doesn't need to be a global concern.
// FROZEN
// ============================================

import React, { createContext, useContext, useRef, useCallback } from "react";
import { InventoryUnit } from "../types/inventory";

export interface InventoryFormDraft {
  supplierId?:      string;
  categoryId:       string;
  isCreatingNew:    boolean;
  selectedExistingItemId?: string; // re-resolved against live items on restore
  itemName:         string;
  currentStock:     string;
  unit:             InventoryUnit;
  unitCost:         string;
  minStock:         string;
  batchNo:          string;
  receivedDate:     string;
  expiryDate:       string;
  storageLocation:  string;
  sku:              string;
  barcode:          string;
  notes:            string;
  // ✅ The supplier that was just created — restore logic should
  // prefer THIS over the draft's original supplierId (which may be
  // empty, since the whole point of the detour was "I don't have a
  // supplier yet").
  newlyCreatedSupplierId?: string;
}

interface InventoryFormDraftContextValue {
  saveDraft:    (draft: InventoryFormDraft) => void;
  consumeDraft: () => InventoryFormDraft | null;
  hasPendingDraft: () => boolean;
  markSupplierCreated: (supplierId: string) => void;
}

const InventoryFormDraftContext = createContext<InventoryFormDraftContextValue | null>(null);

export function InventoryFormDraftProvider({ children }: { children: React.ReactNode }) {
  const draftRef = useRef<InventoryFormDraft | null>(null);

  const saveDraft = useCallback((draft: InventoryFormDraft) => {
    draftRef.current = draft;
  }, []);

  const consumeDraft = useCallback((): InventoryFormDraft | null => {
    const draft = draftRef.current;
    draftRef.current = null; // write-once-read-once
    return draft;
  }, []);

  const hasPendingDraft = useCallback(() => draftRef.current !== null, []);

  const markSupplierCreated = useCallback((supplierId: string) => {
    if (draftRef.current) {
      draftRef.current = { ...draftRef.current, newlyCreatedSupplierId: supplierId };
    }
  }, []);

  return (
    <InventoryFormDraftContext.Provider value={{ saveDraft, consumeDraft, hasPendingDraft, markSupplierCreated }}>
      {children}
    </InventoryFormDraftContext.Provider>
  );
}

export function useInventoryFormDraft(): InventoryFormDraftContextValue {
  const ctx = useContext(InventoryFormDraftContext);
  if (!ctx) {
    throw new Error("useInventoryFormDraft must be used within InventoryFormDraftProvider");
  }
  return ctx;
}