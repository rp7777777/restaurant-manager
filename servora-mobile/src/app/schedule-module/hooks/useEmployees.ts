// ============================================
// SERVORA ERP — useEmployees Hook
// ✅ onError callback used
// ✅ restaurantId undefined — employees cleared
// ✅ employeeMap — useMemo
// ✅ getEmployeeByNo — useCallback
// ✅ error message from error object
// ============================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { EmployeeDB } from "../types/employee-types";
import { subscribeToEmployees } from "../firestore/employee-repository";

export function useEmployees(restaurantId: string | undefined) {
  const [employees, setEmployees] = useState<EmployeeDB[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      // ✅ undefined bhaye pani clear
      setEmployees([]);
      setLoading(false);
      setError(null);
      return;
    }

    // ✅ restaurantId change — clear first
    setEmployees([]);
    setLoading(true);
    setError(null);

    const unsub = subscribeToEmployees(
      restaurantId,
      (data) => {
        setEmployees(data);
        setLoading(false);
      },
      // ✅ Error from error object — not hardcoded
      (err: unknown) => {
        console.error("useEmployees error:", err);
        const message = err instanceof Error
          ? err.message
          : "Failed to load employees";
        setError(message);
        setLoading(false);
      }
    );

    return unsub;
  }, [restaurantId]);

  // ✅ useMemo — not rebuilt every render
  const employeeMap = useMemo(
    () => employees.reduce<Record<string, EmployeeDB>>(
      (map, emp) => { map[emp.employeeNo] = emp; return map; },
      {}
    ),
    [employees]
  );

  // ✅ useCallback — not recreated every render
  const getEmployeeByNo = useCallback(
    (employeeNo: string): EmployeeDB | undefined =>
      employeeMap[employeeNo],
    [employeeMap]
  );

  return { employees, loading, error, getEmployeeByNo, employeeMap };
}