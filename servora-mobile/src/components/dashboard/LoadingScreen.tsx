// ============================================
// SERVORA ERP — LoadingScreen
// ✅ Reusable — all modules
// ✅ Fullscreen + embedded mode
// ✅ Theme compatible
// ✅ React.memo — no unnecessary re-render
// ✅ TypeScript typed props
// ✅ Embedded — always centered
// ✅ Accessibility — screen reader support
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, ActivityIndicator, StyleSheet,
} from "react-native";
import { useApp } from "../../context/AppContext";

// ── Props ─────────────────────────────────────
interface LoadingScreenProps {
  text?:       string;
  fullscreen?: boolean;
  size?:       "small" | "large";
}

// ── Component ─────────────────────────────────
function LoadingScreen({
  text       = "Loading...",
  fullscreen = true,
  size       = "large",
}: LoadingScreenProps) {
  const { theme } = useApp();

  return (
    <View
      // ✅ Accessibility — progressbar role
      accessible
      accessibilityRole="progressbar"
      style={[
        styles.container,
        fullscreen
          ? [styles.fullscreen, { backgroundColor: theme.bg }]
          : styles.embedded,
      ]}
    >
      <ActivityIndicator
        size={size}
        color={theme.primary}
        // ✅ Accessibility — screen reader label
        accessibilityLabel="Loading"
      />
      {text ? (
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
  },
  fullscreen: {
    flex: 1,
  },
  // ✅ Embedded — always centered
  embedded: {
    paddingVertical: 32,
    alignItems:      "center",
    justifyContent:  "center",
  },
  text: {
    fontSize:   14,
    fontWeight: "500",
  },
});

// ✅ React.memo
export default memo(LoadingScreen);