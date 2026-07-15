// ============================================
// SERVORA ERP — DEV-ONLY: One-time Dashboard Stats Repair
// ⚠️ TEMPORARY FILE — not linked from any navigation/sidebar.
// Access directly via URL: /dev-recompute-stats
// DELETE THIS FILE after running the repair once successfully.
// ============================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useApp } from "../context/AppContext";
import { recomputeDashboardStatsFromSource } from "../services/dashboard-service";

export default function DevRecomputeStatsScreen() {
  const { restaurantId } = useApp();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRun = async () => {
    if (!restaurantId || running) return;
    setRunning(true);
    setResult(null);
    try {
      await recomputeDashboardStatsFromSource(restaurantId);
      setResult("✅ Success — Dashboard stats recomputed from actual Sales/Expenses records.");
    } catch (err: any) {
      setResult(`❌ Failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>⚠️ Developer Tool</Text>
      <Text style={styles.subtitle}>
        Recomputes Dashboard stats (totalSales, totalExpenses, today/month
        breakdowns) directly from the actual Sales and Expenses collections.
        This will overwrite the current (possibly corrupted) stats document.
      </Text>

      <TouchableOpacity
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={handleRun}
        disabled={running}
      >
        {running ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Run Recompute Now</Text>
        )}
      </TouchableOpacity>

      {result && <Text style={styles.result}>{result}</Text>}

      <Text style={styles.warning}>
        Delete this file (app/dev-recompute-stats.tsx) after confirming success.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0a0a0a" },
  title: { fontSize: 22, fontWeight: "900", color: "#FFD700", marginBottom: 12 },
  subtitle: { fontSize: 14, color: "#ccc", marginBottom: 24, lineHeight: 20 },
  button: {
    backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 10, alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  result: { marginTop: 20, fontSize: 14, color: "#fff", fontWeight: "600" },
  warning: { marginTop: 32, fontSize: 12, color: "#f59e0b" },
});