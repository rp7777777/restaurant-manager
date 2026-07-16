// ============================================
// SERVORA ERP — DashboardStats
// ✅ Multi-row KPI cards — Today/Month/Year breakdown
//    for Sales, Expenses, Net Profit
// ✅ Net Profit computed client-side per period
// ✅ Trend % badges — vs yesterday/last month/last year
// ✅ Net Profit — static gradient + per-row red highlight + Margin
// ✅ Today row visually emphasized (darker box)
// ✅ Staff card redesigned — Present/Absent/Late + %
// ✅ Labour Cost % — "Coming Soon" placeholder
// ✅ Row-level onPress — Net Profit's Today/Month rows scroll to
//    (and auto-expand) the DailyDetailsPanel/MonthlySummaryTable
//    sections on the SAME dashboard page (via callbacks passed down
//    from dashboard.tsx, which owns the scroll refs). Sales/
//    Expenses cards keep their whole-card onPress navigating to
//    /sales-list and /expense-history respectively.
// ✅ Theme compatible, React.memo, TypeScript typed, responsive
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

const isWeb = Platform.OS === "web";

// ── Props ─────────────────────────────────────
interface DashboardStatsProps {
  stats:               StatsType;
  attendance:          AttendanceSummary;
  onProfitTodayPress?: () => void;
  onProfitMonthPress?: () => void;
}

// ── Trend calculation ─────────────────────────
type TrendType = "up" | "down" | "flat" | "new" | "none";

interface Trend {
  type: TrendType;
  pct?: number;
}

function calcTrend(current: number, previous: number): Trend {
  if (previous === 0 && current === 0) return { type: "none" };
  if (previous === 0) return { type: "new" };
  const diff = current - previous;
  if (diff === 0) return { type: "flat" };
  const pct = Math.abs((diff / Math.abs(previous)) * 100);
  return { type: diff > 0 ? "up" : "down", pct };
}

const TrendBadge = memo(function TrendBadge({
  trend, invert,
}: { trend: Trend; invert?: boolean }) {
  if (trend.type === "none") return null;

  if (trend.type === "new") {
    return (
      <View style={[styles.trendBadge, styles.trendBadgeNeutral]}>
        <Text style={styles.trendBadgeText}>NEW</Text>
      </View>
    );
  }
  if (trend.type === "flat") {
    return (
      <View style={[styles.trendBadge, styles.trendBadgeNeutral]}>
        <Text style={styles.trendBadgeText}>0%</Text>
      </View>
    );
  }

  const isGood = invert ? trend.type === "down" : trend.type === "up";
  const arrow  = trend.type === "up" ? "↑" : "↓";

  return (
    <View
      style={[
        styles.trendBadge,
        isGood ? styles.trendBadgeGood : styles.trendBadgeBad,
      ]}
    >
      <Text style={styles.trendBadgeText}>
        {arrow} {trend.pct!.toFixed(0)}%
      </Text>
    </View>
  );
});

// ── Multi-Row Stat Card — Today/Month/Year breakdown ──
interface StatCardRow {
  label:       string;
  value:       string;
  isNegative?: boolean;
  trend?:      Trend;
  emphasized?: boolean;
  onPress?:    () => void;
}

interface MultiRowStatCardProps {
  title:          string;
  icon:           keyof typeof MaterialIcons.glyphMap;
  gradientColors: readonly [string, string];
  rows:           StatCardRow[];
  footerLabel?:   string;
  footerValue?:   string;
  cardWidth:      number;
  invertTrend?:   boolean;
  onPress?:       () => void;
}

const MultiRowStatCard = memo(function MultiRowStatCard({
  title, icon, gradientColors, rows, footerLabel, footerValue,
  cardWidth, invertTrend, onPress,
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
          {rows.map((row) => {
            const RowWrapper = row.onPress ? TouchableOpacity : View;
            return (
              <RowWrapper
                key={row.label}
                {...(row.onPress ? { onPress: row.onPress, activeOpacity: 0.7 } : {})}
                style={[
                  styles.statRowBox,
                  row.emphasized && styles.statRowBoxEmphasized,
                ]}
              >
                <Text
                  style={[
                    styles.rowLabel,
                    row.emphasized && styles.rowLabelEmphasized,
                  ]}
                >
                  {row.label}
                </Text>
                <View style={styles.rowRight}>
                  <Text
                    style={[
                      styles.rowValue,
                      row.emphasized && styles.rowValueEmphasized,
                      row.isNegative && styles.rowValueNegative,
                    ]}
                  >
                    {row.value}
                  </Text>
                  {row.trend && (
                    <TrendBadge trend={row.trend} invert={invertTrend} />
                  )}
                  {row.onPress && (
                    <MaterialIcons
                      name="chevron-right"
                      size={14}
                      color="rgba(255,255,255,0.5)"
                    />
                  )}
                </View>
              </RowWrapper>
            );
          })}
        </View>

        {footerLabel && footerValue && (
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>{footerLabel}</Text>
            <Text style={styles.footerValue}>{footerValue}</Text>
          </View>
        )}
      </LinearGradient>
    </CardWrapper>
  );
});

