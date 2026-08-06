// ============================================
// SERVORA ERP — useStockAdjustment Hook
// ✅ Thin wrapper around inventory-service.ts's adjustStock(), which
//    itself is a thin wrapper around stock-movement-service.ts's
//    recordStockMovement() — the single source of truth for ALL
//    inventory quantity changes. This hook adds NO business logic
//    of its own; it only owns UI-facing loading/error/success state
//    so StockAdjustmentModal.tsx doesn't need its own useState calls.
// ✅ movementType/quantity/reasonCategory/reason map 1:1 onto
//    RecordStockMovementInput — see stock-movement-module/types for
//    the full semantics (ADJUSTMENT quantity is an ABSOLUTE new
//    value; every other type is a positive delta to add/subtract).
// ✅ submitting — guards against double-submit re-entry, same
//    pattern as useInventoryForm.ts.
// ✅ reset() — clears error/success state; used when the modal is
//    closed/reopened for a different item so stale state from a
//    previous adjustment never leaks into the next one.
// ✅ Does NOT fetch or hold the inventory item itself — the caller
//    (StockAdjustmentModal.tsx) already has the item from
//    InventoryScreen's existing useInventory() subscription. This
//    hook only performs the write.
// FROZEN
// ============================================

import { useState, useCallback } from "react";
import { adjustStock } from "../services/inventory-service";
import {
  RecordStockMovementInput,
  StockMovementType,
  StockMovementReasonCategory,
} from "../../stock-movement-module/types/stock-movement";

export interface StockAdjustmentResult {
  movementId:     string;
  beforeQuantity: number;
  afterQuantity:  number;
  movementValue:  number;
}

export interface UseStockAdjustmentResult {
  submitting: boolean;
  error:      string | null;
  success:    StockAdjustmentResult | null;
  submit:     (
    restaurantId: string,
    inventoryId:  string,
    movementType: StockMovementType,
    quantity:     number,
    options?: {
      reasonCategory?: StockMovementReasonCategory;
      reason?:         string;
    }
  ) => Promise<StockAdjustmentResult | null>;
  reset: () => void;
}

export function useStockAdjustment(): UseStockAdjustmentResult {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<StockAdjustmentResult | null>(null);

  const submit = useCallback(async (
    restaurantId: string,
    inventoryId:  string,
    movementType: StockMovementType,
    quantity:     number,
    options?: {
      reasonCategory?: StockMovementReasonCategory;
      reason?:         string;
    }
  ): Promise<StockAdjustmentResult | null> => {
    if (submitting) return null; // guard against double-submit re-entry
    if (!restaurantId) {
      setError("Restaurant not configured");
      return null;
    }
    if (!inventoryId) {
      setError("No item selected");
      return null;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const input: RecordStockMovementInput = {
        inventoryId,
        movementType,
        quantity,
        reasonCategory: options?.reasonCategory,
        reason:         options?.reason,
        referenceType:  "MANUAL",
      };

      const result = await adjustStock(restaurantId, input);
      setSuccess(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to adjust stock";
      setError(msg);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return { submitting, error, success, submit, reset };
}