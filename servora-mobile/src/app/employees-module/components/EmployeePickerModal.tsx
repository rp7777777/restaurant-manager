// ============================================
// SERVORA ERP — EmployeePickerModal Component
// ✅ Reusable picker modal
// ✅ Card click — modal band hudaina
// ✅ Color support — status colors
// ✅ Selected item highlighted
// ✅ Theme aware
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";

export interface PickerOption {
  value: string;
  label: string;
  color?: string;
}

interface EmployeePickerModalProps {
  visible:  boolean;
  title:    string;
  options:  PickerOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose:  () => void;
}

export const EmployeePickerModal = memo(({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: EmployeePickerModalProps) => {
  const { theme } = useApp();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        onPress={onClose}
        activeOpacity={1}
      >
        {/* ✅ Inner wrapper — card click modal band hudaina */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialIcons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.item,
                    { borderBottomColor: theme.border },
                    selected === opt.value && { backgroundColor: theme.sidebarActive },
                  ]}
                  onPress={() => onSelect(opt.value)}
                >
                  {opt.color && (
                    <View style={[styles.colorDot, { backgroundColor: opt.color }]} />
                  )}
                  <Text style={[
                    styles.itemText,
                    { color: opt.color ?? theme.text },
                  ]}>
                    {opt.label}
                  </Text>
                  {selected === opt.value && (
                    <MaterialIcons name="check" size={16} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  card:     { width: "100%", maxWidth: 340, borderRadius: 16, overflow: "hidden", maxHeight: 420 },
  header:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:    { fontSize: 15, fontWeight: "800" },
  item:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  itemText: { flex: 1, fontSize: 14, fontWeight: "600" },
});