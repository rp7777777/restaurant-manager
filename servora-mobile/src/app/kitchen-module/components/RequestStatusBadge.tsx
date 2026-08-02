// ============================================
// SERVORA ERP — RequestStatusBadge Component
// ✅ Pure presentation — extracted from the status-badge logic that
//    was inline in RequestCard.tsx. Takes just a RequestStatus
//    (not the whole IngredientRequest), so it's reusable anywhere a
//    status needs displaying — e.g. a future Request Details screen,
//    or Today's Requests view.
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RequestStatus } from "../types/kitchen-types";
import { STATUS_COLORS, STATUS_ICONS } from "../constants/kitchen-constants";

interface RequestStatusBadgeProps {
  status: RequestStatus;
}

export default function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const statusColor = STATUS_COLORS[status] ?? "#94a3b8";
  const statusIcon = STATUS_ICONS[status] ?? "help";

  return (
    <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
      <MaterialIcons name={statusIcon as any} size={12} color={statusColor} />
      <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: "800" },
});