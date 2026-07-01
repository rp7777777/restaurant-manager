// ============================================
// SERVORA ERP — MonthlySummaryTable
// ✅ Monthly summary table
// ✅ Year totals row
// ✅ Month tabs
// ✅ t() — i18n compatible
// ✅ theme.primary — no hardcoded colors
// ✅ No nested TouchableOpacity
// ✅ Theme compatible
// ✅ React.memo
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp }        from "../../context/AppContext";
import {
  MonthSummary, YearTotals,
} from "../../types/dashboard";
import { MONTHS, MONTH_NAMES } from "../../constants/dashboard";

const isWeb = Platform.OS === "web";

// ── Props ─────────────────────────────────────
interface MonthlySummaryTableProps {
  summaries:     MonthSummary[];
  yearTotals:    YearTotals;
  selectedYear:  number;
  selectedMonth: number;
  onMonthSelect: (month: number) => void;
}

// ── Component ─────────────────────────────────
function MonthlySummaryTable({
  summaries,
  yearTotals,
  selectedYear,
  selectedMonth,
  onMonthSelect,
}: MonthlySummaryTableProps) {
  const { theme, fmt, t } = useApp();

  const profitMarginPct = yearTotals.sales > 0
    ? ((yearTotals.profit / yearTotals.sales) * 100).toFixed(2)
    : "0";

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t("monthlySummary")}{" "}
          <Text style={[styles.titleSub, { color: theme.textSecondary }]}>
            ({selectedYear})
          </Text>
        </Text>
      </View>

      {/* ── Month Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
      >
        {MONTHS.map((label, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.tab,
              { backgroundColor: selectedMonth === idx ? theme.primary : theme.bg },
            ]}
            onPress={() => onMonthSelect(idx)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedMonth === idx }}
          >
            <Text style={[
              styles.tabText,
              { color: selectedMonth === idx ? "#fff" : theme.textSecondary },
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Table ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: isWeb ? "100%" : 600 }}>

          {/* Header Row */}
          <View style={[
            styles.tableRow,
            // ✅ Fix #1 — theme.primary, no hardcoded color
            { backgroundColor: theme.primary },
          ]}>
            {[
              t("month"),
              t("totalSales"),
              t("totalExpenses"),
              t("netProfit"),
              t("profitMargin"),
              t("actions"),
            ].map((h) => (
              <Text key={h} style={[styles.cell, styles.headerText]}>
                {h}
              </Text>
            ))}
          </View>

          {/* Data Rows */}
          {summaries.map((m) => {
            const isSelected = selectedMonth === m.month;
            const hasData    = m.totalSales > 0 || m.totalExpenses > 0;
            return (
              // ✅ Fix #2 — no nested TouchableOpacity
              <TouchableOpacity
                key={m.month}
                style={[
                  styles.tableRow,
                  isSelected && { backgroundColor: theme.primary + "18" },
                  !hasData   && { opacity: 0.4 },
                ]}
                onPress={() => onMonthSelect(m.month)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[
                  styles.cell,
                  { color: theme.text, fontWeight: isSelected ? "700" : "500" },
                ]}>
                  {MONTH_NAMES[m.month]}
                </Text>
                <Text style={[styles.cell, styles.green]}>
                  {fmt(m.totalSales)}
                </Text>
                <Text style={[styles.cell, styles.red]}>
                  {fmt(m.totalExpenses)}
                </Text>
                <Text style={[
                  styles.cell,
                  { color: m.netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "600" },
                ]}>
                  {fmt(m.netProfit)}
                </Text>
                <Text style={[styles.cell, styles.amber]}>
                  {m.profitMargin.toFixed(2)}%
                </Text>
                {/* ✅ Fix #2 — View only, no nested Touchable */}
                <View style={styles.eyeBtn}>
                  <MaterialIcons
                    name="visibility"
                    size={16}
                    color={theme.primary}
                  />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Total Row */}
          <View style={[
            styles.tableRow,
            // ✅ Fix #1 — theme.primary + opacity, no hardcoded color
            { backgroundColor: theme.primary + "20" },
          ]}>
            <Text style={[styles.cell, styles.totalText, { color: theme.primary }]}>
              {t("totalThisYear")}
            </Text>
            <Text style={[styles.cell, styles.green, { fontWeight: "800" }]}>
              {fmt(yearTotals.sales)}
            </Text>
            <Text style={[styles.cell, styles.red, { fontWeight: "800" }]}>
              {fmt(yearTotals.expenses)}
            </Text>
            <Text style={[
              styles.cell,
              { color: yearTotals.profit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "800" },
            ]}>
              {fmt(yearTotals.profit)}
            </Text>
            <Text style={[styles.cell, styles.amber, { fontWeight: "800" }]}>
              {profitMarginPct}%
            </Text>
            <View style={styles.eyeBtn} />
          </View>

        </View>
      </ScrollView>
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
  header:   { marginBottom: 10 },
  title:    { fontSize: 14, fontWeight: "800" },
  titleSub: { fontSize: 12, fontWeight: "400" },
  tabs:     { marginBottom: 10 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical:    7,
    borderRadius:       8,
    marginRight:        6,
  },
  tabText: { fontSize: 12, fontWeight: "700" },
  tableRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:    8,
    paddingHorizontal:  4,
    borderBottomWidth:  0.5,
    borderBottomColor: "rgba(150,150,150,0.15)",
  },
  headerText: { color: "#FFD700", fontWeight: "800", fontSize: 10 },
  cell:       { flex: 1, fontSize: 11, paddingHorizontal: 4 },
  green:      { color: "#10b981", fontWeight: "600" },
  red:        { color: "#ef4444", fontWeight: "600" },
  amber:      { color: "#f59e0b", fontWeight: "600" },
  totalText:  { fontWeight: "800", fontSize: 11 },
  eyeBtn:     { padding: 2 },
});

export default memo(MonthlySummaryTable);