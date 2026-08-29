// ============================================
// SERVORA ERP — DEV-ONLY: One-time Duplicate Item Merge
// ⚠️ TEMPORARY FILE — not linked from any navigation/sidebar.
// Access directly via URL: /dev-merge-duplicate-items
// DELETE THIS FILE after running the repair once successfully.
// ============================================
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Platform } from "react-native";
import { useApp } from "../context/AppContext";
import { mergeDuplicateInventoryItems } from "../modules/inventory-module/services/dev-merge-duplicates-service";

export default function DevMergeDuplicateItemsScreen() {
  const { restaurantId } = useApp();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleRun = async () => {
    if (!restaurantId || running) return;
    setRunning(true);
    setLog([]);
    try {
      const result = await mergeDuplicateInventoryItems(restaurantId);
      setLog(result);
    } catch (err: any) {
      setLog([`❌ Failed: ${err?.message ?? "Unknown error"}`]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>⚠️ Developer Tool — Merge Duplicate Items</Text>
      <Text style={styles.subtitle}>
        Merges InventoryItem documents with the SAME name + unit into ONE item,
        moving all their batches under it. Items with mismatched units (e.g. a
        "beer" batch that ended up on a "pac"-unit item) are SKIPPED and left
        for manual review via the Move Batch feature.
      </Text>
      <TouchableOpacity
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={handleRun}
        disabled={running}
      >
        {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Run Merge Now</Text>}
      </TouchableOpacity>

      <ScrollView style={styles.logBox}>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>{line}</Text>
        ))}
      </ScrollView>

      <Text style={styles.warning}>
        Delete this file (app/dev-merge-duplicate-items.tsx) after confirming success.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: "#0a0a0a" },
  title: { fontSize: 20, fontWeight: "900", color: "#FFD700", marginBottom: 12 },
  subtitle: { fontSize: 13, color: "#ccc", marginBottom: 20, lineHeight: 19 },
  button: {
    backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 10, alignItems: "center",
  },
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