// ============================================
// SERVORA ERP — DashboardChart
// ✅ Monthly + Yearly chart
// ✅ Month selector chips
// ✅ Monthly/Yearly toggle
// ✅ Theme compatible
// ✅ React.memo
// ✅ isWeb — meaningful chart width
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet, Platform,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LineChart }     from "react-native-chart-kit";
import { useApp }        from "../../context/AppContext";
import { ChartData }     from "../../types/dashboard";
import { MONTHS }        from "../../constants/dashboard";

const isWeb = Platform.OS === "web";

// ── Props ─────────────────────────────────────
interface DashboardChartProps {
  chartData:     ChartData;
  hasData:       boolean;
  viewMode:      "monthly" | "yearly";
  selectedMonth: number;
  selectedYear:  number;
  onViewMode:    (mode: "monthly" | "yearly") => void;
  onMonthSelect: (month: number) => void;
}

// ── Component ─────────────────────────────────
function DashboardChart({
  chartData,
  hasData,
  viewMode,
  selectedMonth,
  selectedYear,
  onViewMode,
  onMonthSelect,
}: DashboardChartProps) {
  const { theme, t } = useApp();
  const { width }    = useWindowDimensions();

  // ✅ isWeb — meaningful chart width
  const chartWidth = isWeb
    ? Math.max(width - 80, 700)
    : Math.max(width - 32, width);

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>
            {t("salesExpensesOverview")}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            ({selectedYear})
          </Text>
        </View>

        {/* ── Toggle ── */}
        <View style={styles.toggleRow}>
          {(["monthly", "yearly"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.toggleBtn,
                { borderColor: theme.border },
                viewMode === mode && { backgroundColor: theme.primary },
              ]}
              onPress={() => onViewMode(mode)}
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === mode }}
            >
              <Text style={[
                styles.toggleText,
                { color: viewMode === mode ? "#fff" : theme.textSecondary },
              ]}>
                {mode === "monthly" ? t("monthly") : t("yearly")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Month chips ── */}
      {viewMode === "monthly" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
        >
          {MONTHS.map((label, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.chip,
                { borderColor: theme.border },
                selectedMonth === idx && { backgroundColor: theme.primary },
              ]}
              onPress={() => onMonthSelect(idx)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedMonth === idx }}
            >
              <Text style={[
                styles.chipText,
                { color: selectedMonth === idx ? "#fff" : theme.textSecondary },
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Chart ── */}
      {hasData ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={{
              labels:   chartData.labels,
              datasets: [
                {
                  data:        chartData.salesData.length > 0 ? chartData.salesData : [0],
                  color:       () => "#10b981",
                  strokeWidth: 2.5,
                },
                {
                  data:        chartData.expData.length > 0 ? chartData.expData : [0],
                  color:       () => "#ef4444",
                  strokeWidth: 2.5,
                },
              ],
              legend: [t("sales"), t("expenses")],
            }}
            // ✅ isWeb — meaningful chart width
            width={chartWidth}
            height={220}
            chartConfig={{
              backgroundColor:        theme.card,
              backgroundGradientFrom: theme.card,
              backgroundGradientTo:   theme.card,
              decimalPlaces:          0,
              color:      (opacity = 1) => `rgba(124,58,237,${opacity})`,
              labelColor: () => theme.textSecondary,
              style:      { borderRadius: 8 },
              propsForDots:            { r: "4", strokeWidth: "2" },
              propsForBackgroundLines: {
                stroke:          theme.border,
                strokeDasharray: "4",
              },
            }}
            bezier
            style={styles.chart}
          />
        </ScrollView>
      ) : (
        <View style={[styles.emptyBox, { borderColor: theme.border }]}>
          <MaterialIcons name="bar-chart" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t("noDataFor")} {selectedYear}
          </Text>
        </View>
      )}
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
    alignItems:     "flex-start",
    marginBottom:   10,
    flexWrap:       "wrap",
    gap:             8,
  },
  title: { fontSize: 14, fontWeight: "800" },
  sub:   { fontSize: 11, marginTop: 1 },
  toggleRow:   { flexDirection: "row", gap: 4 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:       8,
    borderWidth:        1,
  },
  toggleText:  { fontSize: 11, fontWeight: "600" },
  chipsScroll: { marginBottom: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:       8,
    marginRight:        5,
    borderWidth:        1,
  },
  chipText:  { fontSize: 11, fontWeight: "600" },
  chart:     { borderRadius: 8, marginTop: 4 },
  emptyBox: {
    height:         120,
    borderRadius:    8,
    borderWidth:     1,
    alignItems:     "center",
    justifyContent: "center",
    gap:             8,
  },
  emptyText: { fontSize: 13 },
});

export default memo(DashboardChart);