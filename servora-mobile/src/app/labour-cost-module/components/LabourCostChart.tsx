// ============================================
// SERVORA ERP — LabourCostChart Component
// ✅ Pure presentation component
// ✅ theme prop — no AppContext dependency
// ✅ totals useMemo — single reduce pass
// ✅ formatBarLabel — Intl cached per locale
// ✅ minHeight bar — 4% visible
// ✅ Accessibility — chart wrapper + hint
// ✅ Complete memo comparator — all theme fields
// ✅ Responsive — useWindowDimensions
// ✅ Empty state handled
// FROZEN
// ============================================

import React, { memo, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  useWindowDimensions,
} from "react-native";
import { DailyLabourCost } from "../types/labour-cost-types";
import {
  formatLabourCost,
  formatLabourHours,
} from "../utils/labour-cost-format";

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
  success?:      string;
  warning?:      string;
}

interface Props {
  data:            DailyLabourCost[];
  theme:           Theme;
  currencySymbol?: string;
  locale?:         string;
  showHours?:      boolean;
  showCost?:       boolean;
  title?:          string;
}

interface BarItem {
  date:          string;
  label:         string;
  totalCost:     number;
  totalHours:    number;
  overtimeHours: number;
  costPct:       number;
  hoursPct:      number;
}

const MIN_BAR_PCT = 4;

// ✅ Fix #2 — Intl.DateTimeFormat cached per locale
function makeBarLabelFormatter(locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day:     "numeric",
    });
  } catch {
    return null;
  }
}

