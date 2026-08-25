// ============================================
// SERVORA ERP — InventoryFormDraftContext
// ✅ Enables the "+ New Supplier" detour from Add Item to preserve
//    the user's in-progress form state across the navigation to
//    Suppliers and back.
// ✅ IN-MEMORY ONLY (React Context state).
// ✅ consumeDraft() is WRITE-ONCE-READ-ONCE.
// ✅ Provider mounted at app root (_layout.tsx).
// ✅ shouldAutoOpenSupplierForm flag — Context-level, checked
//    synchronously in SuppliersScreen's render body via lazy
//    useState initializer.
// ✅ NEW — isDetourActive flag. Fixes a real, confirmed bug (via
//    console logging): InventoryScreen's useFocusEffect →
//    checkForReturnAndReopen() was previously guarded by a
//    COMPONENT-LOCAL ref (isDetourInProgress in
//    useSupplierDetourNavigation.ts) that only lived inside ONE
//    InventoryScreen instance. On web, Expo Router does not always
//    unmount the previous screen synchronously with navigation —
//    InventoryScreen could still be mounted (and its
//    useFocusEffect still firing) even AFTER router.push("/suppliers")
//    had successfully navigated and SuppliersScreen had begun
//    rendering. At that moment, hasPendingDraft() was still true
//    (the draft is only consumed later, by InventoryForm.tsx's OWN
//    mount effect, which hasn't happened yet), so
//    checkForReturnAndReopen() would reopen the Add Item modal —
//    ON TOP of the Suppliers screen — because the component-local
//    guard had already been cleared (it's released right when
//    router.push() fires, not when the ENTIRE detour, including
//    eventual draft consumption, actually completes).
//    Moving this flag into the Context makes it a single source of
//    truth reachable by ANY component instance, and — critically —
//    it now stays true for the FULL lifetime of the detour: from
//    the moment "New Supplier" is tapped, all the way through until
//    InventoryForm.tsx's mount effect actually calls consumeDraft()
//    and restores the form. Only consumeDraft() clears it. This
//    means checkForReturnAndReopen() can never reopen the modal
//    while a detour's draft is still legitimately "in flight" and
//    not yet consumed — regardless of which InventoryScreen
//    instance's focus effect is asking, or how many times it asks.
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
  requestAutoOpenSupplierForm:   () => void;
  consumeAutoOpenSupplierForm:   () => boolean;
  // ✅ NEW
  isDetourActive:                () => boolean;
}

const InventoryFormDraftContext = createContext<InventoryFormDraftContextValue | null>(null);

export function InventoryFormDraftProvider({ children }: { children: React.ReactNode }) {
  const draftRef = useRef<InventoryFormDraft | null>(null);
  const autoOpenSupplierFormRef = useRef(false);
  // ✅ NEW — set true the instant "New Supplier" is tapped; cleared
  // ONLY when consumeDraft() actually runs (inside InventoryForm.tsx's
  // mount effect, after returning from Suppliers).
  const detourActiveRef = useRef(false);

  const saveDraft = useCallback((draft: InventoryFormDraft) => {
    draftRef.current = draft;
    detourActiveRef.current = true;
  }, []);

  const consumeDraft = useCallback((): InventoryFormDraft | null => {
    const draft = draftRef.current;
    draftRef.current = null;
    detourActiveRef.current = false;
    return draft;
  }, []);

  const hasPendingDraft = useCallback(() => draftRef.current !== null, []);

  const markSupplierCreated = useCallback((supplierId: string) => {
    if (draftRef.current) {
      draftRef.current = { ...draftRef.current, newlyCreatedSupplierId: supplierId };
    }
  }, []);

  const requestAutoOpenSupplierForm = useCallback(() => {
    autoOpenSupplierFormRef.current = true;
  }, []);

  const consumeAutoOpenSupplierForm = useCallback((): boolean => {
    const value = autoOpenSupplierFormRef.current;
    autoOpenSupplierFormRef.current = false;
    return value;
  }, []);

  const isDetourActive = useCallback(() => detourActiveRef.current, []);

  return (
    <InventoryFormDraftContext.Provider
      value={{
        saveDraft, consumeDraft, hasPendingDraft, markSupplierCreated,
        requestAutoOpenSupplierForm, consumeAutoOpenSupplierForm,
        isDetourActive,
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