// ── Staff Card — Present/Absent/Late breakdown + % ──
interface StaffCardProps {
  attendance: AttendanceSummary;
  cardWidth:  number;
  onPress?:   () => void;
  t:          (key: any) => string;
}

const StaffCard = memo(function StaffCard({
  attendance, cardWidth, onPress, t,
}: StaffCardProps) {
  const CardWrapper = onPress ? TouchableOpacity : View;
  const pct = attendance.total > 0
    ? Math.round((attendance.present / attendance.total) * 100)
    : 0;

  return (
    <CardWrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[styles.cardTouchable, { minWidth: cardWidth }]}
    >
      <LinearGradient colors={["#3730a3", "#4f46e5"]} style={styles.card}>
        <View style={styles.cardTop}>
          <MaterialIcons name="people" size={22} color="rgba(255,255,255,0.9)" />
          <Text style={styles.cardTitle}>{t("staffPresent")}</Text>
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
          <View style={[styles.statRowBox, styles.statRowBoxEmphasized]}>
            <Text style={[styles.rowLabel, styles.rowLabelEmphasized]}>
              {t("staffPresent")}
            </Text>
            <Text style={[styles.rowValue, styles.rowValueEmphasized]}>
              {attendance.present}
            </Text>
          </View>
          <View style={styles.statRowBox}>
            <Text style={styles.rowLabel}>{t("absent")}</Text>
            <Text style={styles.rowValue}>{attendance.absent}</Text>
          </View>
          <View style={styles.statRowBox}>
            <Text style={styles.rowLabel}>{t("late")}</Text>
            <Text style={styles.rowValue}>{attendance.late}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>
            {attendance.present}/{attendance.total}
          </Text>
          <Text style={styles.footerValue}>{pct}%</Text>
        </View>
      </LinearGradient>
    </CardWrapper>
  );
});

// ── Simple Single-Value Stat Card (Labour Cost) ──
interface SimpleStatCardProps {
  title:          string;
  value:          string;
  icon:           keyof typeof MaterialIcons.glyphMap;
  gradientColors: readonly [string, string];
  sub?:           string;
  cardWidth:      number;
}

const SimpleStatCard = memo(function SimpleStatCard({
  title, value, icon, gradientColors, sub, cardWidth,
}: SimpleStatCardProps) {
  return (
    <View style={[styles.cardTouchable, { minWidth: cardWidth }]}>
      <LinearGradient colors={gradientColors} style={styles.card}>
        <View style={styles.cardTop}>
          <MaterialIcons name={icon} size={24} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        {sub && <Text style={styles.cardSub}>{sub}</Text>}
      </LinearGradient>
    </View>
  );
});

