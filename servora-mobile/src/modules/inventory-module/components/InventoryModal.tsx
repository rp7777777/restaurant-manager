// ============================================
// SERVORA ERP — InventoryModal Component
// ✅ EVOLUTIONARY EXTRACTION — this is the exact Modal + header
//    (close icon, delete icon in edit mode) + InventoryForm JSX
//    that previously lived inline inside InventoryScreen.tsx's
//    render body. Behavior/styling unchanged; only the layer moved.
// ✅ Pure presentation/composition — no state, no Firestore calls.
//    All data (visibility, editing item, category/supplier lists)
//    and handlers (submit, cancel, delete) are passed in as props
//    from InventoryScreen.tsx, which keeps ownership of
//    open/close/editingItem state and the actual repository calls
//    exactly where they already are.
// ✅ Delete icon only shown when editingItem exists AND
//    canEditInventory is true — unchanged from the original.
// FROZEN
// ============================================

import React from "react";
import { View, Modal, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryForm } from "./InventoryForm";
import { InventoryItem, CreateInventoryItemInput, UpdateInventoryItemInput } from "../types/inventory";
import { CategoryPickerGroup } from "../hooks/useCategoriesForPicker";
import { Supplier } from "../../supplier-module/types/supplier";

interface InventoryModalProps {
  visible:          boolean;
  editingItem:      InventoryItem | undefined;
  canEditInventory: boolean;
  categoryGroups:   CategoryPickerGroup[];
  suppliers:        Supplier[];
  onSubmit:         (input: CreateInventoryItemInput | UpdateInventoryItemInput) => void | Promise<void>;
  onCancel:         () => void;
  onDelete:         (item: InventoryItem) => void;
}

export function InventoryModal({
  visible, editingItem, canEditInventory, categoryGroups, suppliers,
  onSubmit, onCancel, onDelete,
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
          onSubmit={onSubmit}
          onCancel={onCancel}
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