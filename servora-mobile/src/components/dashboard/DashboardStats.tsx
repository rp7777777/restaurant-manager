// ============================================
// SERVORA ERP — DashboardStats
// ✅ 6 KPI stat cards
// ✅ Labour Cost % — color threshold
// ✅ Staff Present card
// ✅ Theme compatible
// ✅ React.memo
// ✅ TypeScript typed props
// ✅ useWindowDimensions — orientation safe
// ✅ today — direct calculation, no midnight bug
// ✅ t() — i18n compatible
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, StyleSheet,
  Platform, useWindowDimensions,
} from "react-native";
import { LinearGradient }              from "expo-linear-gradient";
import { MaterialIcons }               from "@expo/vector-icons";
import { useApp }                      from "../../context/AppContext";
import { DashboardStats as StatsType } from "../../services/dashboard-service";
import { AttendanceSummary }           from "../../types/dashboard";
import { LABOUR_COST_THRESHOLDS }      from "../../constants/dashboard";

const isWeb = Platform.OS === "web";

// ── Props ─────────────────────────────────────
interface DashboardStatsProps {
  stats:      StatsType;
  attendance: AttendanceSummary;
}

// ── Stat Card ─────────────────────────────────
interface StatCardProps {
  title:          string;
  value:          string;
  icon:           keyof typeof MaterialIcons.glyphMap;
  gradientColors: readonly [string, string];
  sub?:           string;
  change?:        string;
  cardWidth:      number;
}

const StatCard = memo(function StatCard({
  title, value, icon, gradientColors, sub, change, cardWidth,
}: StatCardProps) {
  return (
    <LinearGradient
      colors={gradientColors}
      style={[styles.card, { minWidth: cardWidth }]}
    >
      <View style={styles.cardTop}>
        <MaterialIcons name={icon} size={24} color="rgba(255,255,255,0.9)" />
        {change && (
          <View style={styles.badge}>
            <MaterialIcons name="trending-up" size={10} color="#fff" />
            <Text style={styles.badgeText}>{change}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {sub && <Text style={styles.cardSub}>{sub}</Text>}
    </LinearGradient>
  );
});

// ── Labour cost gradient ──────────────────────
function labourGradient(
  pct: number
): readonly [string, string] {
  if (pct > LABOUR_COST_THRESHOLDS.HIGH)   return ["#9f1239", "#e11d48"];
  if (pct > LABOUR_COST_THRESHOLDS.MEDIUM) return ["#b45309", "#d97706"];
  return ["#065f46", "#059669"];
}

// ── Main Component ────────────────────────────
function DashboardStats({ stats, attendance }: DashboardStatsProps) {
  // ✅ t() — i18n compatible
  const { fmt, t } = useApp();

  // ✅ Direct calculation — no midnight bug
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "short",
  });

  // ✅ useWindowDimensions — orientation safe
  const { width }  = useWindowDimensions();
  const cardWidth  = isWeb ? 160 : (width - 52) / 2;
  const profitable = stats.netProfit >= 0;

  return (
    <View style={styles.row}>
      <StatCard
        title={t("totalSales")}
        value={fmt(stats.totalSales)}
        icon="point-of-sale"
        gradientColors={["#059669", "#10b981"]}
        change={t("thisYear")}
        cardWidth={cardWidth}
      />
      <StatCard
        title={t("totalExpenses")}
        value={fmt(stats.totalExpenses)}
        icon="receipt"
        gradientColors={["#dc2626", "#ef4444"]}
        cardWidth={cardWidth}
      />
      <StatCard
        title={t("netProfit")}
        value={fmt(stats.netProfit)}
        icon="trending-up"
        gradientColors={
          profitable
            ? ["#0369a1", "#0ea5e9"]
            : ["#9f1239", "#e11d48"]
        }
        cardWidth={cardWidth}
      />
      <StatCard
        title={t("todaySales")}
        value={fmt(stats.todaySales)}
        icon="today"
        gradientColors={["#d97706", "#f59e0b"]}
        sub={today}
        cardWidth={cardWidth}
      />
      <StatCard
        title={t("labourCostPct")}
        value={
          stats.labourCostPct > 0
            ? `${stats.labourCostPct.toFixed(1)}%`
            : "N/A"
        }
        icon="payments"
        gradientColors={labourGradient(stats.labourCostPct)}
        sub={t("ofTotalSales")}
        cardWidth={cardWidth}
      />
      <StatCard
        title={t("staffPresent")}
        value={`${attendance.present} / ${attendance.total}`}
        icon="people"
        gradientColors={["#1d4ed8", "#3b82f6"]}
        sub={
          attendance.absent > 0
            ? `${attendance.absent} ${t("absent")}`
            : t("allPresent")
        }
        cardWidth={cardWidth}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           10,
    marginBottom:  14,
  },
  card: {
    flex:         1,
    borderRadius: 16,
    padding:      14,
    gap:           4,
  },
  cardTop: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  badge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               2,
    backgroundColor:   "rgba(255,255,255,0.2)",
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      8,
  },
  badgeText: { color: "#fff", fontSize: 9,  fontWeight: "600" },
  cardTitle: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600", marginTop: 6 },
  cardValue: { color: "#fff", fontSize: isWeb ? 20 : 16, fontWeight: "900" },
  cardSub:   { color: "rgba(255,255,255,0.6)", fontSize: 10 },
});

export default memo(DashboardStats);