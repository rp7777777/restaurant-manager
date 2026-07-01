// ============================================
// SERVORA ERP — ActivityPanel
// ✅ Recent activities display
// ✅ t() — i18n compatible
// ✅ onViewAll — callback prop, no hardcoded navigation
// ✅ Theme compatible
// ✅ React.memo
// ✅ 100% presentation component
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp }        from "../../context/AppContext";
import { ActivityLog }   from "../../services/dashboard-service";

// ── Props ─────────────────────────────────────
interface ActivityPanelProps {
  activities: ActivityLog[];
  // ✅ Fix — callback prop, no hardcoded navigation
  onViewAll:  () => void;
}

// ── Activity Row ──────────────────────────────
interface ActivityRowProps {
  activity: ActivityLog;
  fmt:      (n: number) => string;
}

const ActivityRow = memo(function ActivityRow({
  activity, fmt,
}: ActivityRowProps) {
  const { theme } = useApp();

  const timeStr = activity.timestamp.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <View
      style={[styles.row, { borderBottomColor: theme.border }]}
      accessible
      accessibilityLabel={`${activity.title}, ${activity.subtitle}`}
    >
      <View style={[styles.iconBox, { backgroundColor: `${activity.color}20` }]}>
        <MaterialIcons
          name={activity.icon as keyof typeof MaterialIcons.glyphMap}
          size={14}
          color={activity.color}
        />
      </View>
      <View style={styles.content}>
        <Text
          style={[styles.title, { color: theme.text }]}
          numberOfLines={1}
        >
          {activity.title}
        </Text>
        <Text
          style={[styles.subtitle, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {activity.subtitle}
        </Text>
      </View>
      {activity.amount !== undefined && activity.amount > 0 && (
        <Text style={[styles.amount, { color: activity.color }]}>
          {fmt(activity.amount)}
        </Text>
      )}
      <Text style={[styles.time, { color: theme.textSecondary }]}>
        {timeStr}
      </Text>
    </View>
  );
});

// ── Main Component ────────────────────────────
function ActivityPanel({ activities, onViewAll }: ActivityPanelProps) {
  const { theme, fmt, t } = useApp();

  if (activities.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t("recentActivities")}
        </Text>
        <TouchableOpacity
          onPress={onViewAll}
          accessibilityRole="button"
          accessibilityLabel={t("viewAll")}
        >
          <Text style={[styles.viewAll, { color: theme.primary }]}>
            {t("viewAll")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Activity Rows ── */}
      {activities.map((activity) => (
        <ActivityRow key={activity.id} activity={activity} fmt={fmt} />
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
  headerTitle: {
    fontSize:   14,
    fontWeight: "800",
  },
  viewAll: {
    fontSize:   12,
    fontWeight: "700",
  },
  row: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    paddingVertical:   10,
    borderBottomWidth: 0.5,
  },
  iconBox: {
    width:          30,
    height:         30,
    borderRadius:   8,
    alignItems:     "center",
    justifyContent: "center",
  },
  content:  { flex: 1, gap: 2 },
  title:    { fontSize: 12, fontWeight: "600" },
  subtitle: { fontSize: 10 },
  amount:   { fontSize: 12, fontWeight: "800" },
  time:     { fontSize: 10 },
});

export default memo(ActivityPanel);