// ============================================
// SERVORA ERP — Sales List / History
// Monthly view + Jan-Dec tabs + Daily details
// ============================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Modal, Platform, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, onSnapshot, query,
  orderBy, where, Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useApp } from "../../context/AppContext";
import PaymentSummary from "./components/PaymentSummary";
import SalesByShift from "./components/SalesByShift";
import SalesPrintView from "./components/SalesPrintView";

// ── Types ────────────────────────────────────
interface SaleEntry {
  id?: string;
  date: string;
  shift: string;
  amount: number;
  paymentMethod: string;
  note: string;
  locked: boolean;
  createdAt?: unknown;
}

interface DayTotal {
  date: string;
  total: number;
  entries: SaleEntry[];
}

// ── Constants ────────────────────────────────
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Main Screen ──────────────────────────────
export default function SalesListScreen() {
  const { theme, fmt, restaurantId, userProfile } = useApp();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear] = useState(currentYear);
  const [allSales, setAllSales] = useState<SaleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Right panel — selected day
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [printDate, setPrintDate] = useState<string>("");
  const [paperSize, setPaperSize] = useState<"A4" | "A5" | "A6">("A4");

  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  // ── Load all sales for year ──────────────
  useEffect(() => {
    if (!restaurantId) return;

    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);

    const q = query(
      collection(db, "restaurants", restaurantId, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(yearStart)),
      where("createdAt", "<=", Timestamp.fromDate(yearEnd)),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: SaleEntry[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SaleEntry, "id">),
        }));
        setAllSales(data);
        setLoading(false);
        setRefreshing(false);
      },
      () => { setLoading(false); setRefreshing(false); }
    );

    return unsub;
  }, [restaurantId, selectedYear]);

  // ── Filter by selected month ─────────────
  const monthSales = allSales.filter((s) => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // ── Group by day ─────────────────────────
  const dayMap: Record<string, SaleEntry[]> = {};
  monthSales.forEach((s) => {
    if (!dayMap[s.date]) dayMap[s.date] = [];
    dayMap[s.date].push(s);
  });

  const dayTotals: DayTotal[] = Object.entries(dayMap)
    .map(([date, entries]) => ({
      date,
      total: entries.reduce((sum, e) => sum + Number(e.amount), 0),
      entries,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Monthly totals ────────────────────────
  const monthlyTotal = monthSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const monthlyTxCount = monthSales.length;

  // ── Monthly summary (all months) ─────────
  const monthlySummary = MONTHS.map((_, idx) => {
    const sales = allSales.filter((s) => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d.getMonth() === idx && d.getFullYear() === selectedYear;
    });
    return {
      month: idx,
      total: sales.reduce((sum, s) => sum + Number(s.amount), 0),
      count: sales.length,
    };
  });

  const yearTotal = monthlySummary.reduce((sum, m) => sum + m.total, 0);

  // ── Selected day sales ───────────────────
  const selectedDaySales = selectedDay ? (dayMap[selectedDay] ?? []) : [];
  const selectedDayTotal = selectedDaySales.reduce(
    (sum, s) => sum + Number(s.amount), 0
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short",
    });

  const onRefresh = useCallback(() => setRefreshing(true), []);

  // ── Print modal ───────────────────────────
  if (showPrint) {
    const printSales = printDate
      ? (dayMap[printDate] ?? [])
      : monthSales;

    return (
      <SalesPrintView
        sales={printSales}
        date={printDate || `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`}
        onClose={() => setShowPrint(false)}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={styles.left}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>SALES HISTORY</Text>
            <Text style={styles.headerSub}>{selectedYear}</Text>
          </View>
          <TouchableOpacity
            style={styles.printAllBtn}
            onPress={() => {
              setPrintDate("");
              setShowPrint(true);
            }}
          >
            <MaterialIcons name="download" size={16} color="#00154f" />
            <Text style={styles.printAllBtnText}>Export</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

          {/* Year Total */}
          <View style={[styles.yearCard, { backgroundColor: theme.card }]}>
            <View>
              <Text style={[styles.yearLabel, { color: theme.textSecondary }]}>
                Year Total ({selectedYear})
              </Text>
              <Text style={[styles.yearTotal, { color: "#10b981" }]}>
                {fmt(yearTotal)}
              </Text>
            </View>
            <MaterialIcons name="bar-chart" size={36} color="#10b98130" />
          </View>

          {/* Month Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.monthTabsScroll}
          >
            {MONTHS.map((label, idx) => {
              const active = selectedMonth === idx;
              const hasData = monthlySummary[idx].total > 0;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.monthTab,
                    active && { backgroundColor: theme.primary },
                    !active && { backgroundColor: theme.card },
                  ]}
                  onPress={() => {
                    setSelectedMonth(idx);
                    setSelectedDay(null);
                  }}
                >
                  <Text
                    style={[
                      styles.monthTabLabel,
                      { color: active ? "#fff" : theme.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                  {hasData && (
                    <Text
                      style={[
                        styles.monthTabTotal,
                        { color: active ? "rgba(255,255,255,0.85)" : "#10b981" },
                      ]}
                    >
                      {fmt(monthlySummary[idx].total)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Monthly Summary */}
          <View style={[styles.monthSummary, { backgroundColor: theme.card }]}>
            <View style={styles.monthSummaryRow}>
              <View>
                <Text style={[styles.monthSummaryLabel, { color: theme.textSecondary }]}>
                  {MONTH_NAMES[selectedMonth]} Total
                </Text>
                <Text style={[styles.monthSummaryTotal, { color: "#10b981" }]}>
                  {fmt(monthlyTotal)}
                </Text>
              </View>
              <View style={styles.monthSummaryRight}>
                <Text style={[styles.txCount, { color: theme.textSecondary }]}>
                  {monthlyTxCount} entries
                </Text>
                <TouchableOpacity
                  style={[styles.monthPrintBtn, { borderColor: theme.primary }]}
                  onPress={() => {
                    setPrintDate("");
                    setShowPrint(true);
                  }}
                >
                  <MaterialIcons name="print" size={14} color={theme.primary} />
                  <Text style={[styles.monthPrintBtnText, { color: theme.primary }]}>
                    Print Month
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Payment Summary for month */}
          {monthSales.length > 0 && (
            <PaymentSummary sales={monthSales} />
          )}

          {/* Daily list */}
          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          ) : dayTotals.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
              <MaterialIcons name="receipt-long" size={36} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No sales in {MONTH_NAMES[selectedMonth]}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Daily Breakdown
              </Text>
              {dayTotals.map((day) => {
                const isSelected = selectedDay === day.date;
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.dayRow,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      isSelected && { borderColor: theme.primary, borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedDay(isSelected ? null : day.date)}
                  >
                    <View style={styles.dayLeft}>
                      <View
                        style={[
                          styles.dayIcon,
                          { backgroundColor: isSelected ? theme.primary + "22" : theme.bg },
                        ]}
                      >
                        <MaterialIcons
                          name="calendar-today"
                          size={14}
                          color={isSelected ? theme.primary : theme.textSecondary}
                        />
                      </View>
                      <View>
                        <Text style={[styles.dayDate, { color: theme.text }]}>
                          {formatDate(day.date)}
                        </Text>
                        <Text style={[styles.dayCount, { color: theme.textSecondary }]}>
                          {day.entries.length} entries
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dayRight}>
                      <Text style={[styles.dayTotal, { color: "#10b981" }]}>
                        {fmt(day.total)}
                      </Text>
                      <View style={styles.dayActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setPrintDate(day.date);
                            setShowPrint(true);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <MaterialIcons
                            name="print"
                            size={15}
                            color={theme.textSecondary}
                          />
                        </TouchableOpacity>
                        <MaterialIcons
                          name={isSelected ? "expand-less" : "expand-more"}
                          size={18}
                          color={theme.textSecondary}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Expanded day detail */}
          {selectedDay && selectedDaySales.length > 0 && (
            <View style={[styles.dayDetail, { backgroundColor: theme.surface }]}>
              <View style={styles.dayDetailHeader}>
                <Text style={[styles.dayDetailTitle, { color: theme.text }]}>
                  {formatDate(selectedDay)}
                </Text>
                <Text style={[styles.dayDetailTotal, { color: "#10b981" }]}>
                  {fmt(selectedDayTotal)}
                </Text>
              </View>
              <SalesByShift
                sales={selectedDaySales}
                isManager={isManager}
              />
              <PaymentSummary sales={selectedDaySales} />
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  left: { flex: 1 },
  header: {
    backgroundColor: "#00154f",
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: {
    color: "#FFD700",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    marginTop: 3,
  },
  printAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  printAllBtnText: {
    color: "#00154f",
    fontSize: 12,
    fontWeight: "800",
  },
  body: { padding: 14 },
  yearCard: {
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  yearLabel: { fontSize: 11, fontWeight: "600" },
  yearTotal: { fontSize: 26, fontWeight: "900", marginTop: 2 },
  monthTabsScroll: { marginBottom: 12 },
  monthTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 6,
    alignItems: "center",
    minWidth: 52,
  },
  monthTabLabel: { fontSize: 12, fontWeight: "700" },
  monthTabTotal: { fontSize: 9, fontWeight: "600", marginTop: 2 },
  monthSummary: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  monthSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthSummaryLabel: { fontSize: 11, fontWeight: "600" },
  monthSummaryTotal: { fontSize: 22, fontWeight: "900", marginTop: 2 },
  monthSummaryRight: { alignItems: "flex-end", gap: 6 },
  txCount: { fontSize: 11 },
  monthPrintBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  monthPrintBtnText: { fontSize: 11, fontWeight: "600" },
  emptyBox: {
    borderRadius: 14,
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 13 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
  },
  dayLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDate: { fontSize: 13, fontWeight: "700" },
  dayCount: { fontSize: 11, marginTop: 1 },
  dayRight: { alignItems: "flex-end", gap: 4 },
  dayTotal: { fontSize: 15, fontWeight: "800" },
  dayActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayDetail: {
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
    gap: 10,
  },
  dayDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dayDetailTitle: { fontSize: 14, fontWeight: "700" },
  dayDetailTotal: { fontSize: 18, fontWeight: "900" },
});