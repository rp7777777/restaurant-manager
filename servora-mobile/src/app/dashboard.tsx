// ============================================
// SERVORA ERP — Dashboard
// Live clock + Chart + Monthly/Yearly + PDF
// 100+ years enterprise grade!
// ============================================

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Platform,
  Dimensions, ActivityIndicator, Modal,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import {
  collection, onSnapshot, query,
  where, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useApp } from "../context/AppContext";
import { subscribeDashboardStats, DashboardStats } from "../services/dashboard-service";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

// ── Types ────────────────────────────────────
interface SaleEntry {
  id: string;
  date: string;
  shift: string;
  amount: number;
  paymentMethod: string;
  note: string;
}

interface ExpenseEntry {
  id: string;
  createdAt?: any;
  amount: number;
  expenseName: string;
  category: string;
}

interface MonthSummary {
  month: number;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

interface DayData {
  date: string;
  sales: number;
  expenses: number;
  netProfit: number;
  entries: SaleEntry[];
}

// ── Constants ────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MENU_ITEMS = [
  { labelKey: "salesEntry",  icon: "point-of-sale",  route: "/add-sale",       color: "#10b981" },
  { labelKey: "expenses",    icon: "receipt",        route: "/expenses",       color: "#ef4444" },
  { labelKey: "inventory",   icon: "inventory",      route: "/inventory-module", color: "#f59e0b" },
  { labelKey: "kitchen",     icon: "restaurant",     route: "/kitchen-module", color: "#06b6d4" },
  { labelKey: "store",       icon: "store",          route: "/store-module",   color: "#8b5cf6" },
  { labelKey: "payroll",     icon: "payments",       route: "/payroll-module",  color: "#14b8a6" },
  { labelKey: "schedule",    icon: "calendar-month", route: "/schedule-module", color: "#f97316" },
  { labelKey: "reports",     icon: "bar-chart",      route: "/analytics",      color: "#3b82f6" },
  { labelKey: "settings",    icon: "settings",       route: "/settings",       color: "#64748b" },
];

const YEAR_RANGE = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ── Live Clock Component ──────────────────────
function LiveClock({ theme }: { theme: any }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <View style={clockStyles.container}>
      <MaterialIcons name="access-time" size={14} color="rgba(255,255,255,0.7)" />
      <Text style={clockStyles.time}>{timeStr}</Text>
      <Text style={clockStyles.date}>{dateStr}</Text>
    </View>
  );
}

const clockStyles = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center",
    gap: 6, marginTop: 6,
  },
  time: {
    color: "#FFD700", fontSize: 14,
    fontWeight: "800", fontVariant: ["tabular-nums"],
  },
  date: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
});

// ── Stat Card ─────────────────────────────────
function StatCard({ title, value, icon, gradientColors, sub, change }: {
  title: string; value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  gradientColors: readonly [string, string];
  sub?: string; change?: string;
}) {
  return (
    <LinearGradient colors={gradientColors} style={styles.statCard}>
      <View style={styles.statTop}>
        <MaterialIcons name={icon} size={24} color="rgba(255,255,255,0.9)" />
        {change && (
          <View style={styles.changeBadge}>
            <MaterialIcons name="trending-up" size={10} color="#fff" />
            <Text style={styles.changeText}>{change}</Text>
          </View>
        )}
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </LinearGradient>
  );
}

