// ============================================
// SERVORA ERP — useSales Hook
// Central state + business logic for Sales Entry screen
// FROZEN
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../../context/AppContext";
import {
  createSale,
  updateSale,
  deleteSale,
  subscribeTodaySales,
  lockShift,
  unlockShift,
} from "../../../services/sales-service";
import {
  SaleEntry,
  Shift,
  PaymentMethod,
  CreateSaleInput,
} from "../types/sales-types";
import {
  getShiftTotal,
  getGrandTotal,
  getShiftPaymentBreakdown,
  isShiftLocked as checkShiftLocked,
  getShiftEntries,
} from "../utils/sale-calculations";
import { validateSaleEntry, validateRestaurantContext } from "../utils/sale-validation";
import { todayISO } from "../../../utils/date-utils";

export function useSales() {
  const { restaurantId } = useApp();

  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => todayISO(), []);

  // ── Realtime subscription — instant updates, no refresh needed ──
  useEffect(() => {
    setError(null);

    if (!restaurantId) {
      setSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeTodaySales(
      restaurantId,
      today,
      (data) => {
        setSales(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId, today]);

  // ── Save (create or update) ──
  const saveSale = useCallback(
    async (
      input: { shift: Shift; amount: string; paymentMethod: PaymentMethod; entryName: string },
      editingSale: SaleEntry | null
    ): Promise<{ success: boolean; error?: string }> => {
      const restaurantCheck = validateRestaurantContext(restaurantId);
      if (!restaurantCheck.valid) {
        return { success: false, error: restaurantCheck.error };
      }

      if (editingSale?.locked) {
        return { success: false, error: "This entry is locked and cannot be edited" };
      }

      const shiftLocked = checkShiftLocked(sales, input.shift);
      const currentShiftEntryCount = getShiftEntries(sales, input.shift).length;
      const validation = validateSaleEntry(input, shiftLocked, !!editingSale, currentShiftEntryCount);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      setSaving(true);
      setError(null);

      try {
        if (editingSale) {
          await updateSale(restaurantId!, editingSale.id!, editingSale, {
            amount: Number(input.amount),
            paymentMethod: input.paymentMethod,
            entryName: input.entryName,
          });
        } else {
          const newSale: CreateSaleInput = {
            date: today,
            shift: input.shift,
            amount: Number(input.amount),
            paymentMethod: input.paymentMethod,
            entryName: input.entryName,
          };
          await createSale(restaurantId!, newSale);
        }
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save sale";
        setError(message);
        return { success: false, error: message };
      } finally {
        setSaving(false);
      }
    },
    [restaurantId, sales, today]
  );

  // ── Delete ──
  const removeSale = useCallback(
    async (sale: SaleEntry): Promise<{ success: boolean; error?: string }> => {
      if (!restaurantId || !sale.id) {
        return { success: false, error: "Restaurant not configured" };
      }

      if (sale.locked) {
        return { success: false, error: "This entry is locked and cannot be deleted" };
      }

      try {
        await deleteSale(restaurantId, sale.id, sale);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete sale";
        setError(message);
        return { success: false, error: message };
      }
    },
    [restaurantId]
  );

  // ── Lock / Unlock shift ──
  const toggleShiftLock = useCallback(
    async (shift: Shift, currentlyLocked: boolean): Promise<{ success: boolean; error?: string }> => {
      if (!restaurantId) {
        return { success: false, error: "Restaurant not configured" };
      }

      try {
        if (currentlyLocked) {
          await unlockShift(restaurantId, today, shift);
        } else {
          await lockShift(restaurantId, today, shift);
        }
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update shift lock";
        setError(message);
        return { success: false, error: message };
      }
    },
    [restaurantId, today]
  );

  // ── Derived data for UI ──
  const shiftTotal = useCallback((shift: Shift) => getShiftTotal(sales, shift), [sales]);
  const shiftPaymentBreakdown = useCallback(
    (shift: Shift) => getShiftPaymentBreakdown(sales, shift),
    [sales]
  );
  const shiftEntries = useCallback((shift: Shift) => getShiftEntries(sales, shift), [sales]);
  const shiftLocked = useCallback((shift: Shift) => checkShiftLocked(sales, shift), [sales]);

  const grandTotal = useMemo(() => getGrandTotal(sales), [sales]);

  return {
    sales,
    loading,
    saving,
    error,
    today,
    grandTotal,
    shiftTotal,
    shiftPaymentBreakdown,
    shiftEntries,
    shiftLocked,
    saveSale,
    removeSale,
    toggleShiftLock,
  };
}