// ── Main Component ────────────────────────────
function DashboardStats({
  stats, attendance, onProfitTodayPress, onProfitMonthPress,
}: DashboardStatsProps) {
  const { fmt, t } = useApp();
  const router = useRouter();

  const { width }  = useWindowDimensions();
  const cardWidth  = isWeb ? 220 : (width - 52) / 2;

  const todayProfit = stats.todaySales - stats.todayExpenses;
  const monthProfit = stats.monthSales - stats.monthExpenses;
  const yearProfit  = stats.yearSales  - stats.yearExpenses;

  const yesterdayProfit = stats.yesterdaySales - stats.yesterdayExpenses;
  const lastMonthProfit = stats.lastMonthSales - stats.lastMonthExpenses;
  const lastYearProfit  = stats.lastYearSales  - stats.lastYearExpenses;

  const yearMargin = stats.yearSales > 0
    ? Math.round((yearProfit / stats.yearSales) * 1000) / 10
    : 0;

  return (
    <View style={styles.row}>
      <MultiRowStatCard
        title={t("sales")}
        icon="point-of-sale"
        gradientColors={["#059669", "#10b981"]}
        cardWidth={cardWidth}
        onPress={() => router.push("/sales-list" as any)}
        rows={[
          {
            label: t("today"), value: fmt(stats.todaySales), emphasized: true,
            trend: calcTrend(stats.todaySales, stats.yesterdaySales),
          },
          {
            label: t("month"), value: fmt(stats.monthSales),
            trend: calcTrend(stats.monthSales, stats.lastMonthSales),
          },
          {
            label: t("year"), value: fmt(stats.yearSales),
            trend: calcTrend(stats.yearSales, stats.lastYearSales),
          },
        ]}
      />

      <MultiRowStatCard
        title={t("expenses")}
        icon="receipt"
        gradientColors={["#dc2626", "#ef4444"]}
        cardWidth={cardWidth}
        invertTrend
        onPress={() => router.push("/expense-history" as any)}
        rows={[
          {
            label: t("today"), value: fmt(stats.todayExpenses), emphasized: true,
            trend: calcTrend(stats.todayExpenses, stats.yesterdayExpenses),
          },
          {
            label: t("month"), value: fmt(stats.monthExpenses),
            trend: calcTrend(stats.monthExpenses, stats.lastMonthExpenses),
          },
          {
            label: t("year"), value: fmt(stats.yearExpenses),
            trend: calcTrend(stats.yearExpenses, stats.lastYearExpenses),
          },
        ]}
      />

      <MultiRowStatCard
        title={t("netProfit")}
        icon="trending-up"
        gradientColors={["#0369a1", "#0ea5e9"]}
        cardWidth={cardWidth}
        rows={[
          {
            label: t("today"), value: fmt(todayProfit),
            isNegative: todayProfit < 0, emphasized: true,
            trend: calcTrend(todayProfit, yesterdayProfit),
            onPress: onProfitTodayPress,
          },
          {
            label: t("month"), value: fmt(monthProfit),
            isNegative: monthProfit < 0,
            trend: calcTrend(monthProfit, lastMonthProfit),
            onPress: onProfitMonthPress,
          },
          {
            label: t("year"), value: fmt(yearProfit),
            isNegative: yearProfit < 0,
            trend: calcTrend(yearProfit, lastYearProfit),
          },
        ]}
        footerLabel="Margin"
        footerValue={`${yearMargin.toFixed(1)}%`}
      />

      <SimpleStatCard
        title={t("labourCostPct")}
        value="Coming Soon"
        icon="payments"
        gradientColors={["#6d28d9", "#8b5cf6"]}
        sub={t("ofTotalSales")}
        cardWidth={cardWidth}
      />

      <StaffCard
        attendance={attendance}
        cardWidth={cardWidth}
        onPress={() => router.push("/attendance-module" as any)}
        t={t}
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
  cardTitle: {
    color: "rgba(255,255,255,0.85)", fontSize: 11,
    fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5,
  },
  cardValue: { color: "#fff", fontSize: isWeb ? 18 : 15, fontWeight: "900" },
  cardSub:   { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  rowsContainer: { gap: 6, marginTop: 4 },

  statRowBox: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    backgroundColor:   "rgba(0,0,0,0.12)",
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   6,
  },
  statRowBoxEmphasized: {
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  rowLabel:           { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },
  rowLabelEmphasized: { color: "rgba(255,255,255,0.95)", fontWeight: "800" },
  rowRight:  { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue:           { color: "#fff", fontSize: 13, fontWeight: "800" },
  rowValueEmphasized: { fontSize: 15, fontWeight: "900" },
  rowValueNegative:   { color: "#fecaca" },

  trendBadge: {
    borderRadius:      6,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  trendBadgeGood:    { backgroundColor: "rgba(16,185,129,0.35)" },
  trendBadgeBad:     { backgroundColor: "rgba(239,68,68,0.35)" },
  trendBadgeNeutral: { backgroundColor: "rgba(255,255,255,0.2)" },
  trendBadgeText:    { color: "#fff", fontSize: 9, fontWeight: "800" },

  footerRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      6,
    paddingTop:     8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  footerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  footerValue: { color: "#fff", fontSize: 15, fontWeight: "900" },
});

export default memo(DashboardStats);