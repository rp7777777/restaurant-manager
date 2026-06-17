// ============================================
// SERVORA ERP — PayrollHeader Component
// ✅ Title + Generate button
// ✅ Manager only generate
// ✅ Loading state
// ============================================

import React from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface Props {
  isManager: boolean;
  generating: boolean;
  onGenerate: () => void;
}

export function PayrollHeader({ isManager, generating, onGenerate }: Props) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>PAYROLL</Text>
        <Text style={styles.subtitle}>Monthly Salary Management</Text>
      </View>

      {isManager && (
        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.7 }]}
          onPress={onGenerate}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator size="small" color="#00154f" />
            : <MaterialIcons name="payments" size={14} color="#00154f" />
          }
          <Text style={styles.generateBtnText}>
            {generating ? "Generating..." : "Generate"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   10,
  },
  title: {
    color:      "#FFD700",
    fontSize:   22,
    fontWeight: "800",
  },
  subtitle: {
    color:     "rgba(255,255,255,0.65)",
    fontSize:  11,
    marginTop: 2,
  },
  generateBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical:    7,
    borderRadius:    8,
  },
  generateBtnText: {
    color:      "#00154f",
    fontSize:   12,
    fontWeight: "800",
  },
});