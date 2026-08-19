// ============================================
// SERVORA ERP — StoreHeader Component
// ✅ EVOLUTIONARY EXTRACTION — header + notif badge JSX moved
//    verbatim from index.tsx. Pure presentation — no state, no
//    Firestore calls.
// ✅ FIX — merged the two separate react-native import statements
//    into one (Platform folded into the existing View/Text/
//    StyleSheet import) — cosmetic only, no behavior change.
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

interface StoreHeaderProps {
  pendingCount: number;
}

export function StoreHeader({ pendingCount }: StoreHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>STORE</Text>
          <Text style={styles.headerSub}>Stock Issue & Requests</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.notifBadge}>
            <Text style={styles.notifText}>{pendingCount} Pending</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, paddingTop: Platform.OS === "web" ? 20 : 48, backgroundColor: "#00154f" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fbbf24", fontSize: 20, fontWeight: "800" },
  headerSub: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },
  notifBadge: { backgroundColor: "#f59e0b", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  notifText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});