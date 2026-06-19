// ============================================
// SERVORA ERP — WeekSelector Component
// ✅ weekDates length check — no crash
// ✅ Unused theme removed
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { formatFull } from "../utils/date-utils";

interface Props {
  weekDates: string[];
  onPrev: () => void;
  onNext: () => void;
  onCalendarOpen: () => void;
}

export function WeekSelector({
  weekDates,
  onPrev,
  onNext,
  onCalendarOpen,
}: Props) {
  // ✅ Safe — weekDates length check
  const startLabel = weekDates.length >= 1 ? formatFull(weekDates[0]) : "—";
  const endLabel   = weekDates.length >= 7 ? formatFull(weekDates[6]) : "—";

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrev} style={styles.arrow}>
        <MaterialIcons name="chevron-left" size={24} color="#FFD700" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.weekDisplay} onPress={onCalendarOpen}>
        <MaterialIcons
          name="calendar-today"
          size={13}
          color="rgba(255,255,255,0.8)"
        />
        <Text style={styles.weekText}>
          {startLabel} — {endLabel}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} style={styles.arrow}>
        <MaterialIcons name="chevron-right" size={24} color="#FFD700" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  arrow: { padding: 2 },
  weekDisplay: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 6,
    borderRadius: 8,
  },
  weekText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});