function LabourCostChartComponent({
  data,
  theme,
  currencySymbol = "€",
  locale         = "en",
  showHours      = true,
  showCost       = true,
  title          = "Labour Cost Trend",
}: Props) {

  const { width }    = useWindowDimensions();
  const warningColor = theme.warning ?? "#f59e0b";

  // ✅ Fix #2 — formatter cached — not recreated per bar
  const barLabelFormatter = useMemo(
    () => makeBarLabelFormatter(locale),
    [locale]
  );

  const formatBarLabel = useMemo(() => (iso: string): string => {
    try {
      const d = new Date(`${iso}T00:00:00`);
      return barLabelFormatter?.format(d) ?? iso.slice(5);
    } catch {
      return iso.slice(5);
    }
  }, [barLabelFormatter]);

  // ── Build bar items ───────────────────────
  const bars = useMemo((): BarItem[] => {
    if (data.length === 0) return [];

    const maxCost  = Math.max(...data.map((d) => d.totalCost),  1);
    const maxHours = Math.max(...data.map((d) => d.totalHours), 1);

    return data.map((d) => ({
      date:          d.date,
      label:         formatBarLabel(d.date),
      totalCost:     d.totalCost,
      totalHours:    d.totalHours,
      overtimeHours: d.overtimeHours,
      costPct:  Math.max(
        d.totalCost  > 0 ? MIN_BAR_PCT : 0,
        (d.totalCost  / maxCost)  * 100,
      ),
      hoursPct: Math.max(
        d.totalHours > 0 ? MIN_BAR_PCT : 0,
        (d.totalHours / maxHours) * 100,
      ),
    }));
  }, [data, formatBarLabel]);

  // ✅ Fix #1 — single reduce pass
  const totals = useMemo(() => data.reduce(
    (acc, d) => {
      acc.cost  += d.totalCost;
      acc.hours += d.totalHours;
      acc.ot    += d.overtimeHours;
      return acc;
    },
    { cost: 0, hours: 0, ot: 0 }
  ), [data]);

  // ── Bar width ─────────────────────────────
  const barWidth = useMemo(() => {
    const available  = width - 48;
    const calculated = Math.floor(available / Math.max(bars.length, 1));
    return Math.max(32, Math.min(calculated, 60));
  }, [width, bars.length]);

  const chartHeight = 140;

  if (bars.length === 0) {
    return (
      <View style={[styles.wrapper, {
        backgroundColor: theme.surface,
        borderColor:     theme.border,
      }]}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No data for this period
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.wrapper, {
        backgroundColor: theme.surface,
        borderColor:     theme.border,
      }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Labour cost trend chart. Total cost: ${formatLabourCost(totals.cost, currencySymbol, locale)}, Total hours: ${formatLabourHours(totals.hours)}`}
      // ✅ Fix #3 — accessibility hint
      accessibilityHint="Shows labour cost and worked hours by day"
    >

      {/* ── Title ── */}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

      {/* ── Legend ── */}
      <View style={styles.legendRow}>
        {showCost && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Cost
            </Text>
          </View>
        )}
        {showHours && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: warningColor }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Hours
            </Text>
          </View>
        )}
      </View>

      {/* ── Chart ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScroll}
      >
        {bars.map((bar) => (
          <View
            key={bar.date}
            style={[styles.barGroup, { width: barWidth }]}
          >
            <View style={[styles.barContainer, { height: chartHeight }]}>
              {showHours && (
                <View style={[
                  styles.barHours,
                  {
                    height:          `${bar.hoursPct}%`,
                    backgroundColor: `${warningColor}60`,
                    width:            barWidth * 0.35,
                  },
                ]} />
              )}
              {showCost && (
                <View style={[
                  styles.barCost,
                  {
                    height:          `${bar.costPct}%`,
                    backgroundColor: theme.primary,
                    width:            barWidth * 0.35,
                    opacity:          0.85,
                  },
                ]} />
              )}
            </View>
            <Text
              style={[styles.barLabel, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {bar.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Summary row ── */}
      <View style={[styles.summaryRow, { borderTopColor: theme.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.primary }]}>
            {formatLabourCost(totals.cost, currencySymbol, locale)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            Total Cost
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: warningColor }]}>
            {formatLabourHours(totals.hours)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            Total Hours
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: warningColor }]}>
            {formatLabourHours(totals.ot)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            Overtime
          </Text>
        </View>
      </View>

    </View>
  );
}

// ✅ Fix #1 — complete memo comparator — all theme fields
export const LabourCostChart = memo(
  LabourCostChartComponent,
  (prev, next) =>
    prev.data                === next.data                &&
    prev.theme.primary       === next.theme.primary       &&
    prev.theme.surface       === next.theme.surface       &&
    prev.theme.border        === next.theme.border        &&
    prev.theme.text          === next.theme.text          &&
    prev.theme.textSecondary === next.theme.textSecondary &&
    prev.theme.warning       === next.theme.warning       &&
    prev.locale              === next.locale              &&
    prev.currencySymbol      === next.currencySymbol      &&
    prev.showCost            === next.showCost            &&
    prev.showHours           === next.showHours           &&
    prev.title               === next.title
);

const styles = StyleSheet.create({
  wrapper: {
    margin:       12,
    borderRadius: 16,
    borderWidth:   1,
    padding:      14,
    gap:           10,
  },
  title: {
    fontSize:   14,
    fontWeight: "800",
  },
  legendRow: {
    flexDirection: "row",
    gap:            12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:            4,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  chartScroll: {
    gap:           4,
    paddingBottom: 4,
  },
  barGroup: {
    alignItems: "center",
    gap:         4,
  },
  barContainer: {
    flexDirection:  "row",
    alignItems:     "flex-end",
    justifyContent: "center",
    gap:             3,
  },
  barCost: {
    borderRadius: 3,
    minHeight:    2,
  },
  barHours: {
    borderRadius: 3,
    minHeight:    2,
  },
  barLabel: {
    fontSize:  9,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection:  "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingTop:     10,
  },
  summaryItem: {
    alignItems: "center",
    gap:         2,
  },
  summaryValue: {
    fontSize:   13,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 10,
  },
  emptyBox: {
    height:         100,
    alignItems:     "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
  },
});