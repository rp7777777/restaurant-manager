// ============================================
// SERVORA ERP — PayrollMonthSelector Component
// ✅ Prev/Next month navigation
// ✅ Month + Year display
// ✅ undefined protection
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { MONTHS_EN } from "../../schedule-module/constants/schedule-config";

interface Props {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}

export function PayrollMonthSelector({ month, year, onPrev, onNext }: Props) {
  // ✅ undefined protection
  const monthLabel = MONTHS_EN[month] ?? "Unknown";

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrev} style={styles.arrow}>
        <MaterialIcons name="chevron-left" size={24} color="#FFD700" />
      </TouchableOpacity>

      <Text style={styles.label}>
        {monthLabel} {year}
      </Text>

      <TouchableOpacity onPress={onNext} style={styles.arrow}>
        <MaterialIcons name="chevron-right" size={24} color="#FFD700" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            16,
    marginTop:      6,
  },
  arrow: { padding: 4 },
  label: {
    color:      "#fff",
    fontSize:   16,
    fontWeight: "800",
    minWidth:   160,
    textAlign:  "center",
  },
});