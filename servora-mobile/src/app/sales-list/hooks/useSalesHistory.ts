// ============================================
// SERVORA ERP — useSalesHistory Hook
// Central state + business logic for Sales History screen
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import { subscribeSalesForYear } from "../services/sales-history-service";
import { updateSale, deleteSale } from "../../../services/sales-service";
import {
  filterByMonth,
  groupByDay,
  buildDayTotals,
  sumAmounts,
  buildMonthlySummary,
} from "../utils/sales-grouping";
import { SaleHistoryEntry } from "../types/sales-history-types";
import type { Shift, PaymentMethod, SaleEntry as ModuleSaleEntry } from "../../sales-module/types/sales-types";

// ── Local -> module SaleEntry adapter (for reusing SaleForm/sales-service) ──
function toModuleSaleEntry(sale: SaleHistoryEntry, restaurantId: string): ModuleSaleEntry {
  return {
    id: sale.id,
    date: sale.date,
    shift: sale.shift,
    amount: sale.amount,
    paymentMethod: sale.paymentMethod,
    entryName: sale.entryName ?? sale.note ?? "",
    locked: sale.locked,
    userId: "",
    restaurantId,
  };
}

export function useSalesHistory(selectedYear: number) {
  const { restaurantId } = useApp();

  const [allSales, setAllSales] = useState<SaleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ── Edit state ──
  const [editingSale, setEditingSale] = useState<SaleHistoryEntry | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Delete confirmation state — drives a shared ConfirmModal in the UI ──
  const [pendingDelete, setPendingDelete] = useState<SaleHistoryEntry | null>(null);

  // ── Realtime subscription — sales for the selected year ──
  useEffect(() => {
    if (!restaurantId) {
      setAllSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeSalesForYear(
      restaurantId,
      selectedYear,
      (data) => {
        setAllSales(data);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsub;
  }, [restaurantId, selectedYear]);

  // ── Derived data ──
  const monthSales = useMemo(
    () => filterByMonth(allSales, selectedMonth, selectedYear),
    [allSales, selectedMonth, selectedYear]
  );

  const dayMap = useMemo(() => groupByDay(monthSales), [monthSales]);

  const dayTotals = useMemo(() => buildDayTotals(dayMap), [dayMap]);

  const monthlyTotal = useMemo(() => sumAmounts(monthSales), [monthSales]);

  const monthlySummary = useMemo(
    () => buildMonthlySummary(allSales, selectedYear),
    [allSales, selectedYear]
  );

  const yearTotal = useMemo(
    () => monthlySummary.reduce((sum, m) => sum + m.total, 0),
    [monthlySummary]
  );

  const selectedDaySales = selectedDay ? (dayMap[selectedDay] ?? []) : [];
  const selectedDayTotal = useMemo(() => sumAmounts(selectedDaySales), [selectedDaySales]);

  // ── Month / day selection ──
  const selectMonth = useCallback((month: number) => {
    setSelectedMonth(month);
    setSelectedDay(null);
  }, []);

  const selectDay = useCallback((date: string) => {
    setSelectedDay((prev) => (prev === date ? null : date));
  }, []);

  // ── Edit flow ──
  const requestEdit = useCallback((sale: SaleHistoryEntry) => {
    setEditingSale(sale);
    setEditError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingSale(null);
    setEditError(null);
  }, []);

  const confirmEdit = useCallback(
    async (input: { shift: Shift; amount: string; paymentMethod: PaymentMethod; entryName: string }) => {
      if (!editingSale || !editingSale.id || !restaurantId) return;

      const amountNum = Number(input.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setEditError("Enter a valid amount");
        return;
      }

      setSavingEdit(true);
      setEditError(null);
      try {
        const oldModuleSale = toModuleSaleEntry(editingSale, restaurantId);
        await updateSale(restaurantId, editingSale.id, oldModuleSale, {
          amount: amountNum,
          paymentMethod: input.paymentMethod,
          entryName: input.entryName,
        });
        setEditingSale(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update sale";
        setEditError(message);
      } finally {
        setSavingEdit(false);
      }
    },
    [editingSale, restaurantId]
  );

  // ── Delete flow ──
  const requestDelete = useCallback((sale: SaleHistoryEntry) => {
    setPendingDelete(sale);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const confirmDelete = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!pendingDelete || !pendingDelete.id || !restaurantId) {
      return { success: false, error: "Restaurant not configured" };
    }

    const sale = pendingDelete;
    setPendingDelete(null);

    try {
      const moduleSale = toModuleSaleEntry(sale, restaurantId);
      await deleteSale(restaurantId, sale.id!, moduleSale);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete sale";
      return { success: false, error: message };
    }
  }, [pendingDelete, restaurantId]);

  return {
    loading,
    selectedMonth,
    selectedDay,
    dayTotals,
    monthlyTotal,
    monthSales,
    monthlySummary,
    yearTotal,
    selectedDaySales,
    selectedDayTotal,
    selectMonth,
    selectDay,

    editingSale,
    savingEdit,
    editError,
    requestEdit,
    cancelEdit,
    confirmEdit,

    pendingDelete,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}