// ============================================
// SERVORA ERP — Total Card Component
// Today's grand total summary bar
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";

interface TotalCardProps {
  total: number;
  onViewHistory?: () => void;
}

export function TotalCard({ total, onViewHistory }: TotalCardProps) {
  const { theme, t, fmt } = useApp();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: `${theme.primary}12`, borderColor: theme.primary },
      ]}
    >
      <View>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {t.todaysTotal ?? "Today's Total"}
        </Text>
        <Text style={[styles.amount, { color: theme.primary }]}>{fmt(total)}</Text>
      </View>

      {onViewHistory && (
        <TouchableOpacity style={styles.historyLink} onPress={onViewHistory}>
          <Text style={[styles.historyText, { color: theme.primary }]}>
            {t.fullHistory ?? "Full History"}
          </Text>
          <MaterialIcons name="arrow-forward" size={16} color={theme.primary} />
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
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyText: {
    fontSize: 13,
    fontWeight: "600",
  },
});