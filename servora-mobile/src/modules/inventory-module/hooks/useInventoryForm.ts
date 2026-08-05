// ============================================
// SERVORA ERP — useInventoryForm Hook
// ✅ EVOLUTIONARY EXTRACTION — this hook contains the exact form
//    state, validation, and submit logic that previously lived
//    inline inside InventoryForm.tsx's component body. Behavior is
//    unchanged except where noted below; only the layer moved
//    (Screen → Hook → Component, matching the pattern already used
//    by Kitchen module's useKitchenForm() → RequestForm).
// ✅ NEW in this extraction — sku, barcode, notes, isActive are now
//    part of the form state (Phase 1/2 added these fields to the
//    type/repository; this hook is what finally wires them into the
//    UI).
// ✅ FIX — Edit-mode re-sync: if the same form component instance is
//    reused across different items (e.g. a modal that stays mounted
//    while the user edits Item A, closes, then edits Item B), a
//    useState initializer alone would NOT pick up the new `initial`
//    on the second open. A useEffect keyed on `initial` re-syncs
//    every field whenever a different item is passed in.
// ✅ handleSubmit is now async and awaits onSubmit — matches the
//    async nature of createInventoryItem/updateInventoryItem/
//    duplicateInventoryItem, and enables the submitting state below.
// ✅ submitting — tracks in-flight submit so the caller can disable
//    the Save button / show a spinner and prevent double-submit.
//    Guards against re-entry: a submit already in flight is ignored.
// ✅ reset() — clears the form back to defaults (or back to
//    `initial` if editing) without unmounting the component. Useful
//    for "Save → clear form → add next item" flows.
// ✅ isDirty — true once any field differs from its starting value.
//    Scaffolded now for a future "Unsaved changes — discard?"
//    confirmation; not wired into any UI yet.
// ✅ validateExpiryDate — light client-side YYYY-MM-DD shape + real
//    calendar-date check. This is a UX nicety only; the repository
//    layer remains the actual source of truth for validation.
// ✅ parsePositiveNumber — single shared parser for the three
//    numeric fields, replacing three inline Number()+NaN checks
//    with one reusable helper.
// ✅ Numeric fields (currentStock/unitCost/minStock) are kept as
//    strings in state (matches the original TextInput-driven
//    design — React Native numeric TextInput values are strings)
//    and only parsed/validated at submit time.
// ✅ isActive defaults to true for both create and edit — an
//    existing item without the field set (pre-Phase-2 documents)
//    is treated as active, matching the repository's
//    `input.isActive ?? true` / undefined-means-active contract.
// ✅ This hook does NOT touch categoryGroups/suppliers loading —
//    those remain the responsibility of useCategoriesForPicker.ts
//    and the supplier module's own hook, passed in as props/args,
//    exactly as InventoryForm.tsx already receives them today.
// FROZEN
// ============================================

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  InventoryItem,
  InventoryUnit,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
} from "../types/inventory";

