// ============================================
// SERVORA ERP — Dashboard Controller
// ✅ Composition only — no business logic
// ✅ useState lazy initializer — currentYear/Month
// ✅ RefreshControl — proper refreshing state
// ✅ All hooks connected
// ✅ All components connected
// ✅ useCallback — no inline callbacks
// ✅ as Href — no as any
// ✅ t() — loading text i18n
// ✅ useMemo — computed data
// ✅ selectedM — null safe
// ✅ selectedYear change — expandedDay reset
// FROZEN
// ============================================

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  ScrollView, View, StyleSheet,
  Platform, RefreshControl,
} from "react-native";
import { router }     from "expo-router";
import type { Href }  from "expo-router";
import { useApp }     from "../context/AppContext";

// ── Hooks ─────────────────────────────────────
import { useDashboardStats }      from "../hooks/dashboard/useDashboardStats";
import { useDashboardSales }      from "../hooks/dashboard/useDashboardSales";
import { useDashboardExpenses }   from "../hooks/dashboard/useDashboardExpenses";
import { useDashboardAlerts }     from "../hooks/dashboard/useDashboardAlerts";
import { useDashboardActivities } from "../hooks/dashboard/useDashboardActivities";
import { useDashboardAttendance } from "../hooks/dashboard/useDashboardAttendance";
import { useDashboardReport }     from "../hooks/dashboard/useDashboardReport";

// ── Services ──────────────────────────────────
import {
  buildMonthlySummaries,
  buildYearTotals,
  buildDayMap,
  buildEmptyMonthSummary,
}                                 from "../services/dashboard/dashboard-summary";
import {
  buildYearlyChartData,
  buildMonthlyChartData,
  hasChartData,
}                                 from "../services/dashboard/dashboard-chart";
import { DashboardAlert }         from "../services/dashboard-service";

// ── Components ────────────────────────────────
import LoadingScreen        from "../components/dashboard/LoadingScreen";
import YearPickerModal      from "../components/dashboard/YearPickerModal";
import DashboardHeader      from "../components/dashboard/DashboardHeader";
import DashboardStats       from "../components/dashboard/DashboardStats";
import AlertsPanel          from "../components/dashboard/AlertsPanel";
import ActivityPanel        from "../components/dashboard/ActivityPanel";
import DashboardChart       from "../components/dashboard/DashboardChart";
import MonthlySummaryTable  from "../components/dashboard/MonthlySummaryTable";
import DailyDetailsPanel    from "../components/dashboard/DailyDetailsPanel";
import QuickActions         from "../components/dashboard/QuickActions";
import ManagementGrid       from "../components/dashboard/ManagementGrid";

const isWeb = Platform.OS === "web";

