// ============================================
// SERVORA ERP — DashboardStats
// ✅ Multi-row KPI cards — Today/Month/Year breakdown
// ✅ calcTrend() — current=0 shows a card-specific "zero" label
//    ("No Sales" for Sales, "No Expense" for Expenses) instead of a
//    generic "NO DATA" or a confusing "↓100%"
// ✅ Staff card — progress bar color now dynamic by percentage
//    (red <40%, amber 40-70%, green 70%+) instead of always green
// ✅ Labour Cost sub-text now via t("availableAfterPayroll")
// ✅ Year row clickable (structure stays open for a future
//    "vs Last Year" diff once 2025+ comparison data exists — just
//    swap { type: "new" } for a real calcAbsDiff() call then)
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
  onProfitYearPress?:  () => void;
}

// ── % Trend calculation (Sales/Expenses) ──────
type TrendType = "up" | "down" | "flat" | "new" | "zero" | "none";

interface Trend {
  type: TrendType;
  pct?: number;
}

function calcTrend(current: number, previous: number): Trend {
  if (current === 0 && previous === 0) return { type: "none" };
  if (current === 0) return { type: "zero" };
  if (previous === 0) return { type: "new" };
  const diff = current - previous;
  if (diff === 0) return { type: "flat" };
  const pct = Math.abs((diff / Math.abs(previous)) * 100);
  return { type: diff > 0 ? "up" : "down", pct };
}

// ── ✅ zeroLabel is now card-specific ("No Sales" / "No Expense"),
//    not a generic "NO DATA" ──
const TrendBadge = memo(function TrendBadge({
  trend, invert, zeroLabel,
}: { trend: Trend; invert?: boolean; zeroLabel: string }) {
  if (trend.type === "none") return null;

  if (trend.type === "zero") {
    return (
      <View style={[styles.trendBadge, styles.trendBadgeNeutral]}>
        <Text style={styles.trendBadgeText}>{zeroLabel.toUpperCase()}</Text>
      </View>
    );
  }
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

// ── € Absolute Diff calculation (Net Profit only) ──
type DiffType = "up" | "down" | "flat" | "new" | "none";

interface AbsDiff {
  type: DiffType;
  amount?: number;
}

function calcAbsDiff(current: number, previous: number, hasBaseline: boolean): AbsDiff {
  if (!hasBaseline) return { type: "new" };
  const diff = current - previous;
  if (diff === 0) return { type: "flat" };
  return { type: diff > 0 ? "up" : "down", amount: Math.abs(diff) };
}

const DiffBadge = memo(function DiffBadge({
  diff, label, fmt,
}: { diff: AbsDiff; label: string; fmt: (n: number) => string }) {
  if (diff.type === "none") return null;

  if (diff.type === "new") {
    return (
      <View style={[styles.diffBadge, styles.trendBadgeNeutral]}>
        <Text style={styles.trendBadgeText}>NEW</Text>
      </View>
    );
  }
  if (diff.type === "flat") {
    return (
      <View style={[styles.diffBadge, styles.trendBadgeNeutral]}>
        <Text style={styles.diffBadgeText}>No change {label}</Text>
      </View>
    );
  }

  const isGood = diff.type === "up";
  const arrow  = diff.type === "up" ? "▲" : "▼";

  return (
    <View
      style={[
        styles.diffBadge,
        isGood ? styles.trendBadgeGood : styles.trendBadgeBad,
      ]}
    >
      <Text style={styles.diffBadgeText}>
        {arrow} {fmt(diff.amount!)} {label}
      </Text>
    </View>
  );
});

// ── Multi-Row Stat Card — Today/Month/Year breakdown ──
interface StatCardRow {
  label:        string;
  value:        string;
  isNegative?:  boolean;
  trend?:       Trend;
  diff?:        AbsDiff;
  diffLabel?:   string;
  emphasized?:  boolean;
  onPress?:     () => void;
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
  zeroLabel:      string;
  onPress?:       () => void;
  fmt:            (n: number) => string;
}

const MultiRowStatCard = memo(function MultiRowStatCard({
  title, icon, gradientColors, rows, footerLabel, footerValue,
  cardWidth, invertTrend, zeroLabel, onPress, fmt,
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
                  (row.diff && row.diff.type !== "none") && styles.statRowBoxTall,
                ]}
              >
                <View style={styles.rowTopLine}>
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
                      <TrendBadge trend={row.trend} invert={invertTrend} zeroLabel={zeroLabel} />
                    )}
                    {row.onPress && (
                      <MaterialIcons
                        name="chevron-right"
                        size={14}
                        color="rgba(255,255,255,0.5)"
                      />
                    )}
                  </View>
                </View>
                {row.diff && (
                  <View style={styles.diffRow}>
                    <DiffBadge diff={row.diff} label={row.diffLabel ?? ""} fmt={fmt} />
                  </View>
                )}
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

// ── Staff Card — Present/Absent/Late breakdown + % + dynamic
//    progress bar color (red <40%, amber 40-70%, green 70%+) ──
interface StaffCardProps {
  attendance: AttendanceSummary;
  cardWidth:  number;
  onPress?:   () => void;
  t:          (key: any) => string;
}

function progressColor(pct: number): string {
  if (pct < 40) return "#f87171";
  if (pct < 70) return "#fbbf24";
  return "#4ade80";
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

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%`, backgroundColor: progressColor(pct) },
            ]}
          />
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
  stats, attendance, onProfitTodayPress, onProfitMonthPress, onProfitYearPress,
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

  const hasYesterdayBaseline = stats.yesterdaySales > 0 || stats.yesterdayExpenses > 0;
  const hasLastMonthBaseline = stats.lastMonthSales > 0 || stats.lastMonthExpenses > 0;

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
        fmt={fmt}
        zeroLabel={t("noSales")}
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
        fmt={fmt}
        invertTrend
        zeroLabel={t("noExpenseData")}
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
        fmt={fmt}
        zeroLabel={t("noSales")}
        rows={[
          {
            label: t("today"), value: fmt(todayProfit),
            isNegative: todayProfit < 0, emphasized: true,
            diff: calcAbsDiff(todayProfit, yesterdayProfit, hasYesterdayBaseline),
            diffLabel: "vs Yesterday",
            onPress: onProfitTodayPress,
          },
          {
            label: t("month"), value: fmt(monthProfit),
            isNegative: monthProfit < 0,
            diff: calcAbsDiff(monthProfit, lastMonthProfit, hasLastMonthBaseline),
            diffLabel: "vs Last Month",
            onPress: onProfitMonthPress,
          },
          {
            // ✅ Structure stays open — swap for a real calcAbsDiff()
            //    once a "last year" comparison actually exists
            //    (currently always "new" since there's no 2025 data).
            label: t("year"), value: fmt(yearProfit),
            isNegative: yearProfit < 0,
            diff: { type: "new" },
            onPress: onProfitYearPress,
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
        sub={t("availableAfterPayroll")}
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
    backgroundColor:   "rgba(0,0,0,0.12)",
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   6,
  },
  statRowBoxEmphasized: {
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  statRowBoxTall: {
    paddingBottom: 8,
  },
  rowTopLine: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
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

  diffRow:   { marginTop: 4 },
  diffBadge: {
    alignSelf:         "flex-start",
    borderRadius:      6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  diffBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  progressTrack: {
    height:           6,
    borderRadius:     3,
    backgroundColor:  "rgba(0,0,0,0.25)",
    marginTop:        6,
    overflow:         "hidden",
  },
  progressFill: {
    height:          "100%",
    borderRadius:    3,
  },

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