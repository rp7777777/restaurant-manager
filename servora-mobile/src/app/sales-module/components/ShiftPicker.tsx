// ============================================
// SERVORA ERP — Shift Picker Component
// Horizontal shift selector (Morning / Afternoon / Night)
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { Shift } from "../types/sales-types";
import { SHIFTS, SHIFT_ICONS, SHIFT_LABELS } from "../constants/shifts";
import { SHIFT_COLORS } from "../constants/shift-colors";

interface ShiftPickerProps {
  value: Shift;
  onChange: (shift: Shift) => void;
  disabled?: boolean;
}

export function ShiftPicker({ value, onChange, disabled = false }: ShiftPickerProps) {
  const { theme, t } = useApp();

  return (
    <View style={styles.row}>
      {SHIFTS.map((shift) => {
        const isSelected = value === shift;
        const color = SHIFT_COLORS[shift];

        return (
          <TouchableOpacity
            key={shift}
            style={[
              styles.option,
              {
                backgroundColor: isSelected ? color : theme.surface,
                borderColor: isSelected ? color : theme.border,
                opacity: disabled && !isSelected ? 0.5 : 1,
              },
            ]}
            onPress={() => !disabled && onChange(shift)}
            disabled={disabled}
          >
            <MaterialIcons
              name={SHIFT_ICONS[shift]}
              size={18}
              color={isSelected ? "#ffffff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.optionText,
                { color: isSelected ? "#ffffff" : theme.text },
              ]}
            >
              {t[shift.toLowerCase() as keyof typeof t] as string ?? SHIFT_LABELS[shift]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "600",
  },
});