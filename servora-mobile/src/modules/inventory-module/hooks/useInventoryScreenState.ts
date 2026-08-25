// ============================================
// SERVORA ERP — useInventoryScreenState Hook
// ✅ EXTRACTED VERBATIM from InventoryScreen.tsx — pure structural
//    refactor, NO behavior change. Every state field and handler
//    here is byte-for-byte the same logic as before, just relocated.
// ✅ Owns ONLY modal/UI state and its open/close handlers:
//    showForm, editingItem, saving, seeding, adjustingItem,
//    drawerItem, showBatchReport, receiveBatchItem,
//    showArchivedItems, showMovementHistory.
// ✅ Does NOT own: Firestore/data fetching, handleSubmit,
//    handleDelete, supplier detour navigation, draft
//    consumption, useFocusEffect, date navigation, or modal
//    component rendering — those responsibilities live in
//    InventoryScreen.tsx directly, useSupplierDetourNavigation.ts,
//    useInventoryDateNavigation.ts, and InventoryModalsGroup.tsx
//    respectively. This hook has no router or
//    useInventoryFormDraft dependency at all — the supplier-detour
//    concern is fully separated.
// ✅ `saving` and `seeding` are exposed as raw state (not wrapped in
//    open/close handlers) since InventoryScreen.tsx's own
//    handleSubmit/handleSeedDefaults async functions need direct
//    setSaving/setSeeding access around their try/finally blocks —
//    unlike the other fields, these aren't simple "open modal A,
//    close modal A" toggles.
// FROZEN
// ============================================

import { useState, useCallback } from "react";
import { InventoryItem } from "../types/inventory";

export interface UseInventoryScreenStateResult {
  showForm:              boolean;
  setShowForm:           (v: boolean) => void;
  editingItem:           InventoryItem | undefined;
  setEditingItem:        (item: InventoryItem | undefined) => void;
  saving:                boolean;
  setSaving:             (v: boolean) => void;
  seeding:               boolean;
  setSeeding:            (v: boolean) => void;
  adjustingItem:         InventoryItem | undefined;
  drawerItem:            InventoryItem | undefined;
  showBatchReport:       boolean;
  receiveBatchItem:      InventoryItem | undefined;
  showArchivedItems:     boolean;
  showMovementHistory:   boolean;

  openCreate:            () => void;
  openEdit:              (item: InventoryItem) => void;
  closeForm:             () => void;

  openAdjustStock:       (item: InventoryItem) => void;
  closeAdjustStock:      () => void;

  openDrawer:            (item: InventoryItem) => void;
  closeDrawer:           () => void;

  openBatchReport:       () => void;
  closeBatchReport:      () => void;

  openReceiveBatch:      (item: InventoryItem) => void;
  closeReceiveBatch:     () => void;

  openArchivedItems:     () => void;
  closeArchivedItems:    () => void;

  openMovementHistory:   () => void;
  closeMovementHistory:  () => void;
}

export function useInventoryScreenState(): UseInventoryScreenStateResult {
  const [showForm,             setShowForm]             = useState(false);
  const [editingItem,          setEditingItem]          = useState<InventoryItem | undefined>(undefined);
  const [saving,                setSaving]                = useState(false);
  const [seeding,               setSeeding]               = useState(false);
  const [adjustingItem,         setAdjustingItem]         = useState<InventoryItem | undefined>(undefined);
  const [drawerItem,            setDrawerItem]            = useState<InventoryItem | undefined>(undefined);
  const [showBatchReport,       setShowBatchReport]       = useState(false);
  const [receiveBatchItem,      setReceiveBatchItem]      = useState<InventoryItem | undefined>(undefined);
  const [showArchivedItems,     setShowArchivedItems]     = useState(false);
  const [showMovementHistory,   setShowMovementHistory]   = useState(false);

  const openCreate = useCallback(() => {
    setEditingItem(undefined);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingItem(undefined);
  }, []);

  const openAdjustStock = useCallback((item: InventoryItem) => {
    setAdjustingItem(item);
  }, []);

  const closeAdjustStock = useCallback(() => {
    setAdjustingItem(undefined);
  }, []);

  const openDrawer = useCallback((item: InventoryItem) => {
    setDrawerItem(item);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerItem(undefined);
  }, []);

  const openBatchReport = useCallback(() => {
    setShowBatchReport(true);
  }, []);

  const closeBatchReport = useCallback(() => {
    setShowBatchReport(false);
  }, []);

  const openReceiveBatch = useCallback((item: InventoryItem) => {
    setDrawerItem(undefined);
    setReceiveBatchItem(item);
  }, []);

  const closeReceiveBatch = useCallback(() => {
    setReceiveBatchItem(undefined);
  }, []);

  const openArchivedItems = useCallback(() => {
    setShowArchivedItems(true);
  }, []);

  const closeArchivedItems = useCallback(() => {
    setShowArchivedItems(false);
  }, []);

  const openMovementHistory = useCallback(() => {
    setShowMovementHistory(true);
  }, []);

  const closeMovementHistory = useCallback(() => {
    setShowMovementHistory(false);
  }, []);

  return {
    showForm, setShowForm,
    editingItem, setEditingItem,
    saving, setSaving,
    seeding, setSeeding,
    adjustingItem,
    drawerItem,
    showBatchReport,
    receiveBatchItem,
    showArchivedItems,
    showMovementHistory,

    openCreate, openEdit, closeForm,
    openAdjustStock, closeAdjustStock,
    openDrawer, closeDrawer,
    openBatchReport, closeBatchReport,
    openReceiveBatch, closeReceiveBatch,
    openArchivedItems, closeArchivedItems,
    openMovementHistory, closeMovementHistory,
  };
}