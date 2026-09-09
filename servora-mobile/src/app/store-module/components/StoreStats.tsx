// ============================================
// SERVORA ERP — StoreStats Component
// ✅ NEW — cards are now clickable (TouchableOpacity), filtering the
//    table below by status via onStatusPress. activeStatus highlights
//    the currently-selected filter's card. Clicking the SAME
//    already-active status again clears the filter (toggle behavior),
//    handled in the parent (index.tsx).
// ✅ These counts are ALWAYS restaurant-wide totals (computed from
//    the full `requests` array, not displayRequests) — unchanged.
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export type StoreStatusFilter = "PENDING" | "APPROVED" | "ISSUED" | "REJECTED" | null;

interface StoreStatsProps {
  pendingCount:   number;
  approvedCount:  number;
  issuedCount:    number;
  rejectedCount:  number;
  cardBg:         string;
  textSecondary:  string;
  activeStatus:   StoreStatusFilter;
  onStatusPress:  (status: StoreStatusFilter) => void;
}

interface StatDef {
  label:  string;
  value:  number;
  color:  string;
  icon:   keyof typeof MaterialIcons.glyphMap;
  status: NonNullable<StoreStatusFilter>;
}

export function StoreStats({
  pendingCount, approvedCount, issuedCount, rejectedCount, cardBg, textSecondary,
  activeStatus, onStatusPress,
}: StoreStatsProps) {
  const stats: StatDef[] = [
    { label: "Pending",  value: pendingCount,  color: "#f59e0b", icon: "schedule",      status: "PENDING" },
    { label: "Approved", value: approvedCount, color: "#3b82f6", icon: "check-circle",  status: "APPROVED" },
    { label: "Issued",   value: issuedCount,   color: "#10b981", icon: "done-all",      status: "ISSUED" },
    { label: "Rejected", value: rejectedCount, color: "#ef4444", icon: "cancel",        status: "REJECTED" },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsRow}>
      {stats.map(({ label, value, color, icon, status }) => {
        const isActive = activeStatus === status;
        return (
          <TouchableOpacity
            key={label}
            style={[
              styles.statCard,
              { backgroundColor: cardBg },
              isActive && { borderColor: color, borderWidth: 2 },
            ]}
            onPress={() => onStatusPress(isActive ? null : status)}
            activeOpacity={0.7}
          >
            <MaterialIcons name={icon} size={13} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statsScroll: { maxHeight: 36, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  statCard: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 30,
    borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 9,
  },
  statValue: { fontSize: 12, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600" },
});