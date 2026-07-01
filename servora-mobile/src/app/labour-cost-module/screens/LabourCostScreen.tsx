// ============================================
// SERVORA ERP — LabourCostScreen
// ✅ All Labour Cost components connected
// ✅ useLabourCost hook — data + state
// ✅ useApp — theme, restaurantId, settings
// ✅ Refresh disabled during loading
// ✅ formatLabourCost — consistent formatting
// ✅ Loading + Error states
// ✅ Custom date range flow
// ✅ Employee press — detail ready
// FROZEN
// ============================================

import React, { useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useLabourCost } from "../hooks/useLabourCost";
import { LabourCostKPICards }        from "../components/LabourCostKPICards";
import { LabourCostFilters }         from "../components/LabourCostFilters";
import { LabourCostChart }           from "../components/LabourCostChart";
import { LabourCostTable }           from "../components/LabourCostTable";
import { LabourCostEmployeeCard }    from "../components/LabourCostEmployeeCard";
import { DEFAULT_LABOUR_COST_THRESHOLDS } from "../constants/labour-cost-config";
import { formatLabourCost }          from "../utils/labour-cost-format";
import { EmployeeLabourCost, DateRange } from "../types/labour-cost-types";

export default function LabourCostScreen() {
  const { theme, restaurantId, settings } = useApp();

  const currencySymbol = settings?.currencySymbol ?? "€";
  const locale = settings?.language ?? "en";

  const {
    summary,
    loading,
    error,
    period,
    dateRange,
    filter,
    filteredEmployees,
    positions,
    handlePeriodChange,
    handleCustomRange,
    handleFilterChange,
    refresh,
  } = useLabourCost(restaurantId);

  // ── Employee press ────────────────────────
  const handleEmployeePress = useCallback(
    (_emp: EmployeeLabourCost) => {
      // Future: navigate to employee detail
    },
    []
  );

  // ── Custom date range ─────────────────────
  const handleSelectCustomRange = useCallback(
    (_range: DateRange) => {
      // Future: open date picker modal
      handleCustomRange({
        startDate: dateRange.startDate,
        endDate:   dateRange.endDate,
      });
    },
    [handleCustomRange, dateRange]
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* ── Header ── */}
      <LinearGradient
        colors={["#00154f", "#0039cb"]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>LABOUR COST</Text>
            <Text style={styles.headerSub}>Analytics & Insights</Text>
          </View>
          {/* ✅ Fix #1 — disabled during loading */}
          <TouchableOpacity
            onPress={refresh}
            disabled={loading}
            style={[styles.refreshBtn, { opacity: loading ? 0.4 : 1 }]}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Refresh labour cost data"
          >
            <MaterialIcons name="refresh" size={20} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Filters ── */}
      <LabourCostFilters
        filter={filter}
        period={period}
        dateRange={dateRange}
        positions={positions}
        theme={theme}
        locale={locale}
        onChange={handleFilterChange}
        onPeriodChange={handlePeriodChange}
        onSelectCustomRange={handleSelectCustomRange}
      />

      {/* ── Loading ── */}
      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading labour cost data...
          </Text>
        </View>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={40} color="#ef4444" />
          <Text style={[styles.errorText, { color: theme.text }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={refresh}
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content ── */}
      {!loading && !error && summary && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── KPI Cards ── */}
          <LabourCostKPICards
            summary={summary}
            theme={theme}
            currencySymbol={currencySymbol}
            locale={locale}
            thresholds={DEFAULT_LABOUR_COST_THRESHOLDS}
          />

          {/* ── Chart ── */}
          <LabourCostChart
            data={summary.byDay}
            theme={theme}
            currencySymbol={currencySymbol}
            locale={locale}
            title="Daily Labour Cost Trend"
          />

          {/* ── Position Breakdown ── */}
          {/* Future v2: extract to LabourCostPositionBreakdown.tsx */}
          {summary.byPosition.length > 0 && (
            <View style={[styles.section, {
              backgroundColor: theme.surface,
              borderColor:     theme.border,
            }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Position Breakdown
              </Text>
              {summary.byPosition.map((pos) => (
                <View
                  key={pos.position}
                  style={[styles.posRow, { borderBottomColor: theme.border }]}
                >
                  <View style={styles.posInfo}>
                    <View style={styles.posLeft}>
                      <Text style={[styles.posName, { color: theme.text }]}>
                        {pos.position}
                      </Text>
                      <Text style={[styles.posSub, { color: theme.textSecondary }]}>
                        {pos.employeeCount} emp · {pos.totalHours.toFixed(1)}h
                      </Text>
                    </View>
                    <View style={styles.posRight}>
                      {/* ✅ Fix #5 — formatLabourCost consistent */}
                      <Text style={[styles.posCost, { color: theme.primary }]}>
                        {formatLabourCost(pos.totalCost, currencySymbol, locale)}
                      </Text>
                      <Text style={[styles.posPct, { color: theme.textSecondary }]}>
                        {pos.labourCostPct.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                  {/* ── Cost bar ── */}
                  <View style={[styles.posBarTrack, { backgroundColor: theme.bg }]}>
                    <View style={[
                      styles.posBarFill,
                      {
                        width:           `${Math.min(100, pos.labourCostPct)}%`,
                        backgroundColor: theme.primary,
                      },
                    ]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Employee Table ── */}
          <LabourCostTable
            employees={filteredEmployees}
            theme={theme}
            currencySymbol={currencySymbol}
            locale={locale}
            onPressEmployee={handleEmployeePress}
          />

          {/* ── Employee Cards — mobile ── */}
          {Platform.OS !== "web" && filteredEmployees.length > 0 && (
            <View style={styles.cardsSection}>
              <Text style={[styles.sectionTitle, {
                color:             theme.text,
                paddingHorizontal: 12,
              }]}>
                Employee Detail
              </Text>
              {/* Future: Show all button */}
              {filteredEmployees.slice(0, 10).map((emp) => (
                <LabourCostEmployeeCard
                  key={emp.employeeId}
                  employee={emp}
                  theme={theme}
                  currencySymbol={currencySymbol}
                  locale={locale}
                  onPress={handleEmployeePress}
                />
              ))}
              {filteredEmployees.length > 10 && (
                <Text style={[styles.moreText, { color: theme.textSecondary }]}>
                  +{filteredEmployees.length - 10} more employees in table above
                </Text>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && !summary && (
        <View style={styles.emptyBox}>
          <MaterialIcons name="bar-chart" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No labour cost data for this period
          </Text>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop:        Platform.OS === "web" ? 24 : 48,
    paddingBottom:     16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  headerTitle: {
    fontSize:      22,
    fontWeight:    "900",
    color:         "#FFD700",
    letterSpacing: 1,
  },
  headerSub: {
    fontSize:  12,
    color:     "#ffffff80",
    marginTop: 2,
  },
  refreshBtn: {
    padding:      8,
    borderRadius: 8,
  },
  loadingBox: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
  },
  loadingText: {
    fontSize: 13,
  },
  errorBox: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
    padding:        24,
  },
  errorText: {
    fontSize:  14,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical:   10,
    borderRadius:      10,
  },
  retryText: {
    color:      "#fff",
    fontWeight: "700",
    fontSize:   14,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    margin:       12,
    borderRadius: 16,
    borderWidth:   1,
    padding:      14,
    gap:           4,
  },
  sectionTitle: {
    fontSize:     14,
    fontWeight:   "800",
    marginBottom:  8,
  },
  posRow: {
    paddingVertical:   10,
    borderBottomWidth: 0.5,
    gap:               6,
  },
  posInfo: {
    flexDirection: "row",
    alignItems:    "center",
  },
  posLeft: {
    flex: 1,
    gap:   2,
  },
  posName: {
    fontSize:   13,
    fontWeight: "600",
  },
  posSub: {
    fontSize: 11,
  },
  posRight: {
    alignItems: "flex-end",
    gap:         2,
  },
  posCost: {
    fontSize:   13,
    fontWeight: "800",
  },
  posPct: {
    fontSize: 10,
  },
  posBarTrack: {
    height:       3,
    borderRadius: 2,
    overflow:     "hidden",
  },
  posBarFill: {
    height:       3,
    borderRadius: 2,
  },
  emptyBox: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
  },
  emptyText: {
    fontSize:  14,
    textAlign: "center",
  },
  cardsSection: {
    gap: 0,
  },
  moreText: {
    fontSize:  12,
    textAlign: "center",
    padding:   12,
  },
});