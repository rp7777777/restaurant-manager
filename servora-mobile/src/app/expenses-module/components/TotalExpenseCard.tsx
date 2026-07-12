// ============================================
// SERVORA ERP — Total Expense Card Component
// Today's total expenses summary card
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";

interface TotalExpenseCardProps {
  total: number;
  onViewHistory?: () => void;
}

export function TotalExpenseCard({ total, onViewHistory }: TotalExpenseCardProps) {
  const { theme, fmt } = useApp();

  return (
    <View style={[styles.card, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}30` }]}>
      <View>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          TODAY'S TOTAL
        </Text>
        <Text style={[styles.value, { color: theme.error }]}>
          {fmt(total)}
        </Text>
      </View>

      {onViewHistory && (
        <TouchableOpacity
          onPress={onViewHistory}
          style={styles.historyButton}
          accessible
          accessibilityRole="button"
          accessibilityLabel="View expense history"
          accessibilityHint="Opens expense history"
        >
          <Text style={[styles.historyText, { color: theme.error }]}>History</Text>
          <MaterialIcons name="chevron-right" size={16} color={theme.error} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  historyText: {
    fontSize: 13,
    fontWeight: "700",
  },
});