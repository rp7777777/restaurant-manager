// ============================================
// SERVORA ERP — useEmployees Hook
// ✅ employees-module master source
// ✅ useEmployees — ACTIVE + PROBATION + ON_LEAVE
// ✅ useAllEmployees — all statuses + archived toggle
// ✅ Single O(n) pass counts — useMemo
// ✅ restaurantId undefined — employees cleared
// FROZEN
// ============================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { EmployeeDB } from "../types/employee-types";
import {
  subscribeToAllEmployees,
  subscribeToEmployees,
} from "../firestore/employee-repository";

// ── useEmployees ──────────────────────────────
// Schedule/Payroll — ACTIVE + PROBATION + ON_LEAVE only
export function useEmployees(restaurantId: string | undefined) {
  const [employees, setEmployees] = useState<EmployeeDB[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setEmployees([]);
      setLoading(false);
      setError(null);
      return;
    }
    setEmployees([]);
    setLoading(true);
    setError(null);

    return subscribeToEmployees(
      restaurantId,
      (data) => { setEmployees(data); setLoading(false); },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load employees";
        setError(message);
        setLoading(false);
      }
    );
  }, [restaurantId]);

  const employeeMap = useMemo(
    () => employees.reduce<Record<string, EmployeeDB>>(
      (map, emp) => { map[emp.employeeNumber] = emp; return map; },
      {}
    ),
    [employees]
  );

  const getEmployeeByNo = useCallback(
    (employeeNumber: string): EmployeeDB | undefined =>
      employeeMap[employeeNumber],
    [employeeMap]
  );

  return { employees, loading, error, getEmployeeByNo, employeeMap };
}

// ── useAllEmployees ───────────────────────────
// Employee management screen — all statuses + archived toggle
export function useAllEmployees(
  restaurantId: string | undefined,
  includeArchived: boolean = false,
) {
  const [employees, setEmployees] = useState<EmployeeDB[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setEmployees([]);
      setLoading(false);
      setError(null);
      return;
    }
    setEmployees([]);
    setLoading(true);
    setError(null);

    return subscribeToAllEmployees(
      restaurantId,
      (data) => {
        const filtered = includeArchived
          ? data
          : data.filter((e) => !e.archived);
        setEmployees(filtered);
        setLoading(false);
      },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load employees";
        setError(message);
        setLoading(false);
      }
    );
  }, [restaurantId, includeArchived]);

  // ✅ Single O(n) pass — not 6x filter
  const counts = useMemo(() => {
    const result = {
      active:     0,
      probation:  0,
      inactive:   0,
      onLeave:    0,
      terminated: 0,
      archived:   0,
    };
    employees.forEach((e) => {
      if (e.archived) { result.archived++; return; }
      if (e.status === "ACTIVE")     result.active++;
      if (e.status === "PROBATION")  result.probation++;
      if (e.status === "INACTIVE")   result.inactive++;
      if (e.status === "ON_LEAVE")   result.onLeave++;
      if (e.status === "TERMINATED") result.terminated++;
    });
    return result;
  }, [employees]);

  return {
    employees,
    loading,
    error,
    counts,
  };
}