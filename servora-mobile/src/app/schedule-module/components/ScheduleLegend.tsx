// ============================================
// SERVORA ERP — Schedule Legend Component
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { STATUS_OPTIONS } from "../constants/statuses";

export function ScheduleLegend() {
  const { theme } = useApp();

  return (
    <View style={[
      styles.container,
      { backgroundColor: theme.card, borderTopColor: theme.border }
    ]}>
      {STATUS_OPTIONS.map((item) => (
        <View key={item.value} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 10,
    borderTopWidth: 1,
  },
  item:  { flexDirection: "row", alignItems: "center", gap: 5 },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 10 },
});