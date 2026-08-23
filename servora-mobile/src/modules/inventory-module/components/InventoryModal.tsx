// ============================================
// SERVORA ERP — InventoryModal Component
// ✅ Pure presentation/composition — no state, no Firestore calls.
//    All data and handlers are passed in as props from
//    InventoryScreen.tsx.
// ✅ Delete icon only shown when editingItem exists AND
//    canEditInventory is true.
// ✅ FIX — onSubmit signature updated to InventoryFormSubmitPayload
//    (the discriminated union: newItem/existingItem/edit) matching
//    InventoryForm.tsx's redesigned submit contract. This modal
//    still does nothing with the payload itself — pure pass-through
//    to InventoryScreen.tsx, which now branches on payload.mode.
// ✅ NEW — allItems and onAddSupplier props added, both pure pass-
//    through to InventoryForm.tsx: allItems powers the new Supplier
//    → Category → Search-Existing-Item flow (useExistingItemSearch),
//    onAddSupplier is the "+ New Supplier" navigation callback.
// FROZEN
// ============================================

import React from "react";
import { View, Modal, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryForm } from "./InventoryForm";
import { InventoryItem } from "../types/inventory";
import { InventoryFormSubmitPayload } from "../hooks/useInventoryForm";
import { CategoryPickerGroup } from "../hooks/useCategoriesForPicker";
import { Supplier } from "../../supplier-module/types/supplier";

interface InventoryModalProps {
  visible:          boolean;
  editingItem:      InventoryItem | undefined;
  canEditInventory: boolean;
  categoryGroups:   CategoryPickerGroup[];
  suppliers:        Supplier[];
  allItems:         InventoryItem[];
  onSubmit:         (payload: InventoryFormSubmitPayload) => void | Promise<void>;
  onCancel:         () => void;
  onDelete:         (item: InventoryItem) => void;
  onAddSupplier:    () => void;
}

export function InventoryModal({
  visible, editingItem, canEditInventory, categoryGroups, suppliers, allItems,
  onSubmit, onCancel, onDelete, onAddSupplier,
}: InventoryModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onCancel}>
            <MaterialIcons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
          {editingItem && canEditInventory && (
            <TouchableOpacity onPress={() => onDelete(editingItem)}>
              <MaterialIcons name="delete" size={22} color="#dc2626" />
            </TouchableOpacity>
          )}
        </View>
        <InventoryForm
          mode={editingItem ? "edit" : "create"}
          initial={editingItem}
          categoryGroups={categoryGroups}
          suppliers={suppliers}
          allItems={allItems}
          onSubmit={onSubmit}
          onCancel={onCancel}
          onAddSupplier={onAddSupplier}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "web" ? 16 : 48, paddingBottom: 8,
  },
});