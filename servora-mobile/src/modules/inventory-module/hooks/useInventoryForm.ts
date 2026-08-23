// ============================================
// SERVORA ERP — useInventoryForm Hook
// ✅ Supports THREE submission modes via discriminated union:
//    1. "newItem" — creates a brand-new InventoryItem + its first
//       batch (unchanged behavior — CreateInventoryItemInput shape).
//    2. "existingItem" — user selected an EXISTING item (via
//       InventoryForm.tsx's Supplier → Category → Search-Existing-
//       Item flow) and is only receiving a NEW BATCH against it —
//       itemName/categoryId are LOCKED to the existing item; the
//       submit payload is batch-only fields.
//    3. "edit" — updating an already-created item's own fields —
//       COMPLETELY UNCHANGED from before. selectedExistingItem is a
//       CREATE-mode-only concept; InventoryForm.tsx never sets it
//       when mode === "edit".
// ✅ selectedExistingItem — when set, locks itemName/categoryId/unit
//    to the selected item's values. Supplier is DELIBERATELY NOT
//    locked — it represents THIS batch's supplier (a per-receiving
//    fact), not a permanent item-level default, so changing supplier
//    after selecting an existing item is expected and correct;
//    setSelectedExistingItem() never touches supplierId.
// ✅ NEW — receivedDate is now an independent form field (its own
//    state, own setter, own validation), NOT reused from
//    ReceiveBatchModal.tsx (a separate form instance) — shared by
//    BOTH the "newItem" and "existingItem" submit paths. This
//    matters for the historical Inventory feature — a batch's
//    receivedDate determines the earliest date it becomes visible in
//    historical-batch-replay-service.ts's reconstruction, so it can
//    never be silently omitted or defaulted away from the form.
// ✅ currentStock's UI LABEL is a presentation concern
//    (InventoryForm.tsx's job — showing "Current Stock" for newItem
//    mode vs "Quantity" for existingItem mode) — this hook keeps the
//    same underlying state field for both, since both represent "how
//    much is in this specific batch," just at different points in an
//    item's lifecycle (first batch vs. a later one).
// ✅ Edit mode validation/payload is UNCHANGED.
// FROZEN
// ============================================

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  InventoryItem,
  InventoryUnit,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
} from "../types/inventory";

function parsePositiveNumber(value: string): number | null {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

function isValidDateString(value: string): boolean {
  if (!value.trim()) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;

  const [year, month, day] = value.trim().split("-").map(Number);
  const date = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

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
  receivedDate:     string;
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
    receivedDate:     "",
    storageLocation:  initial?.storageLocation ?? "",
    supplierId:       initial?.supplierId ?? "",
    sku:              initial?.sku ?? "",
    barcode:          initial?.barcode ?? "",
    notes:            initial?.notes ?? "",
    isActive:         initial?.isActive ?? true,
  };
}

export type InventoryFormSubmitPayload =
  | { mode: "newItem"; input: CreateInventoryItemInput; receivedDate?: string }
  | { mode: "existingItem"; existingItem: InventoryItem; batch: {
      batchNo: string;
      quantity: number;
      unit: InventoryUnit;
      unitCost: number;
      expiryDate?: string;
      supplierId?: string;
      receivedDate?: string;
    } }
  | { mode: "edit"; input: UpdateInventoryItemInput };

export interface UseInventoryFormResult {
  itemName:              string;
  categoryId:             string;
  currentStock:           string;
  unit:                   InventoryUnit;
  unitCost:               string;
  minStock:               string;
  expiryDate:             string;
  batchNo:                string;
  receivedDate:            string;
  storageLocation:        string;
  supplierId:             string;
  sku:                    string;
  barcode:                string;
  notes:                  string;
  isActive:               boolean;
  setItemName:            (v: string) => void;
  setCategoryId:          (v: string) => void;
  setCurrentStock:        (v: string) => void;
  setUnit:                (v: InventoryUnit) => void;
  setUnitCost:            (v: string) => void;
  setMinStock:            (v: string) => void;
  setExpiryDate:          (v: string) => void;
  setBatchNo:             (v: string) => void;
  setReceivedDate:         (v: string) => void;
  setStorageLocation:     (v: string) => void;
  setSupplierId:          (v: string) => void;
  setSku:                 (v: string) => void;
  setBarcode:             (v: string) => void;
  setNotes:               (v: string) => void;
  setIsActive:            (v: boolean) => void;
  selectedExistingItem:      InventoryItem | undefined;
  setSelectedExistingItem:   (item: InventoryItem | undefined) => void;
  error:                  string | null;
  submitting:              boolean;
  isDirty:                 boolean;
  handleSubmit:            (onSubmit: (payload: InventoryFormSubmitPayload) => void | Promise<void>) => Promise<void>;
  reset:                   () => void;
}

