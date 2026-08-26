// ============================================
// SERVORA ERP — InventoryFormDraftContext
// ✅ Enables the "+ New Supplier" detour to preserve in-progress
//    form state across navigation to Suppliers and back.
// ✅ IN-MEMORY ONLY. consumeDraft() is WRITE-ONCE-READ-ONCE.
// ✅ requestAutoOpenSupplierForm/consumeAutoOpenSupplierForm — used
//    ONLY for the Inventory → Suppliers direction (opens
//    SupplierForm the instant Suppliers is reached).
// ✅ NEW — requestAutoOpenInventoryForm/consumeAutoOpenInventoryForm
//    — a SEPARATE, independent one-time signal for the
//    Suppliers → Inventory direction (reopens the Add Item modal
//    after a supplier was successfully saved). Fixes a real,
//    confirmed bug: the two directions were previously sharing the
//    SAME flag (requestAutoOpenSupplierForm/
//    consumeAutoOpenSupplierForm), which InventoryScreen deliberately
//    never read (to avoid an earlier bug where reading it caused the
//    modal to reopen on top of itself the instant "New Supplier" was
//    tapped, before navigation had even happened) — meaning the
//    "reopen after supplier save" signal was set but never consumed
//    by anyone, so the modal never actually reopened. Two distinct
//    flags removes all ambiguity: one always means "open Suppliers'
//    create form," the other always means "reopen Inventory's Add
//    Item form" — never conflated, never shared, never
//    misinterpreted by the wrong screen.
// ✅ isDetourActive — still tracks the FULL lifetime of a detour
//    (from saveDraft() until consumeDraft()), independent of either
//    auto-open flag.
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
  // ✅ NEW — separate signal for the Suppliers → Inventory direction.
  requestAutoOpenInventoryForm:  () => void;
  consumeAutoOpenInventoryForm:  () => boolean;
  isDetourActive:                () => boolean;
}

const InventoryFormDraftContext = createContext<InventoryFormDraftContextValue | null>(null);

export function InventoryFormDraftProvider({ children }: { children: React.ReactNode }) {
  const draftRef = useRef<InventoryFormDraft | null>(null);
  const autoOpenSupplierFormRef = useRef(false);
  const autoOpenInventoryFormRef = useRef(false);
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

  // ✅ NEW
  const requestAutoOpenInventoryForm = useCallback(() => {
    autoOpenInventoryFormRef.current = true;
  }, []);

  const consumeAutoOpenInventoryForm = useCallback((): boolean => {
    const value = autoOpenInventoryFormRef.current;
    autoOpenInventoryFormRef.current = false;
    return value;
  }, []);

  const isDetourActive = useCallback(() => detourActiveRef.current, []);

  return (
    <InventoryFormDraftContext.Provider
      value={{
        saveDraft, consumeDraft, hasPendingDraft, markSupplierCreated,
        requestAutoOpenSupplierForm, consumeAutoOpenSupplierForm,
        requestAutoOpenInventoryForm, consumeAutoOpenInventoryForm,
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