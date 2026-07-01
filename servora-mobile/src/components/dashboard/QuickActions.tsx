// ============================================
// SERVORA ERP — QuickActions
// ✅ Quick action buttons — web only
// ✅ labelKey — i18n compatible
// ✅ route: string — Expo Router compatible
// ✅ Callback props — no hardcoded navigation
// ✅ Theme compatible
// ✅ React.memo
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp }        from "../../context/AppContext";
import { QUICK_ACTIONS } from "../../constants/dashboard";

// ── Props ─────────────────────────────────────
interface QuickActionsProps {
  onAction: (route: string) => void;
}

// ── Component ─────────────────────────────────
function QuickActions({ onAction }: QuickActionsProps) {
  const { theme, t } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        {t("quickActions")}
      </Text>
      {QUICK_ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.route}
          style={[styles.btn, { backgroundColor: action.color }]}
          onPress={() => onAction(action.route)}
          accessibilityRole="button"
          accessibilityLabel={t(action.labelKey)}
        >
          <MaterialIcons name={action.icon} size={16} color="#fff" />
          <Text style={styles.btnText}>
            {t(action.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:         1,
    borderRadius: 14,
    padding:      14,
  },
  title: {
    fontSize:     14,
    fontWeight:   "800",
    marginBottom: 10,
  },
  btn: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    padding:       10,
    borderRadius:   8,
    marginBottom:   6,
  },
  btnText: {
    color:      "#fff",
    fontSize:   12,
    fontWeight: "700",
  },
});

export default memo(QuickActions);