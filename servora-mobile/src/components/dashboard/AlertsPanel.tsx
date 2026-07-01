// ============================================
// SERVORA ERP — AlertsPanel
// ✅ Today's alerts display
// ✅ t() — i18n compatible
// ✅ onAlertPress — callback prop, no hardcoded navigation
// ✅ accessibilityRole — conditional
// ✅ Theme compatible
// ✅ React.memo
// ✅ 100% presentation component
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
} from "react-native";
import { MaterialIcons }  from "@expo/vector-icons";
import { useApp }         from "../../context/AppContext";
import { DashboardAlert } from "../../services/dashboard-service";

// ── Props ─────────────────────────────────────
interface AlertsPanelProps {
  alerts:        DashboardAlert[];
  // ✅ callback prop — parent handles navigation
  onAlertPress?: (alert: DashboardAlert) => void;
}

// ── Alert Card ────────────────────────────────
interface AlertCardProps {
  alert:        DashboardAlert;
  onAlertPress?: (alert: DashboardAlert) => void;
}

const AlertCard = memo(function AlertCard({
  alert, onAlertPress,
}: AlertCardProps) {
  const { theme } = useApp();

  return (
    <TouchableOpacity
      onPress={() => onAlertPress?.(alert)}
      activeOpacity={alert.route ? 0.7 : 1}
      style={[styles.card, {
        backgroundColor: `${alert.color}12`,
        borderColor:     `${alert.color}30`,
      }]}
      accessibilityLabel={alert.message}
      accessibilityRole={alert.route ? "button" : "text"}
    >
      <View style={[styles.iconBox, { backgroundColor: `${alert.color}20` }]}>
        <MaterialIcons
          name={alert.icon as keyof typeof MaterialIcons.glyphMap}
          size={18}
          color={alert.color}
        />
      </View>
      <View style={styles.content}>
        <Text style={[styles.message, { color: theme.text }]}>
          {alert.message}
        </Text>
        {alert.subtext && (
          <Text style={[styles.subtext, { color: theme.textSecondary }]}>
            {alert.subtext}
          </Text>
        )}
      </View>
      {alert.time && (
        <Text style={[styles.time, { color: theme.textSecondary }]}>
          {alert.time}
        </Text>
      )}
      {alert.route && (
        <MaterialIcons
          name="chevron-right"
          size={16}
          color={theme.textSecondary}
        />
      )}
    </TouchableOpacity>
  );
});

// ── Main Component ────────────────────────────
function AlertsPanel({ alerts, onAlertPress }: AlertsPanelProps) {
  const { theme, t } = useApp();

  if (alerts.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          ⚠️ {t("todaysAlerts")}
        </Text>
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <Text style={styles.badgeText}>{alerts.length}</Text>
        </View>
      </View>

      {/* ── Alert Cards ── */}
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onAlertPress={onAlertPress}
        />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding:      14,
    marginBottom: 14,
  },
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   10,
  },
  title: {
    fontSize:   14,
    fontWeight: "800",
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      10,
  },
  badgeText: {
    color:      "#fff",
    fontSize:   10,
    fontWeight: "800",
  },
  card: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    padding:       12,
    borderRadius:  10,
    borderWidth:    1,
    marginBottom:   8,
  },
  iconBox: {
    width:          34,
    height:         34,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  content:  { flex: 1, gap: 2 },
  message:  { fontSize: 12, fontWeight: "700" },
  subtext:  { fontSize: 10 },
  time:     { fontSize: 10 },
});

export default memo(AlertsPanel);