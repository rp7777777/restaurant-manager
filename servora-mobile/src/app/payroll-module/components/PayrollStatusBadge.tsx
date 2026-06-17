// ============================================
// SERVORA ERP — PayrollStatusBadge Component
// ✅ DRAFT / GENERATED / PAID colors
// ✅ Reusable everywhere
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PayrollStatus } from "../types/payroll-types";

interface Props {
  status: PayrollStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<PayrollStatus, { color: string; bg: string; label: string }> = {
  DRAFT:     { color: "#94a3b8", bg: "#94a3b815", label: "DRAFT"     },
  GENERATED: { color: "#f59e0b", bg: "#f59e0b15", label: "GENERATED" },
  PAID:      { color: "#10b981", bg: "#10b98115", label: "PAID"      },
};

export function PayrollStatusBadge({ status, size = "md" }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bg },
      size === "sm" && styles.badgeSm,
    ]}>
      <Text style={[
        styles.text,
        { color: config.color },
        size === "sm" && styles.textSm,
      ]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      6,
    alignSelf:         "flex-start",
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  text: {
    fontSize:   11,
    fontWeight: "800",
  },
  textSm: {
    fontSize: 9,
  },
});