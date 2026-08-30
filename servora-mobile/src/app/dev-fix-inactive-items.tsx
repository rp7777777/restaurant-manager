// ============================================
// SERVORA ERP — DEV-ONLY: Fix Inactive/Stale-Stock Items
// ⚠️ TEMPORARY FILE — access via URL: /dev-fix-inactive-items
// DELETE THIS FILE after running the repair once successfully.
// ============================================
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Platform } from "react-native";
import { useApp } from "../context/AppContext";
import { fixInactiveAndStaleStockItems } from "../modules/inventory-module/services/dev-fix-inactive-items-service";

export default function DevFixInactiveItemsScreen() {
  const { restaurantId } = useApp();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleRun = async () => {
    if (!restaurantId || running) return;
    setRunning(true);
    setLog([]);
    try {
      const result = await fixInactiveAndStaleStockItems(restaurantId);
      setLog(result);
    } catch (err: any) {
      setLog([`❌ Failed: ${err?.message ?? "Unknown error"}`]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>⚠️ Developer Tool — Fix Inactive/Stale Items</Text>
      <Text style={styles.subtitle}>
        Recomputes currentStock/isLowStock for every item from its actual
        batch documents, using the existing isActiveBatch() invariant
        (quantity {'>'} 0), and restores isActive=true for items that were
        incorrectly left inactive despite holding live stock. Never
        touches batches themselves.
      </Text>
      <TouchableOpacity
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={handleRun}
        disabled={running}
      >
        {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Run Reconciliation Now</Text>}
      </TouchableOpacity>

      <ScrollView style={styles.logBox}>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>{line}</Text>
        ))}
      </ScrollView>

      <Text style={styles.warning}>
        Delete this file (app/dev-fix-inactive-items.tsx) after confirming success.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: "#0a0a0a" },
  title: { fontSize: 20, fontWeight: "900", color: "#FFD700", marginBottom: 12 },
  subtitle: { fontSize: 13, color: "#ccc", marginBottom: 20, lineHeight: 19 },
  button: { backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  logBox: { marginTop: 20, flex: 1, backgroundColor: "#111", borderRadius: 8, padding: 12 },
  logLine: {
    color: "#0f0", fontSize: 11,
    fontFamily: Platform.select({ web: "monospace", default: undefined }),
    marginBottom: 3,
  },
  warning: { marginTop: 12, fontSize: 12, color: "#f59e0b" },
});