// ============================================
// SERVORA ERP — InventoryModalsGroup Component
// ✅ EXTRACTED VERBATIM from InventoryScreen.tsx — pure structural
//    refactor, NO behavior change. Groups all 7 modal/drawer
//    components (ItemDetailsDrawer, InventoryModal,
//    StockAdjustmentModal, InventoryBatchReport, ReceiveBatchModal,
//    ArchivedItemsModal, MovementHistoryModal) into one component,
//    each rendered with the exact same props they received inline
//    in InventoryScreen.tsx before.
// ✅ Pure presentation/composition — no state, no Firestore calls,
//    no business logic. All data and handlers are passed in as
//    props from InventoryScreen.tsx, which remains the single owner
//    of when each modal is visible and what happens on each action.
// ✅ This component exists purely to shrink InventoryScreen.tsx's
//    JSX — it has no independent responsibility beyond rendering
//    these 7 components with their props.
// FROZEN
// ============================================

import React from "react";
import { InventoryItem } from "../types/inventory";
import { Category } from "../types/category";
import { CategoryPickerGroup } from "../hooks/useCategoriesForPicker";
import { InventoryFormSubmitPayload } from "../hooks/useInventoryForm";
import { Supplier } from "../../supplier-module/types/supplier";
import { ItemDetailsDrawer } from "./ItemDetailsDrawer";
import { InventoryModal } from "./InventoryModal";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import { InventoryBatchReport } from "./InventoryBatchReport";
import { ReceiveBatchModal } from "./ReceiveBatchModal";
import { ArchivedItemsModal } from "./ArchivedItemsModal";
import { MovementHistoryModal } from "./MovementHistoryModal";

interface InventoryModalsGroupProps {
  // ItemDetailsDrawer
  drawerItem:                       InventoryItem | undefined;
  categoryMap:                      Map<string, Category>;
  restaurantId:                     string;
  todayISO:                         string;
  restaurantDefaultExpiryAlertDays?: number;
  fmt:                              (value: number) => string;
  canEditInventory:                 boolean;
  onCloseDrawer:                    () => void;
  onEditItem:                       (item: InventoryItem) => void;
  onAdjustStock:                    (item: InventoryItem) => void;
  onReceiveBatch:                   (item: InventoryItem) => void;

  // InventoryModal (Add/Edit form)
  showForm:          boolean;
  editingItem:       InventoryItem | undefined;
  categoryGroups:    CategoryPickerGroup[];
  suppliers:         Supplier[];
  allItems:          InventoryItem[];
  onSubmit:          (payload: InventoryFormSubmitPayload) => void | Promise<void>;
  onCancelForm:      () => void;
  onDeleteItem:      (item: InventoryItem) => void;
  onAddSupplier:     () => void;

  // StockAdjustmentModal
  adjustingItem:     InventoryItem | undefined;
  onCloseAdjustStock: () => void;

  // InventoryBatchReport
  showBatchReport:    boolean;
  onCloseBatchReport: () => void;

  // ReceiveBatchModal
  receiveBatchItem:     InventoryItem | undefined;
  onCloseReceiveBatch:  () => void;

  // ArchivedItemsModal
  items:                InventoryItem[];
  showArchivedItems:    boolean;
  onCloseArchivedItems: () => void;

  // MovementHistoryModal
  categories:              Category[];
  showMovementHistory:     boolean;
  onCloseMovementHistory:  () => void;
}

export function InventoryModalsGroup({
  drawerItem, categoryMap, restaurantId, todayISO, restaurantDefaultExpiryAlertDays,
  fmt, canEditInventory, onCloseDrawer, onEditItem, onAdjustStock, onReceiveBatch,
  showForm, editingItem, categoryGroups, suppliers, allItems, onSubmit, onCancelForm,
  onDeleteItem, onAddSupplier,
  adjustingItem, onCloseAdjustStock,
  showBatchReport, onCloseBatchReport,
  receiveBatchItem, onCloseReceiveBatch,
  items, showArchivedItems, onCloseArchivedItems,
  categories, showMovementHistory, onCloseMovementHistory,
}: InventoryModalsGroupProps) {
  return (
    <>
      <ItemDetailsDrawer
        visible={!!drawerItem}
        item={drawerItem}
        category={drawerItem ? categoryMap.get(drawerItem.categoryId) : undefined}
        restaurantId={restaurantId}
        todayISO={todayISO}
        restaurantDefaultExpiryAlertDays={restaurantDefaultExpiryAlertDays}
        fmt={fmt}
        canEditInventory={canEditInventory}
        onClose={onCloseDrawer}
        onEdit={onEditItem}
        onAdjustStock={onAdjustStock}
        onReceiveBatch={onReceiveBatch}
        duplicateNameSuffix="(Copy)"
      />

      <InventoryModal
        visible={showForm}
        editingItem={editingItem}
        canEditInventory={canEditInventory}
        categoryGroups={categoryGroups}
        suppliers={suppliers}
        allItems={allItems}
        onSubmit={onSubmit}
        onCancel={onCancelForm}
        onDelete={onDeleteItem}
        onAddSupplier={onAddSupplier}
      />

      <StockAdjustmentModal
        visible={!!adjustingItem}
        item={adjustingItem}
        restaurantId={restaurantId}
        onClose={onCloseAdjustStock}
      />

      <InventoryBatchReport
        visible={showBatchReport}
        restaurantId={restaurantId}
        onClose={onCloseBatchReport}
      />

      <ReceiveBatchModal
        visible={!!receiveBatchItem}
        item={receiveBatchItem}
        restaurantId={restaurantId}
        suppliers={suppliers}
        onClose={onCloseReceiveBatch}
      />

      <ArchivedItemsModal
        visible={showArchivedItems}
        items={items}
        categoryMap={categoryMap}
        restaurantId={restaurantId}
        fmt={fmt}
        onClose={onCloseArchivedItems}
      />

      <MovementHistoryModal
        visible={showMovementHistory}
        restaurantId={restaurantId}
        items={items}
        categories={categories}
        onClose={onCloseMovementHistory}
      />
    </>
  );
}