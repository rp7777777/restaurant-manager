// ============================================
// SERVORA ERP — Attendance Repository
// ✅ Repository = Data Only
// ✅ isValidAttendanceStatus — safe mapper
// ✅ Firestore composite index notes added
// ✅ No business logic, no settings, no context
// FROZEN
// ============================================

import {
  collection, doc, onSnapshot,
  query, where, orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../firebase";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceEmployeeSnapshot,
  AttendanceSource,
} from "../types/attendance-types";
import { Timestamp } from "firebase/firestore";
import { isValidAttendanceStatus } from "../constants/attendance-status";

// ── Collection ref ────────────────────────────
const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "attendance");

// ── Mapper ────────────────────────────────────
export function mapAttendanceDoc(
  id: string,
  data: Record<string, unknown>,
): AttendanceRecord {
  const snapshot = (data.employeeSnapshot as Record<string, unknown> | undefined) ?? {};

  const employeeSnapshot: AttendanceEmployeeSnapshot = {
    hourlyRate:    Number(snapshot.hourlyRate    ?? 0),
    monthlySalary: Number(snapshot.monthlySalary ?? 0),
    position:      (snapshot.position as string  | undefined) ?? "",
  };

  // ✅ Safe status validation — invalid value → ABSENT
  const rawStatus = data.status;
  const status: AttendanceStatus =
    typeof rawStatus === "string" && isValidAttendanceStatus(rawStatus)
      ? rawStatus
      : "ABSENT";

  return {
    id,
    restaurantId:   (data.restaurantId   as string) ?? "",
    employeeId:     (data.employeeId     as string) ?? "",
    employeeNo:     (data.employeeNo     as string) ?? "",
    employeeName:   (data.employeeName   as string) ?? "",
    date:           (data.date           as string) ?? "",
    status,
    attendanceSource: (data.attendanceSource as AttendanceSource | undefined),
    scheduledStart: (data.scheduledStart as string | undefined),
    scheduledEnd:   (data.scheduledEnd   as string | undefined),
    scheduledHours: data.scheduledHours !== undefined
      ? Number(data.scheduledHours) : undefined,
    clockIn:        (data.clockIn        as string | undefined),
    clockOut:       (data.clockOut       as string | undefined),
    breakMinutes:   Number(data.breakMinutes  ?? 0),
    workedHours:    Number(data.workedHours   ?? 0),
    overtimeHours:  Number(data.overtimeHours ?? 0),
    lateMinutes:    Number(data.lateMinutes   ?? 0),
    employeeSnapshot,
    branchId:       (data.branchId       as string | undefined),
    departmentId:   (data.departmentId   as string | undefined),
    createdAt:      data.createdAt as Timestamp | undefined,
    updatedAt:      data.updatedAt as Timestamp | undefined,
  };
}

// ── Subscribe by date ─────────────────────────
// Used by: AttendanceScreen — daily view
// Firestore index: date ASC, employeeName ASC
export function subscribeToAttendanceByDate(
  restaurantId: string,
  date: string,
  onData: (records: AttendanceRecord[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(
    col(restaurantId),
    where("date", "==", date),
    orderBy("employeeName", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) =>
        mapAttendanceDoc(d.id, d.data() as Record<string, unknown>)
      ));
    },
    (error) => {
      console.error("Attendance subscribe error:", error);
      onError?.(error);
      onData([]);
    }
  );
}

// ── Subscribe by date range ───────────────────
// Used by: Payroll — monthly attendance
// Firestore index required:
//   date ASC, employeeName ASC
export function subscribeToAttendanceByRange(
  restaurantId: string,
  startDate: string,
  endDate: string,
  onData: (records: AttendanceRecord[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(
    col(restaurantId),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date",         "asc"),
    orderBy("employeeName", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) =>
        mapAttendanceDoc(d.id, d.data() as Record<string, unknown>)
      ));
    },
    (error) => {
      console.error("Attendance range subscribe error:", error);
      onError?.(error);
      onData([]);
    }
  );
}

// ── Subscribe by employee ─────────────────────
// Used by: Employee profile — history
// Firestore index required:
//   employeeId ASC, date ASC
export function subscribeToAttendanceByEmployee(
  restaurantId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
  onData: (records: AttendanceRecord[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(
    col(restaurantId),
    where("employeeId", "==", employeeId),
    where("date",       ">=", startDate),
    where("date",       "<=", endDate),
    orderBy("date", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) =>
        mapAttendanceDoc(d.id, d.data() as Record<string, unknown>)
      ));
    },
    (error) => {
      console.error("Attendance employee subscribe error:", error);
      onError?.(error);
      onData([]);
    }
  );
}

// ── Get by date (one-time) ────────────────────
// Used by: attendance-service — duplicate check
export async function getAttendanceByDate(
  restaurantId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const snap = await getDocs(
    query(col(restaurantId), where("date", "==", date))
  );
  return snap.docs.map((d) =>
    mapAttendanceDoc(d.id, d.data() as Record<string, unknown>)
  );
}