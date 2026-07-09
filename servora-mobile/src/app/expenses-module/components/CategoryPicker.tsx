// ============================================
// SERVORA ERP — Category Picker Component
// Chip-style main category selector
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { ExpenseCategoryWithSubs } from "../types/category-types";

interface CategoryPickerProps {
  categories: ExpenseCategoryWithSubs[];
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
}

export function CategoryPicker({ categories, value, onChange, disabled = false }: CategoryPickerProps) {
  const { theme } = useApp();

  return (
    <View style={styles.wrap}>
      {categories.map((category) => {
        const isSelected = value === category.id;

        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? category.color : theme.surface,
                borderColor: isSelected ? category.color : theme.border,
                opacity: disabled && !isSelected ? 0.5 : 1,
              },
            ]}
            onPress={() => !disabled && category.id && onChange(category.id)}
            disabled={disabled}
            accessible
            accessibilityRole="button"
            accessibilityLabel={category.name}
            accessibilityState={{ selected: isSelected, disabled }}
          >
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? "#ffffff" : theme.text },
              ]}
            >
              {category.name}
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});