// ── Shared numeric parser — used for currentStock/unitCost/minStock.
//    Returns null if the string isn't a valid non-negative number. ──
function parsePositiveNumber(value: string): number | null {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

// ── Light client-side shape + calendar-validity check for
//    YYYY-MM-DD. Rejects strings like "2026-99-88" that Number()
//    parsing alone would miss. Empty string is valid (field is
//    optional). This does NOT replace repository-layer validation —
//    it's UX-only, catching obviously malformed input early. ──
function isValidExpiryDate(value: string): boolean {
  if (!value.trim()) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;

  const [year, month, day] = value.trim().split("-").map(Number);
  const date = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  // Reject values like 2026-02-31 that Date() would silently roll
  // over into March — getMonth()/getDate() must match what was typed.
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

interface FormFields {
  itemName:        string;
  categoryId:       string;
  currentStock:     string;
  unit:             InventoryUnit;
  unitCost:         string;
  minStock:         string;
  expiryDate:       string;
  batchNo:          string;
  storageLocation:  string;
  supplierId:       string;
  sku:              string;
  barcode:          string;
  notes:            string;
  isActive:         boolean;
}

function fieldsFromInitial(initial?: InventoryItem): FormFields {
  return {
    itemName:        initial?.itemName ?? "",
    categoryId:       initial?.categoryId ?? "",
    currentStock:     String(initial?.currentStock ?? "0"),
    unit:             initial?.unit ?? "kg",
    unitCost:         String(initial?.unitCost ?? "0"),
    minStock:         String(initial?.minStock ?? "0"),
    expiryDate:       initial?.expiryDate ?? "",
    batchNo:          initial?.batchNo ?? "",
    storageLocation:  initial?.storageLocation ?? "",
    supplierId:       initial?.supplierId ?? "",
    sku:              initial?.sku ?? "",
    barcode:          initial?.barcode ?? "",
    notes:            initial?.notes ?? "",
    isActive:         initial?.isActive ?? true,
  };
}

export interface UseInventoryFormResult {
  // Field values
  itemName:              string;
  categoryId:             string;
  currentStock:           string;
  unit:                   InventoryUnit;
  unitCost:               string;
  minStock:               string;
  expiryDate:             string;
  batchNo:                string;
  storageLocation:        string;
  supplierId:             string;
  sku:                    string;
  barcode:                string;
  notes:                  string;
  isActive:               boolean;
  // Field setters
  setItemName:            (v: string) => void;
  setCategoryId:          (v: string) => void;
  setCurrentStock:        (v: string) => void;
  setUnit:                (v: InventoryUnit) => void;
  setUnitCost:            (v: string) => void;
  setMinStock:            (v: string) => void;
  setExpiryDate:          (v: string) => void;
  setBatchNo:             (v: string) => void;
  setStorageLocation:     (v: string) => void;
  setSupplierId:          (v: string) => void;
  setSku:                 (v: string) => void;
  setBarcode:             (v: string) => void;
  setNotes:               (v: string) => void;
  setIsActive:            (v: boolean) => void;
  // Validation / submit
  error:                  string | null;
  submitting:              boolean;
  isDirty:                 boolean;
  handleSubmit:            (onSubmit: (input: CreateInventoryItemInput | UpdateInventoryItemInput) => void | Promise<void>) => Promise<void>;
  reset:                   () => void;
}

export function useInventoryForm(initial?: InventoryItem): UseInventoryFormResult {
  const startingFields = useMemo(() => fieldsFromInitial(initial), [initial]);

  const [itemName,        setItemName]        = useState(startingFields.itemName);
  const [categoryId,      setCategoryId]      = useState(startingFields.categoryId);
  const [currentStock,    setCurrentStock]    = useState(startingFields.currentStock);
  const [unit,            setUnit]            = useState<InventoryUnit>(startingFields.unit);
  const [unitCost,        setUnitCost]        = useState(startingFields.unitCost);
  const [minStock,        setMinStock]        = useState(startingFields.minStock);
  const [expiryDate,      setExpiryDate]      = useState(startingFields.expiryDate);
  const [batchNo,         setBatchNo]         = useState(startingFields.batchNo);
  const [storageLocation, setStorageLocation] = useState(startingFields.storageLocation);
  const [supplierId,      setSupplierId]      = useState(startingFields.supplierId);
  const [sku,             setSku]             = useState(startingFields.sku);
  const [barcode,         setBarcode]         = useState(startingFields.barcode);
  const [notes,           setNotes]           = useState(startingFields.notes);
  const [isActive,        setIsActive]        = useState(startingFields.isActive);
  const [error,           setError]           = useState<string | null>(null);
  const [submitting,      setSubmitting]      = useState(false);

  // ── Re-sync all fields whenever a DIFFERENT `initial` is passed
  //    in — covers the same form component being reused across
  //    multiple items (e.g. a modal that stays mounted). ──
  useEffect(() => {
    setItemName(startingFields.itemName);
    setCategoryId(startingFields.categoryId);
    setCurrentStock(startingFields.currentStock);
    setUnit(startingFields.unit);
    setUnitCost(startingFields.unitCost);
    setMinStock(startingFields.minStock);
    setExpiryDate(startingFields.expiryDate);
    setBatchNo(startingFields.batchNo);
    setStorageLocation(startingFields.storageLocation);
    setSupplierId(startingFields.supplierId);
    setSku(startingFields.sku);
    setBarcode(startingFields.barcode);
    setNotes(startingFields.notes);
    setIsActive(startingFields.isActive);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const isDirty = useMemo(() => {
    return (
      itemName        !== startingFields.itemName ||
      categoryId      !== startingFields.categoryId ||
      currentStock    !== startingFields.currentStock ||
      unit            !== startingFields.unit ||
      unitCost        !== startingFields.unitCost ||
      minStock        !== startingFields.minStock ||
      expiryDate      !== startingFields.expiryDate ||
      batchNo         !== startingFields.batchNo ||
      storageLocation !== startingFields.storageLocation ||
      supplierId      !== startingFields.supplierId ||
      sku             !== startingFields.sku ||
      barcode         !== startingFields.barcode ||
      notes           !== startingFields.notes ||
      isActive        !== startingFields.isActive
    );
  }, [
    itemName, categoryId, currentStock, unit, unitCost, minStock,
    expiryDate, batchNo, storageLocation, supplierId, sku, barcode, notes, isActive,
    startingFields,
  ]);

  const reset = useCallback(() => {
    setItemName(startingFields.itemName);
    setCategoryId(startingFields.categoryId);
    setCurrentStock(startingFields.currentStock);
    setUnit(startingFields.unit);
    setUnitCost(startingFields.unitCost);
    setMinStock(startingFields.minStock);
    setExpiryDate(startingFields.expiryDate);
    setBatchNo(startingFields.batchNo);
    setStorageLocation(startingFields.storageLocation);
    setSupplierId(startingFields.supplierId);
    setSku(startingFields.sku);
    setBarcode(startingFields.barcode);
    setNotes(startingFields.notes);
    setIsActive(startingFields.isActive);
    setError(null);
  }, [startingFields]);

  const handleSubmit = async (
    onSubmit: (input: CreateInventoryItemInput | UpdateInventoryItemInput) => void | Promise<void>
  ) => {
    if (submitting) return; // guard against double-submit re-entry
    setError(null);

    if (!itemName.trim()) return setError("Item name is required");
    if (!categoryId) return setError("Category is required");

    const stockNum = parsePositiveNumber(currentStock);
    if (stockNum === null) return setError("Current stock must be a valid number");

    const costNum = parsePositiveNumber(unitCost);
    if (costNum === null) return setError("Unit cost must be a valid number");

    const minNum = parsePositiveNumber(minStock);
    if (minNum === null) return setError("Minimum stock must be a valid number");

    if (!isValidExpiryDate(expiryDate)) {
      return setError("Expiry date must be a valid date in YYYY-MM-DD format");
    }

    setSubmitting(true);
    try {
      await onSubmit({
        itemName:        itemName.trim(),
        categoryId,
        currentStock:    stockNum,
        unit,
        unitCost:        costNum,
        minStock:        minNum,
        expiryDate:      expiryDate.trim() || undefined,
        batchNo:         batchNo.trim() || undefined,
        storageLocation: storageLocation.trim() || undefined,
        supplierId:      supplierId || undefined,
        sku:             sku.trim() || undefined,
        barcode:         barcode.trim() || undefined,
        notes:           notes.trim() || undefined,
        isActive,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    itemName, categoryId, currentStock, unit, unitCost, minStock,
    expiryDate, batchNo, storageLocation, supplierId, sku, barcode, notes, isActive,
    setItemName, setCategoryId, setCurrentStock, setUnit, setUnitCost, setMinStock,
    setExpiryDate, setBatchNo, setStorageLocation, setSupplierId, setSku, setBarcode, setNotes, setIsActive,
    error,
    submitting,
    isDirty,
    handleSubmit,
    reset,
  };
}