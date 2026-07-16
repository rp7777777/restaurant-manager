// ============================================
// SERVORA ERP — DashboardStats
// ✅ Multi-row KPI cards — Today/Month/Year breakdown
//    for Sales, Expenses, Net Profit
// ✅ Net Profit computed client-side per period
//    (todaySales-todayExpenses, etc.) — no backend change needed
// ✅ Clickable cards — navigate to relevant detail screens
// ✅ Staff card — Present/Absent/Late breakdown
// ✅ Labour Cost % — deferred (still N/A placeholder),
//    pending Payroll module audit for real cost calculation
// ✅ Theme compatible
// ✅ React.memo
// ✅ TypeScript typed props
// ✅ useWindowDimensions — orientation safe
// ✅ t() — i18n compatible (today/year/late keys added to en.ts,
//    other languages fall back to English automatically until
//    translated)
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, StyleSheet,
  Platform, useWindowDimensions, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
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

// ── Multi-Row Stat Card — Today/Month/Year breakdown ──
interface MultiRowStatCardProps {
  title:          string;
  icon:           keyof typeof MaterialIcons.glyphMap;
  gradientColors: readonly [string, string];
  rows:           { label: string; value: string }[];
  cardWidth:      number;
  onPress?:       () => void;
}

const MultiRowStatCard = memo(function MultiRowStatCard({
  title, icon, gradientColors, rows, cardWidth, onPress,
}: MultiRowStatCardProps) {
  const CardWrapper = onPress ? TouchableOpacity : View;
  return (
    <CardWrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[styles.cardTouchable, { minWidth: cardWidth }]}
    >
      <LinearGradient colors={gradientColors} style={styles.card}>
        <View style={styles.cardTop}>
          <MaterialIcons name={icon} size={22} color="rgba(255,255,255,0.9)" />
          <Text style={styles.cardTitle}>{title}</Text>
          {onPress && (
            <MaterialIcons
              name="chevron-right"
              size={18}
              color="rgba(255,255,255,0.6)"
              style={styles.chevron}
            />
          )}
        </View>

        <View style={styles.rowsContainer}>
          {rows.map((row) => (
            <View key={row.label} style={styles.statRow}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </CardWrapper>
  );
});

// ── Simple Single-Value Stat Card (Labour Cost, Staff) ──
interface SimpleStatCardProps {
  title:          string;
  value:          string;
  icon:           keyof typeof MaterialIcons.glyphMap;
  gradientColors: readonly [string, string];
  sub?:           string;
  cardWidth:      number;
  onPress?:       () => void;
}

const SimpleStatCard = memo(function SimpleStatCard({
  title, value, icon, gradientColors, sub, cardWidth, onPress,
}: SimpleStatCardProps) {
  const CardWrapper = onPress ? TouchableOpacity : View;
  return (
    <CardWrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[styles.cardTouchable, { minWidth: cardWidth }]}
    >
      <LinearGradient colors={gradientColors} style={styles.card}>
        <View style={styles.cardTop}>
          <MaterialIcons name={icon} size={24} color="rgba(255,255,255,0.9)" />
          {onPress && (
            <MaterialIcons
              name="chevron-right"
              size={18}
              color="rgba(255,255,255,0.6)"
            />
          )}
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        {sub && <Text style={styles.cardSub}>{sub}</Text>}
      </LinearGradient>
    </CardWrapper>
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
  const { fmt, t } = useApp();
  const router = useRouter();

  const { width }  = useWindowDimensions();
  const cardWidth  = isWeb ? 210 : (width - 52) / 2;

  // ── Net Profit computed per period (no backend field for this —
  //    derived client-side from the already-available today/month/
  //    year sales & expenses). ──
  const todayProfit = stats.todaySales - stats.todayExpenses;
  const monthProfit = stats.monthSales - stats.monthExpenses;
  const yearProfit  = stats.yearSales  - stats.yearExpenses;

  return (
    <View style={styles.row}>
      <MultiRowStatCard
        title={t("sales")}
        icon="point-of-sale"
        gradientColors={["#059669", "#10b981"]}
        cardWidth={cardWidth}
        onPress={() => router.push("/sales-list" as any)}
        rows={[
          { label: t("today"), value: fmt(stats.todaySales) },
          { label: t("month"), value: fmt(stats.monthSales) },
          { label: t("year"),  value: fmt(stats.yearSales)  },
        ]}
      />

      <MultiRowStatCard
        title={t("expenses")}
        icon="receipt"
        gradientColors={["#dc2626", "#ef4444"]}
        cardWidth={cardWidth}
        onPress={() => router.push("/expense-history" as any)}
        rows={[
          { label: t("today"), value: fmt(stats.todayExpenses) },
          { label: t("month"), value: fmt(stats.monthExpenses) },
          { label: t("year"),  value: fmt(stats.yearExpenses)  },
        ]}
      />

      <MultiRowStatCard
        title={t("netProfit")}
        icon="trending-up"
        gradientColors={
          yearProfit >= 0
            ? ["#0369a1", "#0ea5e9"]
            : ["#9f1239", "#e11d48"]
        }
        cardWidth={cardWidth}
        onPress={() => router.push("/profit-loss" as any)}
        rows={[
          { label: t("today"), value: fmt(todayProfit) },
          { label: t("month"), value: fmt(monthProfit) },
          { label: t("year"),  value: fmt(yearProfit)  },
        ]}
      />

      <SimpleStatCard
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

      <SimpleStatCard
        title={t("staffPresent")}
        value={`${attendance.present} / ${attendance.total}`}
        icon="people"
        gradientColors={["#1d4ed8", "#3b82f6"]}
        sub={
          attendance.absent > 0 || attendance.late > 0
            ? [
                attendance.absent > 0 ? `${attendance.absent} ${t("absent")}` : null,
                attendance.late   > 0 ? `${attendance.late} ${t("late")}`     : null,
              ].filter(Boolean).join(" · ")
            : t("allPresent")
        }
        cardWidth={cardWidth}
        onPress={() => router.push("/attendance-module" as any)}
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
  cardTouchable: { flex: 1 },
  card: {
    borderRadius: 16,
    padding:      14,
    gap:          6,
  },
  cardTop: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
  },
  chevron: { marginLeft: "auto" },
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
  cardTitle: {
    color: "rgba(255,255,255,0.85)", fontSize: 11,
    fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5,
  },
  cardValue: { color: "#fff", fontSize: isWeb ? 20 : 16, fontWeight: "900" },
  cardSub:   { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  rowsContainer: { gap: 4, marginTop: 2 },
  statRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  rowLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  rowValue: { color: "#fff", fontSize: 13, fontWeight: "800" },
});

export default memo(DashboardStats);