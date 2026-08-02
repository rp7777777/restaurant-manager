// ============================================
// SERVORA ERP — CategoryPickerModal Component
// ✅ Pure presentation — extracted verbatim from the old
//    kitchen-module/index.tsx's inline Category Picker Modal JSX.
// ✅ Local Theme interface, matching the established pattern.
// ============================================

import React from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Category } from "../../../modules/inventory-module/types/category";

interface Theme {
  surface:       string;
  text:          string;
  border:        string;
  sidebarActive: string;
  primary:       string;
}

interface CategoryPickerModalProps {
  visible:            boolean;
  categories:          Category[];
  selectedCategoryId:  string | undefined;
  onSelect:            (id: string | undefined) => void;
  onClose:             () => void;
  theme:               Theme;
}

export default function CategoryPickerModal({
  visible, categories, selectedCategoryId, onSelect, onClose, theme,
}: CategoryPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={[styles.pickerCard, { backgroundColor: theme.surface, maxHeight: 400 }]}
          >
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Category</Text>
            <TouchableOpacity
              style={[styles.pickerItem, { borderBottomColor: theme.border }, !selectedCategoryId && { backgroundColor: theme.sidebarActive }]}
              onPress={() => { onSelect(undefined); onClose(); }}
            >
              <Text style={[styles.pickerItemText, { color: theme.text }]}>All Categories</Text>
              {!selectedCategoryId && <MaterialIcons name="check" size={14} color={theme.primary} />}
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pickerItem, { borderBottomColor: theme.border }, selectedCategoryId === c.id && { backgroundColor: theme.sidebarActive }]}
                onPress={() => { onSelect(c.id); onClose(); }}
              >
                <Text style={[styles.pickerItemText, { color: theme.text }]}>{c.name}</Text>
                {selectedCategoryId === c.id && <MaterialIcons name="check" size={14} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  pickerCard: { width: "100%", maxWidth: 300, borderRadius: 16, overflow: "hidden" },
  pickerTitle: { fontSize: 15, fontWeight: "800", padding: 16, paddingBottom: 8 },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
});