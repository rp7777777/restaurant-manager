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
// ✅ Recalculate Stats — OWNER-only, with ConfirmModal (cross-
//    platform, since Alert.alert() silently no-ops on web) before
//    calling recomputeDashboardStatsFromSource()
// ✅ Net Profit card's Today/Month/Year rows all scroll to (and
//    auto-expand where relevant) the existing DailyDetailsPanel/
//    MonthlySummaryTable sections on this same page, instead of
//    navigating to a separate screen
// FROZEN
// ============================================

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import {
  DashboardAlert,
  recomputeDashboardStatsFromSource,
}                                 from "../services/dashboard-service";

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
import { ConfirmModal }     from "../components/ui/ConfirmModal";

const isWeb = Platform.OS === "web";

// ── Controller ────────────────────────────────
export default function DashboardScreen() {
  const { restaurantId, fmt, t, userProfile } = useApp();

  const [selectedYear,   setSelectedYear]   = useState(() => new Date().getFullYear());
  const [selectedMonth,  setSelectedMonth]  = useState(() => new Date().getMonth());
  const [viewMode,       setViewMode]       = useState<"monthly" | "yearly">("monthly");
  const [expandedDay,    setExpandedDay]    = useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);

  // ✅ Recalculate Stats state
  const [recalculating,      setRecalculating]      = useState(false);
  const [showRecalcConfirm,  setShowRecalcConfirm]  = useState(false);

  const isOwner = userProfile?.role === "OWNER";

  // ✅ Scroll-to-section refs
  const scrollRef             = useRef<ScrollView>(null);
  const monthlySummaryY        = useRef(0);
  const dailyDetailsY          = useRef(0);

  // ── Hooks ─────────────────────────────────
  const { stats,      loading: statsLoading      } = useDashboardStats(restaurantId);
  const { allSales,   loading: salesLoading      } = useDashboardSales(restaurantId, selectedYear);
  const { allExpenses                            } = useDashboardExpenses(restaurantId, selectedYear);
  const { alerts,     refresh: refreshAlerts     } = useDashboardAlerts(restaurantId);
  const { activities                             } = useDashboardActivities(restaurantId, 8);
  const { attendance, refresh: refreshAttendance } = useDashboardAttendance(restaurantId);
  const { generating, generate                   } = useDashboardReport();

  const loading = statsLoading || salesLoading;

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

  const selectedM = monthlySummaries[selectedMonth] ??
    buildEmptyMonthSummary(selectedMonth);

  // ── Callbacks ─────────────────────────────
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

  // ✅ Recalculate Stats — request → confirm → run
  const onRecalculateRequest = useCallback(() => {
    setShowRecalcConfirm(true);
  }, []);

  const onRecalculateCancel = useCallback(() => {
    setShowRecalcConfirm(false);
  }, []);

  const onRecalculateConfirm = useCallback(async () => {
    if (!restaurantId || recalculating) return;
    setShowRecalcConfirm(false);
    setRecalculating(true);
    try {
      await recomputeDashboardStatsFromSource(restaurantId);
    } catch (err) {
      console.warn("Recalculate failed:", err);
    } finally {
      setRecalculating(false);
    }
  }, [restaurantId, recalculating]);

  // ✅ Net Profit "Today" row — expand today in DailyDetailsPanel,
  //    then scroll to it
  const onProfitTodayPress = useCallback(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    setExpandedDay(todayIso);
    scrollRef.current?.scrollTo({ y: dailyDetailsY.current, animated: true });
  }, []);

  // ✅ Net Profit "Month" row — scroll to MonthlySummaryTable
  //    (current month is already the default selection)
  const onProfitMonthPress = useCallback(() => {
    scrollRef.current?.scrollTo({ y: monthlySummaryY.current, animated: true });
  }, []);

  // ✅ Net Profit "Year" row — scroll to the same MonthlySummaryTable
  //    section (its top area shows the year total already)
  const onProfitYearPress = useCallback(() => {
    scrollRef.current?.scrollTo({ y: monthlySummaryY.current, animated: true });
  }, []);

  // ── Loading ───────────────────────────────
  if (loading) {
    return <LoadingScreen text={t("loadingDashboard")} />;
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
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
        recalculating={isOwner ? recalculating : undefined}
        onRecalculate={isOwner ? onRecalculateRequest : undefined}
      />

      <View style={styles.body}>
        <DashboardStats
          stats={stats}
          attendance={attendance}
          onProfitTodayPress={onProfitTodayPress}
          onProfitMonthPress={onProfitMonthPress}
          onProfitYearPress={onProfitYearPress}
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
          <View
            style={styles.webRow}
            onLayout={(e) => { monthlySummaryY.current = e.nativeEvent.layout.y; }}
          >
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
          <View onLayout={(e) => { monthlySummaryY.current = e.nativeEvent.layout.y; }}>
            <MonthlySummaryTable
              summaries={monthlySummaries}
              yearTotals={yearTotals}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onMonthSelect={onMonthSelect}
            />
          </View>
        )}

        <View onLayout={(e) => { dailyDetailsY.current = e.nativeEvent.layout.y; }}>
          <DailyDetailsPanel
            dayList={dayList}
            selectedM={selectedM}
            selectedMonth={selectedMonth}
            expandedDay={expandedDay}
            onToggleDay={onToggleDay}
            onDownload={onDownloadMonthly}
          />
        </View>

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

      <ConfirmModal
        visible={showRecalcConfirm}
        title="Recalculate Stats"
        message="This recomputes all Dashboard totals directly from your actual Sales and Expenses records. It may take a moment for restaurants with a lot of history. Continue?"
        confirmLabel="Recalculate"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={onRecalculateConfirm}
        onCancel={onRecalculateCancel}
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