// ── Controller ────────────────────────────────
export default function DashboardScreen() {
  const { restaurantId, fmt, t } = useApp();

  // ✅ Fix #1 — lazy initializer — clean
  const [selectedYear,   setSelectedYear]   = useState(() => new Date().getFullYear());
  const [selectedMonth,  setSelectedMonth]  = useState(() => new Date().getMonth());
  const [viewMode,       setViewMode]       = useState<"monthly" | "yearly">("monthly");
  const [expandedDay,    setExpandedDay]    = useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  // ✅ Fix #2 — proper refreshing state
  const [refreshing,     setRefreshing]     = useState(false);

  // ── Hooks ─────────────────────────────────
  const { stats,      loading: statsLoading      } = useDashboardStats(restaurantId);
  const { allSales,   loading: salesLoading      } = useDashboardSales(restaurantId, selectedYear);
  const { allExpenses                            } = useDashboardExpenses(restaurantId, selectedYear);
  const { alerts,     refresh: refreshAlerts     } = useDashboardAlerts(restaurantId);
  const { activities                             } = useDashboardActivities(restaurantId, 8);
  const { attendance, refresh: refreshAttendance } = useDashboardAttendance(restaurantId);
  const { generating, generate                   } = useDashboardReport();

  const loading = statsLoading || salesLoading;

  // ✅ selectedYear change — expandedDay reset
  useEffect(() => {
    setExpandedDay(null);
  }, [selectedYear]);

  // ── Computed data ─────────────────────────
  const monthlySummaries = useMemo(() =>
    buildMonthlySummaries(allSales, allExpenses, selectedYear),
    [allSales, allExpenses, selectedYear]
  );

  const yearTotals = useMemo(() =>
    buildYearTotals(monthlySummaries),
    [monthlySummaries]
  );

  const chartData = useMemo(() =>
    viewMode === "yearly"
      ? buildYearlyChartData(monthlySummaries)
      : buildMonthlyChartData(allSales, allExpenses, selectedYear, selectedMonth),
    [viewMode, monthlySummaries, allSales, allExpenses, selectedYear, selectedMonth]
  );

  const dayList = useMemo(() =>
    buildDayMap(allSales, allExpenses, selectedMonth, selectedYear),
    [allSales, allExpenses, selectedMonth, selectedYear]
  );

  // ✅ null safe
  const selectedM = monthlySummaries[selectedMonth] ??
    buildEmptyMonthSummary(selectedMonth);

  // ── Callbacks ─────────────────────────────
  // ✅ Fix #2 — proper refreshing state
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshAlerts(),
        refreshAttendance(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAlerts, refreshAttendance]);

  const onToggleDay = useCallback((date: string) => {
    setExpandedDay((prev) => prev === date ? null : date);
  }, []);

  const onMonthSelect = useCallback((month: number) => {
    setSelectedMonth(month);
    setExpandedDay(null);
  }, []);

  const onAlertPress = useCallback((alert: DashboardAlert) => {
    if (alert.route) router.push(alert.route as Href);
  }, []);

  const onDownloadMonthly = useCallback(() => {
    router.push("/sales-list" as Href);
  }, []);

  const onDownloadPDF = useCallback(() => {
    generate({
      selectedYear,
      selectedMonth,
      summaries:  monthlySummaries,
      yearTotals,
      stats,
      attendance,
      fmt,
    });
  }, [selectedYear, selectedMonth, monthlySummaries, yearTotals, stats, attendance, fmt, generate]);

  const onNavigate = useCallback((route: string) => {
    router.push(route as Href);
  }, []);

  const onQuickAction = useCallback((route: string) => {
    router.push(route as Href);
  }, []);

  const onViewAll = useCallback(() => {
    router.push("/sales-list" as Href);
  }, []);

  const onYearPress = useCallback(() => {
    setShowYearPicker(true);
  }, []);

  const onYearPickerClose = useCallback(() => {
    setShowYearPicker(false);
  }, []);

  // ── Loading ───────────────────────────────
  if (loading) {
    return <LoadingScreen text={t("loadingDashboard")} />;
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        // ✅ Fix #2 — refreshing state
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      <DashboardHeader
        selectedYear={selectedYear}
        generating={generating}
        onYearPress={onYearPress}
        onDownload={onDownloadPDF}
      />

      <View style={styles.body}>
        <DashboardStats
          stats={stats}
          attendance={attendance}
        />

        <AlertsPanel
          alerts={alerts}
          onAlertPress={onAlertPress}
        />

        <DashboardChart
          chartData={chartData}
          hasData={hasChartData(chartData)}
          viewMode={viewMode}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onViewMode={setViewMode}
          onMonthSelect={onMonthSelect}
        />

        {isWeb && (
          <View style={styles.webRow}>
            <MonthlySummaryTable
              summaries={monthlySummaries}
              yearTotals={yearTotals}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onMonthSelect={onMonthSelect}
            />
            <QuickActions onAction={onQuickAction} />
          </View>
        )}

        {!isWeb && (
          <MonthlySummaryTable
            summaries={monthlySummaries}
            yearTotals={yearTotals}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthSelect={onMonthSelect}
          />
        )}

        <DailyDetailsPanel
          dayList={dayList}
          selectedM={selectedM}
          selectedMonth={selectedMonth}
          expandedDay={expandedDay}
          onToggleDay={onToggleDay}
          onDownload={onDownloadMonthly}
        />

        <ActivityPanel
          activities={activities}
          onViewAll={onViewAll}
        />

        <ManagementGrid onNavigate={onNavigate} />
      </View>

      <YearPickerModal
        visible={showYearPicker}
        selectedYear={selectedYear}
        onSelect={setSelectedYear}
        onClose={onYearPickerClose}
      />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  body:      { padding: 14 },
  webRow: {
    flexDirection: "row",
    gap:           14,
    marginBottom:  14,
  },
});