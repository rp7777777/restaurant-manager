// ============================================
// SERVORA ERP — useLabourCost Hook
// ✅ Race condition fix — requestId ref
// ✅ Restaurant change — summary cleared immediately
// ✅ Period navigation — daily/weekly/monthly
// ✅ Auto date range from period
// ✅ restaurantId undefined — cleared
// ✅ Loading + error states
// ✅ Refresh on demand
// ✅ No business logic — service layer
// FROZEN
// ============================================

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LabourCostSummary,
  LabourCostFilter,
  LabourCostPeriod,
  DateRange,
} from "../types/labour-cost-types";
import { getLabourCostSummary } from "../services/labour-cost-service";
import {
  buildDateRange,
  filterEmployeeLabourCosts,
  getUniquePositions,
} from "../utils/labour-cost-filters";

// ── Month string from date range ──────────────
// ✅ Note: CUSTOM multi-month not supported in v1
// v2: pass array of monthStr to fetchPayrollData
function toMonthStr(dateRange: DateRange): string {
  return dateRange.startDate.slice(0, 7);
}

// ── useLabourCost ─────────────────────────────
export function useLabourCost(
  restaurantId: string | undefined,
) {
  const [period, setPeriod] = useState<LabourCostPeriod>("MONTHLY");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [filter, setFilter] = useState<
    Pick<LabourCostFilter, "search" | "position">
  >({
    search:   "",
    position: "ALL",
  });

  const [summary, setSummary] = useState<LabourCostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ Fix #1 — requestId ref — race condition protection
  const requestId = useRef(0);

  // ── Date range from period ────────────────
  const dateRange = useMemo(
    () => buildDateRange(period, customRange),
    [period, customRange]
  );

  const monthStr = useMemo(
    () => toMonthStr(dateRange),
    [dateRange]
  );

  // ── Fetch data ────────────────────────────
  useEffect(() => {
    if (!restaurantId) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    // ✅ Fix #3 — clear summary immediately on restaurant/period change
    setSummary(null);
    setLoading(true);
    setError(null);

    // ✅ Fix #1 — increment requestId before fetch
    requestId.current += 1;
    const currentRequestId = requestId.current;

    getLabourCostSummary(restaurantId, dateRange, monthStr)
      .then((data) => {
        // ✅ Fix #1 — ignore stale responses
        if (currentRequestId !== requestId.current) return;
        setSummary(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (currentRequestId !== requestId.current) return;
        const message = err instanceof Error
          ? err.message
          : "Failed to load labour cost data";
        setError(message);
        setLoading(false);
      });

  }, [restaurantId, dateRange, monthStr, refreshKey]);

  // ── Filtered employees ────────────────────
  const filteredEmployees = useMemo(() => {
    if (!summary) return [];
    return filterEmployeeLabourCosts(summary.byEmployee, filter);
  }, [summary, filter]);

  // ── Unique positions ──────────────────────
  const positions = useMemo(() => {
    if (!summary) return [];
    return getUniquePositions(summary.byEmployee);
  }, [summary]);

  // ── Handlers ─────────────────────────────
  const handlePeriodChange = useCallback((p: LabourCostPeriod) => {
    setPeriod(p);
    setCustomRange(undefined);
  }, []);

  const handleCustomRange = useCallback((range: DateRange) => {
    setCustomRange(range);
    setPeriod("CUSTOM");
  }, []);

  const handleFilterChange = useCallback(
    (f: Partial<Pick<LabourCostFilter, "search" | "position">>) => {
      setFilter((prev) => ({ ...prev, ...f }));
    },
    []
  );

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    // ── State ──────────────────────────────
    summary,
    loading,
    error,
    period,
    dateRange,
    monthStr,
    filter,

    // ── Derived ────────────────────────────
    filteredEmployees,
    positions,

    // ── Handlers ───────────────────────────
    handlePeriodChange,
    handleCustomRange,
    handleFilterChange,
    refresh,
  };
}