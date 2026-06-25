// ============================================
// SERVORA ERP — useAttendance Hook
// ✅ Daily attendance subscription
// ✅ Date navigation
// ✅ restaurantId undefined — cleared
// ✅ No business logic
// ============================================

import { useEffect, useState, useMemo } from "react";
import { AttendanceRecord, AttendanceFilter } from "../types/attendance-types";
import { subscribeToAttendanceByDate } from "../firestore/attendance-repository";

// ── Filter function ───────────────────────────
export function filterAttendance(
  records: AttendanceRecord[],
  filter: AttendanceFilter,
): AttendanceRecord[] {
  return records.filter((r) => {
    if (filter.status !== "ALL" && r.status !== filter.status) return false;
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      return (
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeNo.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

// ── useAttendance ─────────────────────────────
export function useAttendance(
  restaurantId: string | undefined,
  date: string,
) {
  const [records,  setRecords]  = useState<AttendanceRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !date) {
      setRecords([]);
      setLoading(false);
      setError(null);
      return;
    }
    setRecords([]);
    setLoading(true);
    setError(null);

    return subscribeToAttendanceByDate(
      restaurantId,
      date,
      (data) => { setRecords(data); setLoading(false); },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load attendance";
        setError(message);
        setLoading(false);
      }
    );
  }, [restaurantId, date]);

  // ── Existing employee IDs ─────────────────
  const existingEmployeeIds = useMemo(
    () => new Set(records.map((r) => r.employeeId)),
    [records]
  );

  return { records, loading, error, existingEmployeeIds };
}