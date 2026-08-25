// ============================================
// SERVORA ERP — InventoryFormDraftContext
// ✅ Enables the "+ New Supplier" detour from Add Item to preserve
//    the user's in-progress form state across the navigation to
//    Suppliers and back.
// ✅ IN-MEMORY ONLY (React Context state) — deliberate choice, see
//    original design notes.
// ✅ consumeDraft() is WRITE-ONCE-READ-ONCE.
// ✅ Provider mounted at app root (_layout.tsx), since this crosses
//    routes (Inventory ↔ Suppliers).
// ✅ NEW — shouldAutoOpenSupplierForm flag, read directly (via
//    consumeAutoOpenSupplierForm()) by SuppliersScreen on its own
//    render body — NOT gated behind useEffect/useFocusEffect. This
//    replaces the previous ?autoOpen=create URL-query-parameter
//    approach, which proved genuinely unreliable: Expo Router's
//    mount/focus lifecycle on web meant the param wasn't always
//    observed at the moment SuppliersScreen actually needed to react
//    to it (a mount-only effect could run before the param existed
//    on the URL; even useFocusEffect could still miss the intended
//    render window depending on exactly how navigation was
//    triggered). A ref read directly during render has no such
//    lifecycle-timing dependency — by the time SuppliersScreen's
//    function body executes, this flag is simply already set or not,
//    with no window for a missed effect firing.
// ✅ consumeAutoOpenSupplierForm() is also write-once-read-once, same
//    rationale as consumeDraft() — guarantees the auto-open only
//    ever fires once per detour, never lingering to affect an
//    unrelated later visit to Suppliers.
// FROZEN
// ============================================

import React, { createContext, useContext, useRef, useCallback } from "react";
import { InventoryUnit } from "../types/inventory";

export interface InventoryFormDraft {
  supplierId?:      string;
  categoryId:       string;
  isCreatingNew:    boolean;
  selectedExistingItemId?: string;
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
  newlyCreatedSupplierId?: string;
}

interface InventoryFormDraftContextValue {
  saveDraft:                     (draft: InventoryFormDraft) => void;
  consumeDraft:                  () => InventoryFormDraft | null;
  hasPendingDraft:               () => boolean;
  markSupplierCreated:           (supplierId: string) => void;
  // ✅ NEW
  requestAutoOpenSupplierForm:   () => void;
  consumeAutoOpenSupplierForm:   () => boolean;
}

const InventoryFormDraftContext = createContext<InventoryFormDraftContextValue | null>(null);

export function InventoryFormDraftProvider({ children }: { children: React.ReactNode }) {
  const draftRef = useRef<InventoryFormDraft | null>(null);
  const autoOpenSupplierFormRef = useRef(false);

  const saveDraft = useCallback((draft: InventoryFormDraft) => {
    draftRef.current = draft;
  }, []);

  const consumeDraft = useCallback((): InventoryFormDraft | null => {
    const draft = draftRef.current;
    draftRef.current = null;
    return draft;
  }, []);

  const hasPendingDraft = useCallback(() => draftRef.current !== null, []);

  const markSupplierCreated = useCallback((supplierId: string) => {
    if (draftRef.current) {
      draftRef.current = { ...draftRef.current, newlyCreatedSupplierId: supplierId };
    }
  }, []);

  // ✅ NEW — set the instant "New Supplier" is tapped, BEFORE
  // navigation. Read (and cleared) directly by SuppliersScreen.
  const requestAutoOpenSupplierForm = useCallback(() => {
    autoOpenSupplierFormRef.current = true;
  }, []);

  const consumeAutoOpenSupplierForm = useCallback((): boolean => {
    const value = autoOpenSupplierFormRef.current;
    autoOpenSupplierFormRef.current = false;
    return value;
  }, []);

  return (
    <InventoryFormDraftContext.Provider
      value={{
        saveDraft, consumeDraft, hasPendingDraft, markSupplierCreated,
        requestAutoOpenSupplierForm, consumeAutoOpenSupplierForm,
      }}
    >
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