export function useInventoryForm(
  mode: "create" | "edit",
  initial?: InventoryItem
): UseInventoryFormResult {
  const startingFields = useMemo(() => fieldsFromInitial(initial), [initial]);

  const [itemName,        setItemName]        = useState(startingFields.itemName);
  const [categoryId,      setCategoryId]      = useState(startingFields.categoryId);
  const [currentStock,    setCurrentStock]    = useState(startingFields.currentStock);
  const [unit,            setUnit]            = useState<InventoryUnit>(startingFields.unit);
  const [unitCost,        setUnitCost]        = useState(startingFields.unitCost);
  const [minStock,        setMinStock]        = useState(startingFields.minStock);
  const [expiryDate,      setExpiryDate]      = useState(startingFields.expiryDate);
  const [batchNo,         setBatchNo]         = useState(startingFields.batchNo);
  const [receivedDate,    setReceivedDate]    = useState(startingFields.receivedDate);
  const [storageLocation, setStorageLocation] = useState(startingFields.storageLocation);
  const [supplierId,      setSupplierId]      = useState(startingFields.supplierId);
  const [sku,             setSku]             = useState(startingFields.sku);
  const [barcode,         setBarcode]         = useState(startingFields.barcode);
  const [notes,           setNotes]           = useState(startingFields.notes);
  const [isActive,        setIsActive]        = useState(startingFields.isActive);
  const [error,           setError]           = useState<string | null>(null);
  const [submitting,      setSubmitting]      = useState(false);

  const [selectedExistingItem, setSelectedExistingItemRaw] = useState<InventoryItem | undefined>(undefined);

  const setSelectedExistingItem = useCallback((item: InventoryItem | undefined) => {
    setSelectedExistingItemRaw(item);
    if (item) {
      setItemName(item.itemName);
      setCategoryId(item.categoryId);
      setUnit(item.unit);
      // ✅ Supplier deliberately NOT touched — see FROZEN header.
    }
  }, []);

  useEffect(() => {
    setItemName(startingFields.itemName);
    setCategoryId(startingFields.categoryId);
    setCurrentStock(startingFields.currentStock);
    setUnit(startingFields.unit);
    setUnitCost(startingFields.unitCost);
    setMinStock(startingFields.minStock);
    setExpiryDate(startingFields.expiryDate);
    setBatchNo(startingFields.batchNo);
    setReceivedDate(startingFields.receivedDate);
    setStorageLocation(startingFields.storageLocation);
    setSupplierId(startingFields.supplierId);
    setSku(startingFields.sku);
    setBarcode(startingFields.barcode);
    setNotes(startingFields.notes);
    setIsActive(startingFields.isActive);
    setError(null);
    setSelectedExistingItemRaw(undefined);
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
      receivedDate    !== startingFields.receivedDate ||
      storageLocation !== startingFields.storageLocation ||
      supplierId      !== startingFields.supplierId ||
      sku             !== startingFields.sku ||
      barcode         !== startingFields.barcode ||
      notes           !== startingFields.notes ||
      isActive        !== startingFields.isActive
    );
  }, [
    itemName, categoryId, currentStock, unit, unitCost, minStock,
    expiryDate, batchNo, receivedDate, storageLocation, supplierId, sku, barcode, notes, isActive,
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
    setReceivedDate(startingFields.receivedDate);
    setStorageLocation(startingFields.storageLocation);
    setSupplierId(startingFields.supplierId);
    setSku(startingFields.sku);
    setBarcode(startingFields.barcode);
    setNotes(startingFields.notes);
    setIsActive(startingFields.isActive);
    setError(null);
    setSelectedExistingItemRaw(undefined);
  }, [startingFields]);

  const handleSubmit = async (
    onSubmit: (payload: InventoryFormSubmitPayload) => void | Promise<void>
  ) => {
    if (submitting) return;
    setError(null);

    // ── EDIT MODE — unchanged. ──
    if (mode === "edit") {
      if (!itemName.trim()) return setError("Item name is required");
      if (!categoryId) return setError("Category is required");

      const stockNum = parsePositiveNumber(currentStock);
      if (stockNum === null) return setError("Current stock must be a valid number");

      const costNum = parsePositiveNumber(unitCost);
      if (costNum === null) return setError("Unit cost must be a valid number");

      const minNum = parsePositiveNumber(minStock);
      if (minNum === null) return setError("Minimum stock must be a valid number");

      setSubmitting(true);
      try {
        await onSubmit({
          mode: "edit",
          input: {
            itemName:        itemName.trim(),
            categoryId,
            currentStock:    stockNum,
            unit,
            unitCost:        costNum,
            minStock:        minNum,
            storageLocation: storageLocation.trim() || undefined,
            supplierId:      supplierId || undefined,
            sku:             sku.trim() || undefined,
            barcode:         barcode.trim() || undefined,
            notes:           notes.trim() || undefined,
            isActive,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save item");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── CREATE MODE — "existingItem" branch. ──
    if (selectedExistingItem) {
      const qtyNum = parsePositiveNumber(currentStock);
      if (qtyNum === null || qtyNum <= 0) return setError("Quantity must be a valid positive number");
      if (!batchNo.trim()) return setError("Batch number is required");

      const costNum = parsePositiveNumber(unitCost);
      if (costNum === null) return setError("Unit cost must be a valid number");

      if (!isValidDateString(expiryDate)) {
        return setError("Expiry date must be a valid date in YYYY-MM-DD format");
      }
      if (!isValidDateString(receivedDate)) {
        return setError("Received date must be a valid date in YYYY-MM-DD format");
      }

      setSubmitting(true);
      try {
        await onSubmit({
          mode: "existingItem",
          existingItem: selectedExistingItem,
          batch: {
            batchNo: batchNo.trim(),
            quantity: qtyNum,
            unit,
            unitCost: costNum,
            expiryDate: expiryDate.trim() || undefined,
            supplierId: supplierId || undefined,
            receivedDate: receivedDate.trim() || undefined,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to receive batch");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── CREATE MODE — "newItem" branch. ──
    if (!itemName.trim()) return setError("Item name is required");
    if (!categoryId) return setError("Category is required");

    const stockNum = parsePositiveNumber(currentStock);
    if (stockNum === null) return setError("Current stock must be a valid number");

    const costNum = parsePositiveNumber(unitCost);
    if (costNum === null) return setError("Unit cost must be a valid number");

    const minNum = parsePositiveNumber(minStock);
    if (minNum === null) return setError("Minimum stock must be a valid number");

    if (!isValidDateString(expiryDate)) {
      return setError("Expiry date must be a valid date in YYYY-MM-DD format");
    }
    if (!isValidDateString(receivedDate)) {
      return setError("Received date must be a valid date in YYYY-MM-DD format");
    }

    setSubmitting(true);
    try {
      await onSubmit({
        mode: "newItem",
        input: {
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
        },
        receivedDate: receivedDate.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    itemName, categoryId, currentStock, unit, unitCost, minStock,
    expiryDate, batchNo, receivedDate, storageLocation, supplierId, sku, barcode, notes, isActive,
    setItemName, setCategoryId, setCurrentStock, setUnit, setUnitCost, setMinStock,
    setExpiryDate, setBatchNo, setReceivedDate, setStorageLocation, setSupplierId, setSku, setBarcode, setNotes, setIsActive,
    selectedExistingItem, setSelectedExistingItem,
    error,
    submitting,
    isDirty,
    handleSubmit,
    reset,
  };
}