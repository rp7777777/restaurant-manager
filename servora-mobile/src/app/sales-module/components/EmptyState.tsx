// ============================================
// SERVORA ERP — Empty State Component
// Shown when a shift has no sale entries yet
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  const { theme, t } = useApp();

  return (
    <View style={styles.container}>
      <MaterialIcons name="receipt-long" size={32} color={theme.textSecondary} />
      <Text style={[styles.text, { color: theme.textSecondary }]}>
        {message ?? t.noEntriesYet ?? "No entries yet"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
  },
});