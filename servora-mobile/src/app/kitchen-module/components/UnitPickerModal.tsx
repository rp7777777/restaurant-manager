// ============================================
// SERVORA ERP — UnitPickerModal Component
// ✅ Pure presentation — extracted verbatim from the old
//    kitchen-module/index.tsx's inline Unit Picker Modal JSX.
// ✅ Local Theme interface (only the fields used), matching the
//    same established pattern as RequestCard.tsx/AttendanceCard.tsx.
// ============================================

import React from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { UNITS } from "../constants/kitchen-constants";

interface Theme {
  surface:       string;
  text:          string;
  border:        string;
  sidebarActive: string;
  primary:       string;
}

interface UnitPickerModalProps {
  visible:  boolean;
  unit:     string;
  onSelect: (unit: string) => void;
  onClose:  () => void;
  theme:    Theme;
}

export default function UnitPickerModal({
  visible, unit, onSelect, onClose, theme,
}: UnitPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Unit</Text>
          {UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.pickerItem, { borderBottomColor: theme.border }, unit === u && { backgroundColor: theme.sidebarActive }]}
              onPress={() => onSelect(u)}
            >
              <Text style={[styles.pickerItemText, { color: theme.text }]}>{u}</Text>
              {unit === u && <MaterialIcons name="check" size={14} color={theme.primary} />}
            </TouchableOpacity>
          ))}
        </View>
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