// ============================================
// SERVORA ERP — Sub-Category Picker Component
// Chip-style sub-category selector — only shown when the
// selected category has sub-categories defined.
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { ExpenseSubCategory } from "../types/category-types";

interface SubCategoryPickerProps {
  subCategories: ExpenseSubCategory[];
  value?: string;
  onChange: (subCategoryId: string) => void;
  disabled?: boolean;
}

export function SubCategoryPicker({
  subCategories,
  value,
  onChange,
  disabled = false,
}: SubCategoryPickerProps) {
  const { theme } = useApp();

  if (subCategories.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {subCategories.map((sub) => {
        const isSelected = value === sub.id;

        return (
          <TouchableOpacity
            key={sub.id}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? theme.primary : theme.surface,
                borderColor: isSelected ? theme.primary : theme.border,
                opacity: disabled && !isSelected ? 0.5 : 1,
              },
            ]}
            onPress={() => !disabled && sub.id && onChange(sub.id)}
            disabled={disabled}
            accessible
            accessibilityRole="button"
            accessibilityLabel={sub.name}
            accessibilityState={{ selected: isSelected, disabled }}
          >
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? "#ffffff" : theme.text },
              ]}
            >
              {sub.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
});