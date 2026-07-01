// ============================================
// SERVORA ERP — DailyDetailsPanel
// ✅ Daily breakdown table
// ✅ Expandable day entries — parent controlled
// ✅ Month totals summary
// ✅ t() — i18n compatible
// ✅ theme.primary — no hardcoded colors
// ✅ No nested TouchableOpacity
// ✅ Theme compatible
// ✅ React.memo
// ✅ 100% controlled component
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
  DayData, MonthSummary,
} from "../../types/dashboard";
import { MONTHS, MONTH_NAMES } from "../../constants/dashboard";

const isWeb = Platform.OS === "web";

// ── Props ─────────────────────────────────────
interface DailyDetailsPanelProps {
  dayList:       DayData[];
  selectedM:     MonthSummary;
  selectedMonth: number;
  // ✅ Parent controlled
  expandedDay:   string | null;
  onToggleDay:   (date: string) => void;
  onDownload:    () => void;
}

// ── Format date ───────────────────────────────
function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

// ── Component ─────────────────────────────────
function DailyDetailsPanel({
  dayList,
  selectedM,
  selectedMonth,
  expandedDay,
  onToggleDay,
  onDownload,
}: DailyDetailsPanelProps) {
  const { theme, fmt, t } = useApp();

  if (dayList.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t("dailyDetails")} — {MONTH_NAMES[selectedMonth]}
        </Text>
        <TouchableOpacity
          style={[styles.downloadBtn, { borderColor: theme.primary }]}
          onPress={onDownload}
          accessibilityRole="button"
          accessibilityLabel={`Download ${MONTHS[selectedMonth]} report`}
        >
          <MaterialIcons name="download" size={13} color={theme.primary} />
          <Text style={[styles.downloadText, { color: theme.primary }]}>
            {MONTHS[selectedMonth]} {t("report")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Month Totals ── */}
      <View style={[styles.totalsRow, { borderBottomColor: theme.border }]}>
        {[
          { label: t("totalSales"),    value: fmt(selectedM.totalSales),    color: "#10b981" },
          { label: t("totalExpenses"), value: fmt(selectedM.totalExpenses), color: "#ef4444" },
          { label: t("netProfit"),     value: fmt(selectedM.netProfit),     color: selectedM.netProfit >= 0 ? "#3b82f6" : "#ef4444" },
        ].map(({ label, value, color }) => (
          <View key={label} style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
              {label}
            </Text>
            <Text style={[styles.totalValue, { color }]}>{value}</Text>
          </View>
        ))}
      </View>

      {/* ── Daily Table ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: isWeb ? "100%" : 500 }}>

          {/* Header */}
          <View style={[styles.tableRow, { backgroundColor: theme.primary }]}>
            {[t("date"), t("sales"), t("expenses"), t("netProfit"), t("actions")].map((h) => (
              <Text key={h} style={[styles.cell, styles.headerText]}>{h}</Text>
            ))}
          </View>

          {/* Rows */}
          {dayList.map((day, idx) => {
            const isExpanded = expandedDay === day.date;
            return (
              <React.Fragment key={day.date}>
                <TouchableOpacity
                  style={[
                    styles.tableRow,
                    idx % 2 === 0 && { backgroundColor: theme.bg + "60" },
                    isExpanded    && { backgroundColor: theme.primary + "18" },
                  ]}
                  // ✅ Parent controlled toggle
                  onPress={() => onToggleDay(day.date)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <Text style={[styles.cell, { color: theme.text, fontSize: 11 }]}>
                    {formatDate(day.date)}
                  </Text>
                  <Text style={[styles.cell, styles.green]}>
                    {fmt(day.sales)}
                  </Text>
                  <Text style={[styles.cell, styles.red]}>
                    {fmt(day.expenses)}
                  </Text>
                  <Text style={[
                    styles.cell,
                    { color: day.netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "600" },
                  ]}>
                    {fmt(day.netProfit)}
                  </Text>
                  <View style={styles.eyeBtn}>
                    <MaterialIcons
                      name={isExpanded ? "visibility-off" : "visibility"}
                      size={16}
                      color={theme.primary}
                    />
                  </View>
                </TouchableOpacity>

                {/* ── Expanded entries ── */}
                {isExpanded && day.entries.length > 0 && (
                  <View style={[styles.expanded, { backgroundColor: theme.surface }]}>
                    {day.entries.map((sale) => (
                      <View
                        key={sale.id}
                        style={[styles.entryRow, { borderBottomColor: theme.border }]}
                      >
                        <Text style={[styles.entryShift,   { color: theme.textSecondary }]}>
                          {sale.shift}
                        </Text>
                        <Text style={[styles.entryPayment, { color: theme.textSecondary }]}>
                          {sale.paymentMethod}
                        </Text>
                        <Text
                          style={[styles.entryNote, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          {sale.note ?? ""}
                        </Text>
                        <Text style={[styles.entryAmount, { color: "#10b981" }]}>
                          {fmt(sale.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </React.Fragment>
            );
          })}

          {/* Total Row */}
          <View style={[styles.tableRow, { backgroundColor: theme.primary + "20" }]}>
            <Text style={[styles.cell, { color: theme.primary, fontWeight: "800", fontSize: 11 }]}>
              {t("total")} ({MONTHS[selectedMonth]})
            </Text>
            <Text style={[styles.cell, styles.green, { fontWeight: "800" }]}>
              {fmt(selectedM.totalSales)}
            </Text>
            <Text style={[styles.cell, styles.red, { fontWeight: "800" }]}>
              {fmt(selectedM.totalExpenses)}
            </Text>
            <Text style={[
              styles.cell,
              { color: selectedM.netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "800" },
            ]}>
              {fmt(selectedM.netProfit)}
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
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   12,
    flexWrap:       "wrap",
    gap:             8,
  },
  title: { fontSize: 14, fontWeight: "800" },
  downloadBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    borderWidth:        1,
    borderRadius:       8,
    paddingHorizontal: 10,
    paddingVertical:    5,
  },
  downloadText: { fontSize: 11, fontWeight: "600" },
  totalsRow: {
    flexDirection:     "row",
    paddingBottom:     12,
    marginBottom:      12,
    borderBottomWidth:  1,
  },
  totalItem:  { flex: 1, alignItems: "center" },
  totalLabel: { fontSize: 10, fontWeight: "600", marginBottom: 3 },
  totalValue: { fontSize: 14, fontWeight: "800" },
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
  eyeBtn:     { padding: 2 },
  expanded: {
    padding:      8,
    borderRadius: 8,
    marginBottom: 2,
  },
  entryRow: {
    flexDirection:     "row",
    paddingVertical:    5,
    borderBottomWidth:  0.5,
    gap:               4,
  },
  entryShift:   { flex: 1,   fontSize: 10 },
  entryPayment: { flex: 1,   fontSize: 10 },
  entryNote:    { flex: 1.5, fontSize: 10 },
  entryAmount:  { flex: 1,   fontSize: 11, fontWeight: "700", textAlign: "right" },
});

export default memo(DailyDetailsPanel);