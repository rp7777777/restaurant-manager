// ============================================
// SERVORA ERP — LabourCostKPICards Component
// ✅ Pure presentation component
// ✅ theme prop — no AppContext dependency
// ✅ KPI_MAP — module scope, no recreate
// ✅ theme.primary/success/error deps only
// ✅ removeClippedSubviews removed — 6 cards only
// ✅ LABOUR_COST_KPIS — single source of truth
// ✅ useMemo — stable array
// ✅ memo export
// ✅ Accessibility — screen reader support
// FROZEN
// ============================================

import React, { memo, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LabourCostSummary, LabourCostThresholds } from "../types/labour-cost-types";
import { DEFAULT_LABOUR_COST_THRESHOLDS } from "../constants/labour-cost-config";
import { LABOUR_COST_KPIS } from "../constants/labour-cost-kpis";
import {
  formatLabourCost,
  formatPercent,
  formatLabourHours,
  formatSalesPerHour,
  getLabourCostColor,
  getAttendanceColor,
} from "../utils/labour-cost-format";

// ✅ Fix #1 — module scope — created once, never recreated
const KPI_MAP = Object.fromEntries(
  LABOUR_COST_KPIS.map((k) => [k.key, k])
);

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
  success?:      string;
  warning?:      string;
  error?:        string;
}

interface Props {
  summary:         LabourCostSummary;
  theme:           Theme;
  currencySymbol?: string;
  locale?:         string;
  thresholds?:     LabourCostThresholds;
}

interface KPICardData {
  label: string;
  value: string;
  icon:  keyof typeof MaterialIcons.glyphMap;
  color: string;
  sub?:  string;
}

// ── KPI Card ──────────────────────────────────
const KPICard = memo(function KPICard({
  label, value, icon, color, sub, theme,
}: KPICardData & { theme: Theme }) {
  return (
    <View
      style={[styles.card, {
        backgroundColor: theme.surface,
        borderColor:     theme.border,
      }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ""}`}
    >
      <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.cardValue, { color }]}>
        {value}
      </Text>
      <Text
        style={[styles.cardLabel, { color: theme.textSecondary }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {sub && (
        <Text
          style={[styles.cardSub, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      )}
    </View>
  );
});

// ── LabourCostKPICards ────────────────────────
function LabourCostKPICardsComponent({
  summary,
  theme,
  currencySymbol = "€",
  locale         = "en",
  thresholds     = DEFAULT_LABOUR_COST_THRESHOLDS,
}: Props) {

  const successColor = theme.success ?? "#10b981";
  const errorColor   = theme.error   ?? "#ef4444";

  // ✅ Fix #2 — specific theme fields as deps — not whole theme object
  const cards = useMemo((): KPICardData[] => {

    const labourPctColor  = getLabourCostColor(
      summary.labourCostPercent, thresholds
    );
    const attendanceColor = getAttendanceColor(
      summary.attendanceRate, thresholds
    );
    const overtimeColor = summary.totalOvertimeHours > thresholds.overtimeWarning
      ? errorColor
      : successColor;

    return [
      {
        label: KPI_MAP.totalLabourCost.label,
        value: formatLabourCost(summary.totalLabourCost, currencySymbol, locale),
        icon:  KPI_MAP.totalLabourCost.icon as keyof typeof MaterialIcons.glyphMap,
        color: theme.primary,
        sub:   `Basic: ${formatLabourCost(summary.basicLabourCost, currencySymbol, locale)}`,
      },
      {
        label: KPI_MAP.labourCostPercent.label,
        value: formatPercent(summary.labourCostPercent),
        icon:  KPI_MAP.labourCostPercent.icon as keyof typeof MaterialIcons.glyphMap,
        color: labourPctColor,
        sub:   summary.totalSales > 0
          ? `Sales: ${formatLabourCost(summary.totalSales, currencySymbol, locale)}`
          : "No sales data",
      },
      {
        label: KPI_MAP.totalWorkedHours.label,
        value: formatLabourHours(summary.totalWorkedHours),
        icon:  KPI_MAP.totalWorkedHours.icon as keyof typeof MaterialIcons.glyphMap,
        color: theme.primary,
        sub:   `Sched: ${formatLabourHours(summary.totalScheduledHours)}`,
      },
      {
        label: KPI_MAP.totalOvertimeHours.label,
        value: formatLabourHours(summary.totalOvertimeHours),
        icon:  KPI_MAP.totalOvertimeHours.icon as keyof typeof MaterialIcons.glyphMap,
        color: overtimeColor,
        sub:   formatLabourCost(summary.overtimeCost, currencySymbol, locale),
      },
      {
        label: KPI_MAP.salesPerLabourHour.label,
        value: formatSalesPerHour(
          summary.salesPerLabourHour, currencySymbol, locale
        ),
        icon:  KPI_MAP.salesPerLabourHour.icon as keyof typeof MaterialIcons.glyphMap,
        color: theme.primary,
      },
      {
        label: KPI_MAP.attendanceRate.label,
        value: formatPercent(summary.attendanceRate),
        icon:  KPI_MAP.attendanceRate.icon as keyof typeof MaterialIcons.glyphMap,
        color: attendanceColor,
        sub:   `${summary.presentEmployees}/${summary.totalEmployees} present`,
      },
    ];
  }, [
    summary,
    currencySymbol,
    locale,
    thresholds,
    // ✅ Fix #2 — specific fields only
    theme.primary,
    successColor,
    errorColor,
  ]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // ✅ Fix #3 — removed — 6 cards, no perf benefit
    >
      {cards.map((card) => (
        <KPICard key={card.label} {...card} theme={theme} />
      ))}
    </ScrollView>
  );
}

// ✅ memo export
export const LabourCostKPICards = memo(LabourCostKPICardsComponent);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    paddingVertical:   12,
    gap:               10,
  },
  card: {
    minWidth:     140,
    maxWidth:     170,
    padding:      12,
    borderRadius: 12,
    borderWidth:  1,
    gap:          6,
  },
  iconBox: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   2,
  },
  cardValue: {
    fontSize:   16,
    fontWeight: "800",
  },
  cardLabel: {
    fontSize:   11,
    fontWeight: "600",
  },
  cardSub: {
    fontSize: 10,
  },
});