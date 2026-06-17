// ============================================
// SERVORA ERP — usePayroll Hook
// ✅ Raw data only — no duplicate summary
// ✅ Summary = buildPayrollSummary() bata
// ✅ normalizedMonth — trim once
// ✅ error object passed
// ============================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { PayrollDocument } from "../types/payroll-types";
import { subscribeToPayroll } from "../firestore/payroll-repository";

export function usePayroll(
  restaurantId: string | undefined,
  month: string
) {
  const [payrolls, setPayrolls] = useState<PayrollDocument[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const normalizedMonth = month.trim();

    if (!restaurantId || !normalizedMonth) {
      setPayrolls([]);
      setLoading(false);
      setError(null);
      return;
    }

    setPayrolls([]);
    setLoading(true);
    setError(null);

    const unsub = subscribeToPayroll(
      restaurantId,
      normalizedMonth,
      (data) => {
        setPayrolls(data);
        setLoading(false);
      },
      (err?: unknown) => {
        console.error("usePayroll error:", err);
        const message = err instanceof Error
          ? err.message
          : "Failed to load payroll";
        setError(message);
        setLoading(false);
      }
    );

    return unsub;
  }, [restaurantId, month]);

  // ✅ payrollMap — useMemo
  const payrollMap = useMemo(
    () => payrolls.reduce<Record<string, PayrollDocument>>(
      (map, p) => { map[p.employeeNo] = p; return map; },
      {}
    ),
    [payrolls]
  );

  // ✅ useCallback
  const getPayrollByEmployeeNo = useCallback(
    (employeeNo: string): PayrollDocument | undefined =>
      payrollMap[employeeNo],
    [payrollMap]
  );

  // ✅ Raw data only — summary buildPayrollSummary() bata
  return {
    payrolls,
    loading,
    error,
    payrollMap,
    getPayrollByEmployeeNo,
  };
}