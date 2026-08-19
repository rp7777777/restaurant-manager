// ============================================
// SERVORA ERP — StoreDateNavigator Component
// ✅ NEW (per confirmed redesign) — replaces the removed tab system
//    entirely. Matches MovementHistoryModal.tsx's date navigator
//    exactly: `<` / `>` arrows, "Today" label for the current date,
//    formatted weekday/day/month/year for any other date, future
//    dates disabled (can't navigate past today).
// ✅ Pure presentation — receives selectedDate/today as props, calls
//    onNavigate(direction) rather than owning any date-shifting
//    logic itself (shiftDate() lives in store-formatters.ts,
//    orchestrated by index.tsx exactly like MovementHistoryModal.tsx
//    orchestrates its own).
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { formatDateLabel } from "../utils/store-formatters";

interface StoreDateNavigatorProps {
  selectedDate: string;
  today:        string;
  textColor:    string;
  onPrev:       () => void;
  onNext:       () => void;
}

export function StoreDateNavigator({ selectedDate, today, textColor, onPrev, onNext }: StoreDateNavigatorProps) {
  const isFuture = selectedDate >= today;

  return (
    <View style={styles.dateNav}>
      <TouchableOpacity onPress={onPrev} style={styles.dateNavArrow}>
        <MaterialIcons name="chevron-left" size={20} color={textColor} />
      </TouchableOpacity>
      <Text style={[styles.dateNavLabel, { color: textColor }]}>
        {formatDateLabel(selectedDate, today)}
      </Text>
      <TouchableOpacity onPress={onNext} style={styles.dateNavArrow} disabled={isFuture}>
        <MaterialIcons name="chevron-right" size={20} color={isFuture ? "#cbd5e1" : textColor} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingVertical: 8, marginBottom: 8,
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 13, fontWeight: "800", minWidth: 150, textAlign: "center" },
});