// ── Menu Card ─────────────────────────────────
function MenuCard({ label, icon, color, onPress, theme }: any) {
  return (
    <TouchableOpacity
      style={[styles.menuCard, { backgroundColor: theme.card }]}
      onPress={onPress} activeOpacity={0.75}
    >
      <View style={[styles.menuIconBox, { backgroundColor: color + "18" }]}>
        <MaterialIcons name={icon} size={26} color={color} />
      </View>
      <Text style={[styles.menuLabel, { color: theme.text }]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main Dashboard ────────────────────────────
export default function DashboardScreen() {
  const { theme, t, fmt, restaurantId } = useApp();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0, totalExpenses: 0, netProfit: 0,
    totalTransactions: 0, todaySales: 0, todayExpenses: 0, lastUpdated: null,
  });
  const [allSales, setAllSales] = useState<SaleEntry[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Filter state
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // ── Stats listener ────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    return subscribeDashboardStats(restaurantId, (s) => {
      setStats(s);
      setLoading(false);
      setRefreshing(false);
    });
  }, [restaurantId]);

  // ── Sales listener ─────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const start = new Date(selectedYear, 0, 1);
    const end = new Date(selectedYear, 11, 31, 23, 59, 59);
    const q = query(
      collection(db, "restaurants", restaurantId, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setAllSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [restaurantId, selectedYear]);

  // ── Expenses listener ──────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const start = new Date(selectedYear, 0, 1);
    const end = new Date(selectedYear, 11, 31, 23, 59, 59);
    const q = query(
      collection(db, "restaurants", restaurantId, "expenses"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setAllExpenses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [restaurantId, selectedYear]);

  // ── Monthly summaries ──────────────────────
  const monthlySummaries: MonthSummary[] = MONTHS.map((_, idx) => {
    const mSales = allSales.filter((s) => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d.getMonth() === idx && d.getFullYear() === selectedYear;
    });
    const mExpenses = allExpenses.filter((e) => {
      const ts = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt ?? 0);
      return ts.getMonth() === idx && ts.getFullYear() === selectedYear;
    });
    const totalSales = mSales.reduce((s, x) => s + safeNum(x.amount), 0);
    const totalExpenses = mExpenses.reduce((s, x) => s + safeNum(x.amount), 0);
    const netProfit = totalSales - totalExpenses;
    return {
      month: idx, totalSales, totalExpenses, netProfit,
      profitMargin: totalSales > 0 ? (netProfit / totalSales) * 100 : 0,
    };
  });

  const yearTotals = {
    sales: monthlySummaries.reduce((s, m) => s + m.totalSales, 0),
    expenses: monthlySummaries.reduce((s, m) => s + m.totalExpenses, 0),
    profit: monthlySummaries.reduce((s, m) => s + m.netProfit, 0),
  };

  // ── Chart data ─────────────────────────────
  const chartLabels = viewMode === "yearly"
    ? MONTHS
    : Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => `${i + 1}`).filter((_, i) => i % 5 === 0 || i === 0);

  const chartSalesData = viewMode === "yearly"
    ? monthlySummaries.map((m) => m.totalSales)
    : (() => {
        const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => {
          const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          return allSales.filter((s) => s.date === dateStr).reduce((s, x) => s + safeNum(x.amount), 0);
        }).filter((_, i) => i % 5 === 0 || i === 0);
      })();

  const chartExpensesData = viewMode === "yearly"
    ? monthlySummaries.map((m) => m.totalExpenses)
    : Array(chartLabels.length).fill(0);

  const hasChartData = chartSalesData.some((v) => v > 0) || chartExpensesData.some((v) => v > 0);

  // ── Daily breakdown ────────────────────────
  const dayMap: Record<string, DayData> = {};
  const selectedMonthSales = allSales.filter((s) => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });
  const selectedMonthExpenses = allExpenses.filter((e) => {
    const ts = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt ?? 0);
    return ts.getMonth() === selectedMonth && ts.getFullYear() === selectedYear;
  });

  selectedMonthSales.forEach((s) => {
    if (!dayMap[s.date]) dayMap[s.date] = { date: s.date, sales: 0, expenses: 0, netProfit: 0, entries: [] };
    dayMap[s.date].sales += safeNum(s.amount);
    dayMap[s.date].entries.push(s);
  });
  selectedMonthExpenses.forEach((e) => {
    const ts = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt ?? 0);
    const dateStr = ts.toISOString().split("T")[0];
    if (!dayMap[dateStr]) dayMap[dateStr] = { date: dateStr, sales: 0, expenses: 0, netProfit: 0, entries: [] };
    dayMap[dateStr].expenses += safeNum(e.amount);
  });
  Object.values(dayMap).forEach((d) => { d.netProfit = d.sales - d.expenses; });

  const dayList = Object.values(dayMap).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // ── PDF Generator ──────────────────────────
  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      const rows = monthlySummaries.map((m) => `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:8px;font-weight:${selectedMonth === m.month ? "bold" : "normal"}">${MONTH_NAMES[m.month]}</td>
          <td style="padding:8px;color:#10b981;text-align:right">${fmt(m.totalSales)}</td>
          <td style="padding:8px;color:#ef4444;text-align:right">${fmt(m.totalExpenses)}</td>
          <td style="padding:8px;color:${m.netProfit >= 0 ? "#3b82f6" : "#ef4444"};text-align:right">${fmt(m.netProfit)}</td>
          <td style="padding:8px;color:#f59e0b;text-align:right">${m.profitMargin.toFixed(2)}%</td>
        </tr>
      `).join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            h1 { color: #00154f; font-size: 20px; }
            h2 { color: #00154f; font-size: 14px; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #00154f; color: #FFD700; padding: 8px; text-align: left; font-size: 11px; }
            .summary { display: flex; gap: 20px; margin: 15px 0; }
            .summary-item { background: #f8fafc; padding: 12px; border-radius: 8px; flex: 1; }
            .summary-label { font-size: 11px; color: #64748b; }
            .summary-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
            .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <h1>SERVORA ERP — Dashboard Report</h1>
          <p style="color:#64748b;font-size:12px">
            Year: ${selectedYear} | Generated: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB")}
          </p>

          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Sales</div>
              <div class="summary-value" style="color:#10b981">${fmt(yearTotals.sales)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Expenses</div>
              <div class="summary-value" style="color:#ef4444">${fmt(yearTotals.expenses)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Net Profit</div>
              <div class="summary-value" style="color:#3b82f6">${fmt(yearTotals.profit)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Profit Margin</div>
              <div class="summary-value" style="color:#f59e0b">
                ${yearTotals.sales > 0 ? ((yearTotals.profit / yearTotals.sales) * 100).toFixed(2) : 0}%
              </div>
            </div>
          </div>

          <h2>Monthly Summary (${selectedYear})</h2>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th style="text-align:right">Total Sales</th>
                <th style="text-align:right">Total Expenses</th>
                <th style="text-align:right">Net Profit</th>
                <th style="text-align:right">Margin</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr style="background:#00154f;color:#FFD700;font-weight:bold">
                <td style="padding:8px">TOTAL</td>
                <td style="padding:8px;text-align:right">${fmt(yearTotals.sales)}</td>
                <td style="padding:8px;text-align:right">${fmt(yearTotals.expenses)}</td>
                <td style="padding:8px;text-align:right">${fmt(yearTotals.profit)}</td>
                <td style="padding:8px;text-align:right">
                  ${yearTotals.sales > 0 ? ((yearTotals.profit / yearTotals.sales) * 100).toFixed(2) : 0}%
                </td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            SERVORA ERP © ${new Date().getFullYear()} — Confidential Restaurant Management Report
          </div>
        </body>
        </html>
      `;

      if (Platform.OS === "web") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const win = window.open(url);
        win?.print();
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Dashboard Report ${selectedYear}`,
        });
      }
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short",
    });

  const onRefresh = useCallback(() => setRefreshing(true), []);
  const profitable = stats.netProfit >= 0;
  const selectedM = monthlySummaries[selectedMonth];

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
    >
      {/* ── Header ── */}
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Dashboard Overview</Text>
            <Text style={styles.headerSub}>Welcome back, Admin 👋</Text>
            <LiveClock theme={theme} />
          </View>
          <View style={styles.headerRight}>
            {/* Year selector */}
            <TouchableOpacity
              style={styles.yearSelector}
              onPress={() => setShowYearPicker(true)}
            >
              <MaterialIcons name="calendar-today" size={14} color="#FFD700" />
              <Text style={styles.yearSelectorText}>{selectedYear}</Text>
              <MaterialIcons name="arrow-drop-down" size={16} color="#FFD700" />
            </TouchableOpacity>
            {/* Download button */}
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={generatePDF}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <ActivityIndicator size="small" color="#00154f" />
              ) : (
                <>
                  <MaterialIcons name="download" size={16} color="#00154f" />
                  <Text style={styles.downloadBtnText}>Download Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* ── 4 Stat Cards ── */}
        <View style={styles.statRow}>
          <StatCard title="Total Sales" value={fmt(stats.totalSales)}
            icon="point-of-sale" gradientColors={["#059669","#10b981"]} change="This Year" />
          <StatCard title="Total Expenses" value={fmt(stats.totalExpenses)}
            icon="receipt" gradientColors={["#dc2626","#ef4444"]} />
          <StatCard title="Net Profit" value={fmt(stats.netProfit)}
            icon="trending-up" gradientColors={profitable ? ["#0369a1","#0ea5e9"] : ["#9f1239","#e11d48"]} />
          <StatCard title="Today's Sales" value={fmt(stats.todaySales)}
            icon="today" gradientColors={["#d97706","#f59e0b"]}
            sub={new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
        </View>

        {/* ── Chart Section ── */}
        <View style={[styles.chartSection, { backgroundColor: theme.card }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Sales & Expenses Overview
              </Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                ({selectedYear})
              </Text>
            </View>
            {/* Monthly/Yearly toggle */}
            <View style={styles.toggleRow}>
              {(["monthly", "yearly"] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.toggleBtn,
                    viewMode === mode && { backgroundColor: theme.primary },
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setViewMode(mode)}
                >
                  <Text style={[
                    styles.toggleBtnText,
                    { color: viewMode === mode ? "#fff" : theme.textSecondary },
                  ]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Month selector (monthly mode) */}
          {viewMode === "monthly" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {MONTHS.map((label, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.monthChip,
                    selectedMonth === idx && { backgroundColor: theme.primary },
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setSelectedMonth(idx)}
                >
                  <Text style={[styles.monthChipText, {
                    color: selectedMonth === idx ? "#fff" : theme.textSecondary,
                  }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {hasChartData ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: viewMode === "yearly" ? MONTHS : chartLabels,
                  datasets: [
                    {
                      data: chartSalesData.length > 0 ? chartSalesData : [0],
                      color: () => "#10b981",
                      strokeWidth: 2.5,
                    },
                    {
                      data: chartExpensesData.length > 0 ? chartExpensesData : [0],
                      color: () => "#ef4444",
                      strokeWidth: 2.5,
                    },
                  ],
                  legend: ["Sales", "Expenses"],
                }}
                width={Math.max(width - 60, 600)}
                height={220}
                chartConfig={{
                  backgroundColor: theme.card,
                  backgroundGradientFrom: theme.card,
                  backgroundGradientTo: theme.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(124,58,237,${opacity})`,
                  labelColor: () => theme.textSecondary,
                  style: { borderRadius: 8 },
                  propsForDots: { r: "4", strokeWidth: "2" },
                  propsForBackgroundLines: {
                    stroke: theme.border, strokeDasharray: "4",
                  },
                }}
                bezier
                style={{ borderRadius: 8, marginTop: 4 }}
              />
            </ScrollView>
          ) : (
            <View style={[styles.noChartBox, { borderColor: theme.border }]}>
              <MaterialIcons name="bar-chart" size={40} color={theme.textSecondary} />
              <Text style={[styles.noChartText, { color: theme.textSecondary }]}>
                No data for {selectedYear}
              </Text>
            </View>
          )}
        </View>

        {/* ── Overall Summary + Quick Actions (web) ── */}
        {isWeb && (
          <View style={styles.webSummaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Overall Summary{" "}
                <Text style={{ color: theme.textSecondary, fontWeight: "400", fontSize: 12 }}>
                  (This Year)
                </Text>
              </Text>
              {[
                { label: "Total Sales", value: fmt(yearTotals.sales), color: "#10b981" },
                { label: "Total Expenses", value: fmt(yearTotals.expenses), color: "#ef4444" },
                { label: "Net Profit", value: fmt(yearTotals.profit), color: "#3b82f6" },
                {
                  label: "Profit Margin",
                  value: yearTotals.sales > 0 ? `${((yearTotals.profit / yearTotals.sales) * 100).toFixed(2)}%` : "0%",
                  color: "#f59e0b",
                },
                { label: "Total Transactions", value: stats.totalTransactions.toLocaleString(), color: theme.text },
              ].map(({ label, value, color }) => (
                <View key={label} style={[styles.summaryRow2, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <Text style={[styles.summaryValue, { color }]}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.quickActionsCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
              {[
                { label: "Add Today's Sale", icon: "add", color: theme.primary, route: "/add-sale" },
                { label: "Add Expense", icon: "add", color: "#ef4444", route: "/expenses" },
                { label: "View Schedule", icon: "calendar-month", color: "#3b82f6", route: "/workerschedule" },
                { label: "Generate Report", icon: "bar-chart", color: "#10b981", route: "/analytics" },
                { label: "Backup Data", icon: "backup", color: "#64748b", route: "/backup" },
              ].map(({ label, icon, color, route }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.quickBtn, { backgroundColor: color }]}
                  onPress={() => router.push(route as any)}
                >
                  <MaterialIcons name={icon as any} size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Monthly Summary Table ── */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Monthly Summary{" "}
              <Text style={{ color: theme.textSecondary, fontWeight: "400", fontSize: 12 }}>
                ({selectedYear})
              </Text>
            </Text>
          </View>

          {/* Month tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthTabs}>
            {MONTHS.map((label, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.monthTab,
                  { backgroundColor: selectedMonth === idx ? theme.primary : theme.bg },
                ]}
                onPress={() => { setSelectedMonth(idx); setSelectedDay(null); }}
              >
                <Text style={[styles.monthTabText, {
                  color: selectedMonth === idx ? "#fff" : theme.textSecondary,
                }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Table */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: isWeb ? "100%" : 600 }}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                {["Month", "Total Sales", "Total Expenses", "Net Profit", "Profit Margin", "Actions"].map((h) => (
                  <Text key={h} style={[styles.tableCell, styles.tableHeaderText]}>{h}</Text>
                ))}
              </View>
              {monthlySummaries.map((m) => {
                const isSelected = selectedMonth === m.month;
                const hasData = m.totalSales > 0 || m.totalExpenses > 0;
                return (
                  <TouchableOpacity
                    key={m.month}
                    style={[
                      styles.tableRow,
                      isSelected && { backgroundColor: theme.primary + "18" },
                      !hasData && { opacity: 0.4 },
                    ]}
                    onPress={() => { setSelectedMonth(m.month); setSelectedDay(null); }}
                  >
                    <Text style={[styles.tableCell, { color: theme.text, fontWeight: isSelected ? "700" : "500" }]}>
                      {MONTH_NAMES[m.month]}
                    </Text>
                    <Text style={[styles.tableCell, { color: "#10b981", fontWeight: "600" }]}>
                      {fmt(m.totalSales)}
                    </Text>
                    <Text style={[styles.tableCell, { color: "#ef4444", fontWeight: "600" }]}>
                      {fmt(m.totalExpenses)}
                    </Text>
                    <Text style={[styles.tableCell, { color: m.netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "600" }]}>
                      {fmt(m.netProfit)}
                    </Text>
                    <Text style={[styles.tableCell, { color: "#f59e0b", fontWeight: "600" }]}>
                      {m.profitMargin.toFixed(2)}%
                    </Text>
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => { setSelectedMonth(m.month); setSelectedDay(null); }}
                    >
                      <MaterialIcons name="visibility" size={16} color={theme.primary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
              {/* Year total */}
              <View style={[styles.tableRow, styles.totalRow]}>
                <Text style={[styles.tableCell, styles.totalRowText]}>Total (This Year)</Text>
                <Text style={[styles.tableCell, { color: "#10b981", fontWeight: "800" }]}>{fmt(yearTotals.sales)}</Text>
                <Text style={[styles.tableCell, { color: "#ef4444", fontWeight: "800" }]}>{fmt(yearTotals.expenses)}</Text>
                <Text style={[styles.tableCell, { color: yearTotals.profit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "800" }]}>{fmt(yearTotals.profit)}</Text>
                <Text style={[styles.tableCell, { color: "#f59e0b", fontWeight: "800" }]}>
                  {yearTotals.sales > 0 ? `${((yearTotals.profit / yearTotals.sales) * 100).toFixed(2)}%` : "0%"}
                </Text>
                <View style={styles.tableCell} />
              </View>
            </View>
          </ScrollView>
        </View>

        {/* ── Daily Details Panel ── */}
        {dayList.length > 0 && (
          <View style={[styles.dailyPanel, { backgroundColor: theme.card }]}>
            <View style={styles.dailyPanelHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Daily Details — {MONTH_NAMES[selectedMonth]}
              </Text>
              <TouchableOpacity
                style={[styles.downloadMonthBtn, { borderColor: theme.primary }]}
                onPress={() => router.push("/sales-list" as any)}
              >
                <MaterialIcons name="download" size={13} color={theme.primary} />
                <Text style={[styles.downloadMonthBtnText, { color: theme.primary }]}>
                  Download {MONTHS[selectedMonth]} Report
                </Text>
              </TouchableOpacity>
            </View>

            {/* Month totals */}
            <View style={[styles.dailySummaryRow, { borderBottomColor: theme.border }]}>
              {[
                { label: "Total Sales", value: fmt(selectedM.totalSales), color: "#10b981" },
                { label: "Total Expenses", value: fmt(selectedM.totalExpenses), color: "#ef4444" },
                { label: "Net Profit", value: fmt(selectedM.netProfit), color: selectedM.netProfit >= 0 ? "#3b82f6" : "#ef4444" },
              ].map(({ label, value, color }) => (
                <View key={label} style={styles.dailySummaryItem}>
                  <Text style={[styles.dailySummaryLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <Text style={[styles.dailySummaryValue, { color }]}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Daily table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: isWeb ? "100%" : 500 }}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  {["Date", "Sales", "Expenses", "Net Profit", "Actions"].map((h) => (
                    <Text key={h} style={[styles.tableCell, styles.tableHeaderText]}>{h}</Text>
                  ))}
                </View>
                {dayList.map((day, idx) => {
                  const isSelected = selectedDay === day.date;
                  return (
                    <React.Fragment key={day.date}>
                      <TouchableOpacity
                        style={[
                          styles.tableRow,
                          idx % 2 === 0 ? { backgroundColor: theme.bg + "60" } : {},
                          isSelected && { backgroundColor: theme.primary + "18" },
                        ]}
                        onPress={() => setSelectedDay(isSelected ? null : day.date)}
                      >
                        <Text style={[styles.tableCell, { color: theme.text, fontSize: 11 }]}>
                          {formatDate(day.date)}
                        </Text>
                        <Text style={[styles.tableCell, { color: "#10b981", fontWeight: "600" }]}>
                          {fmt(day.sales)}
                        </Text>
                        <Text style={[styles.tableCell, { color: "#ef4444", fontWeight: "600" }]}>
                          {fmt(day.expenses)}
                        </Text>
                        <Text style={[styles.tableCell, {
                          color: day.netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "600",
                        }]}>
                          {fmt(day.netProfit)}
                        </Text>
                        <MaterialIcons
                          name={isSelected ? "visibility-off" : "visibility"}
                          size={16} color={theme.primary}
                        />
                      </TouchableOpacity>
                      {isSelected && day.entries.length > 0 && (
                        <View style={[styles.dayExpanded, { backgroundColor: theme.surface }]}>
                          {day.entries.map((sale) => (
                            <View key={sale.id} style={[styles.dayEntryRow, { borderBottomColor: theme.border }]}>
                              <Text style={[styles.dayEntryShift, { color: theme.textSecondary }]}>{sale.shift}</Text>
                              <Text style={[styles.dayEntryPayment, { color: theme.textSecondary }]}>{sale.paymentMethod}</Text>
                              <Text style={[styles.dayEntryNote, { color: theme.textSecondary }]}>{sale.note}</Text>
                              <Text style={[styles.dayEntryAmount, { color: "#10b981" }]}>{fmt(safeNum(sale.amount))}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
                {/* Month total row */}
                <View style={[styles.tableRow, styles.totalRow]}>
                  <Text style={[styles.tableCell, styles.totalRowText]}>Total ({MONTHS[selectedMonth]})</Text>
                  <Text style={[styles.tableCell, { color: "#10b981", fontWeight: "800" }]}>{fmt(selectedM.totalSales)}</Text>
                  <Text style={[styles.tableCell, { color: "#ef4444", fontWeight: "800" }]}>{fmt(selectedM.totalExpenses)}</Text>
                  <Text style={[styles.tableCell, { color: selectedM.netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: "800" }]}>{fmt(selectedM.netProfit)}</Text>
                  <View style={styles.tableCell} />
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Management Grid ── */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>
          {t("management")}
        </Text>
        <View style={styles.menuGrid}>
          {MENU_ITEMS.map((item) => (
            <MenuCard
              key={item.route}
              label={t(item.labelKey)}
              icon={item.icon}
              color={item.color}
              theme={theme}
              onPress={() => router.push(item.route as any)}
            />
          ))}
        </View>

      </View>

      {/* ── Year Picker Modal ── */}
      <Modal visible={showYearPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowYearPicker(false)}
        >
          <View style={[styles.yearPickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.yearPickerTitle, { color: theme.text }]}>Select Year</Text>
            {YEAR_RANGE.map((year) => (
              <TouchableOpacity
                key={year}
                style={[
                  styles.yearPickerItem,
                  { borderBottomColor: theme.border },
                  selectedYear === year && { backgroundColor: theme.primary + "22" },
                ]}
                onPress={() => { setSelectedYear(year); setShowYearPicker(false); }}
              >
                <Text style={[styles.yearPickerItemText, {
                  color: selectedYear === year ? theme.primary : theme.text,
                  fontWeight: selectedYear === year ? "800" : "500",
                }]}>
                  {year}
                </Text>
                {selectedYear === year && (
                  <MaterialIcons name="check" size={16} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────
const CARD_W = isWeb ? "10%" : (width - 52) / 3;

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14 },

  header: {
    paddingTop: isWeb ? 28 : 20,
    paddingBottom: 24, paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap", gap: 10,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: "flex-end", gap: 8 },
  headerTitle: { fontSize: isWeb ? 22 : 18, fontWeight: "900", color: "#FFD700" },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  yearSelector: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(255,215,0,0.3)",
  },
  yearSelectorText: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  downloadBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFD700",
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  downloadBtnText: { color: "#00154f", fontSize: 12, fontWeight: "800" },

  body: { padding: 14 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, minWidth: isWeb ? 160 : (width - 52) / 2,
    borderRadius: 16, padding: 14, gap: 4,
  },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  changeBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8,
  },
  changeText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  statTitle: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600", marginTop: 6 },
  statValue: { color: "#fff", fontSize: isWeb ? 20 : 16, fontWeight: "900" },
  statSub: { color: "rgba(255,255,255,0.6)", fontSize: 10 },

  // Chart
  chartSection: { borderRadius: 16, padding: 14, marginBottom: 14 },
  chartHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800" },
  sectionSub: { fontSize: 11, marginTop: 1 },
  toggleRow: { flexDirection: "row", gap: 4 },
  toggleBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
  },
  toggleBtnText: { fontSize: 11, fontWeight: "600" },
  monthChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, marginRight: 5, borderWidth: 1,
  },
  monthChipText: { fontSize: 11, fontWeight: "600" },
  noChartBox: {
    height: 120, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  noChartText: { fontSize: 13 },

  // Web summary
  webSummaryRow: { flexDirection: "row", gap: 14, marginBottom: 14 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 14 },
  quickActionsCard: { flex: 1, borderRadius: 14, padding: 14 },
  summaryRow2: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1,
  },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 12, fontWeight: "700" },
  quickBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 8, marginBottom: 6,
  },
  quickBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Section
  section: { borderRadius: 16, padding: 14, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  monthTabs: { marginBottom: 10 },
  monthTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, marginRight: 6 },
  monthTabText: { fontSize: 12, fontWeight: "700" },

  // Table
  tableRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(150,150,150,0.15)",
  },
  tableHeader: { backgroundColor: "#00154f" },
  tableHeaderText: { color: "#FFD700", fontWeight: "800", fontSize: 10 },
  tableCell: { flex: 1, fontSize: 11, paddingHorizontal: 4 },
  totalRow: { backgroundColor: "#00154f20" },
  totalRowText: { color: "#00154f", fontWeight: "800", fontSize: 11 },
  eyeBtn: { padding: 2 },

  // Daily panel
  dailyPanel: { borderRadius: 16, padding: 14, marginBottom: 14 },
  dailyPanelHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8,
  },
  dailySummaryRow: {
    flexDirection: "row", paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1,
  },
  dailySummaryItem: { flex: 1, alignItems: "center" },
  dailySummaryLabel: { fontSize: 10, fontWeight: "600", marginBottom: 3 },
  dailySummaryValue: { fontSize: 14, fontWeight: "800" },
  downloadMonthBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  downloadMonthBtnText: { fontSize: 11, fontWeight: "600" },
  dayExpanded: { padding: 8, borderRadius: 8, marginBottom: 2 },
  dayEntryRow: {
    flexDirection: "row", paddingVertical: 5,
    borderBottomWidth: 0.5, gap: 4,
  },
  dayEntryShift: { flex: 1, fontSize: 10 },
  dayEntryPayment: { flex: 1, fontSize: 10 },
  dayEntryNote: { flex: 1.5, fontSize: 10 },
  dayEntryAmount: { flex: 1, fontSize: 11, fontWeight: "700", textAlign: "right" },

  // Menu
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 32 },
  menuCard: {
    width: CARD_W, borderRadius: 14, padding: 12,
    alignItems: "center", justifyContent: "center",
    gap: 8, minHeight: 90,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  menuIconBox: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 11, fontWeight: "600", textAlign: "center", lineHeight: 15 },

  // Year picker modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 40,
  },
  yearPickerCard: {
    width: "100%", maxWidth: 280,
    borderRadius: 16, overflow: "hidden",
  },
  yearPickerTitle: {
    fontSize: 15, fontWeight: "800",
    padding: 16, paddingBottom: 8,
  },
  yearPickerItem: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  yearPickerItemText: { fontSize: 14 },
});
