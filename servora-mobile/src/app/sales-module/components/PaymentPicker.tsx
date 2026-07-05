// ============================================
// SERVORA ERP — Payment Method Picker Component
// Horizontal/wrap payment method selector
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { PaymentMethod } from "../types/sales-types";
import { PAYMENT_METHODS } from "../constants/payment-methods";
import { PAYMENT_COLORS } from "../constants/payment-colors";

interface PaymentPickerProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export function PaymentPicker({ value, onChange, disabled = false }: PaymentPickerProps) {
  const { theme } = useApp();

  return (
    <View style={styles.wrap}>
      {PAYMENT_METHODS.map((method) => {
        const isSelected = value === method;
        const color = PAYMENT_COLORS[method];

        return (
          <TouchableOpacity
            key={method}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? color : theme.surface,
                borderColor: isSelected ? color : theme.border,
                opacity: disabled && !isSelected ? 0.5 : 1,
              },
            ]}
            onPress={() => !disabled && onChange(method)}
            disabled={disabled}
          >
            <View style={[styles.dot, { backgroundColor: isSelected ? "#ffffff" : color }]} />
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? "#ffffff" : theme.text },
              ]}
            >
              {method}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});