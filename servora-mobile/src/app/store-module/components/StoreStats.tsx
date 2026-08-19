// ============================================
// SERVORA ERP — StoreStats Component
// ✅ EVOLUTIONARY EXTRACTION — the 4-stat horizontal scroll strip
//    moved verbatim from index.tsx. Pure presentation — receives
//    pre-computed counts as props, computes nothing itself.
// ✅ FIX — textSecondary is now a prop (matching the original
//    index.tsx's theme.textSecondary usage exactly), not a
//    hardcoded color. The previous version silently dropped
//    dark/light theme responsiveness for the stat labels — a real
//    visual regression against the "verbatim extraction, behavior
//    unchanged" rule. Now the caller (index.tsx) passes
//    theme.textSecondary through, exactly as the original inline
//    JSX did.
// ✅ These counts are ALWAYS restaurant-wide totals (computed from
//    the full `requests` array, not displayRequests) — matches
//    original index.tsx behavior exactly, unchanged.
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface StoreStatsProps {
  pendingCount:   number;
  approvedCount:  number;
  issuedCount:    number;
  rejectedCount:  number;
  cardBg:         string;
  textSecondary:  string;
}

interface StatDef {
  label: string;
  value: number;
  color: string;
  icon:  keyof typeof MaterialIcons.glyphMap;
}

export function StoreStats({
  pendingCount, approvedCount, issuedCount, rejectedCount, cardBg, textSecondary,
}: StoreStatsProps) {
  const stats: StatDef[] = [
    { label: "Pending",  value: pendingCount,  color: "#f59e0b", icon: "schedule" },
    { label: "Approved", value: approvedCount, color: "#3b82f6", icon: "check-circle" },
    { label: "Issued",   value: issuedCount,   color: "#10b981", icon: "done-all" },
    { label: "Rejected", value: rejectedCount, color: "#ef4444", icon: "cancel" },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsRow}>
      {stats.map(({ label, value, color, icon }) => (
        <View key={label} style={[styles.statCard, { backgroundColor: cardBg }]}>
          <MaterialIcons name={icon} size={13} color={color} />
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>{label}</Text>
        </View>
      ))}
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