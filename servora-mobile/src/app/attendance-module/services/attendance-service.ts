// ============================================
// SERVORA ERP — Attendance Service
// ✅ Overnight shift fix — 22:00 → 06:00
// ✅ clockIn overwrite protection
// ✅ clockOut overwrite protection
// ✅ updateAttendance — fetch + merge + recalc
// ✅ clockOut — fetch clockIn from Firestore
// ✅ Duplicate check — targeted query
// ✅ Calculations imported from utils
// ✅ No UI, No Context
// FROZEN
// ============================================

import {
  collection, doc, addDoc, updateDoc,
  deleteDoc, serverTimestamp, getDoc, getDocs,
  query, where,
} from "firebase/firestore";
import { db } from "../../../firebase";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceEmployeeSnapshot,
} from "../types/attendance-types";
import { mapAttendanceDoc } from "../firestore/attendance-repository";
import { EmployeeDB } from "../../employees-module/types/employee-types";
import {
  timeToMinutes,
} from "../utils/attendance-calculations";

// ── Collection ref ────────────────────────────
const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "attendance");

const docRef = (restaurantId: string, attendanceId: string) =>
  doc(db, "restaurants", restaurantId, "attendance", attendanceId);

// ── Result type ───────────────────────────────
export interface AttendanceServiceResult {
  success: boolean;
  id?:     string;
  error?:  string;
}

// ── Strip undefined ───────────────────────────
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

// ── Calculation helpers ───────────────────────

// ✅ Overnight shift safe — imported timeToMinutes
export function calcWorkedHours(
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
): number {
  let inMinutes  = timeToMinutes(clockIn);
  let outMinutes = timeToMinutes(clockOut);

  // ✅ Overnight shift
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }

  const totalMinutes = outMinutes - inMinutes - breakMinutes;
  return Math.max(0, parseFloat((totalMinutes / 60).toFixed(2)));
}

export function calcLateMinutes(
  clockIn: string,
  scheduledStart: string,
): number {
  const diff = timeToMinutes(clockIn) - timeToMinutes(scheduledStart);
  return Math.max(0, diff);
}

export function calcOvertimeHours(
  workedHours: number,
  normalDailyHours: number,
): number {
  return Math.max(0, parseFloat((workedHours - normalDailyHours).toFixed(2)));
}

// ── Build employee snapshot ───────────────────
function buildAttendanceEmployeeSnapshot(
  emp: EmployeeDB
): AttendanceEmployeeSnapshot {
  return {
    hourlyRate:    emp.hourlyRate,
    monthlySalary: emp.monthlySalary,
    position:      emp.position,
  };
}

// ── Fetch existing attendance ─────────────────
async function fetchAttendance(
  restaurantId: string,
  attendanceId: string,
): Promise<AttendanceRecord | null> {
  const snap = await getDoc(docRef(restaurantId, attendanceId));
  if (!snap.exists()) return null;
  return mapAttendanceDoc(snap.id, snap.data() as Record<string, unknown>);
}

// ── Create Attendance ─────────────────────────
export interface CreateAttendanceInput {
  restaurantId:      string;
  employee:          EmployeeDB;
  date:              string;
  status:            AttendanceStatus;
  clockIn?:          string;
  clockOut?:         string;
  breakMinutes:      number;
  normalDailyHours:  number;
  scheduledStart?:   string;
  scheduledEnd?:     string;
  scheduledHours?:   number;
  attendanceSource?: "MANUAL" | "CLOCK_IN";
}

export async function createAttendance(
  input: CreateAttendanceInput
): Promise<AttendanceServiceResult> {
  const {
    restaurantId, employee, date, status,
    clockIn, clockOut, breakMinutes, normalDailyHours,
    scheduledStart, scheduledEnd, scheduledHours,
    attendanceSource,
  } = input;

  // ✅ Targeted duplicate check
  const dupSnap = await getDocs(
    query(
      col(restaurantId),
      where("date",       "==", date),
      where("employeeId", "==", employee.id),
    )
  );
  if (!dupSnap.empty) {
    return {
      success: false,
      error: `Attendance already exists for ${employee.firstName} on ${date}`,
    };
  }

  const workedHours   = clockIn && clockOut
    ? calcWorkedHours(clockIn, clockOut, breakMinutes)
    : 0;
  const overtimeHours = calcOvertimeHours(workedHours, normalDailyHours);
  const lateMinutes   = clockIn && scheduledStart
    ? calcLateMinutes(clockIn, scheduledStart)
    : 0;

  try {
    const payload = stripUndefined({
      restaurantId,
      employeeId:   employee.id,
      employeeNo:   employee.employeeNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      date,
      status,
      attendanceSource: attendanceSource ?? "MANUAL",
      scheduledStart,
      scheduledEnd,
      scheduledHours,
      clockIn,
      clockOut,
      breakMinutes,
      workedHours,
      overtimeHours,
      lateMinutes,
      employeeSnapshot: buildAttendanceEmployeeSnapshot(employee),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const ref = await addDoc(col(restaurantId), payload);
    return { success: true, id: ref.id };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create attendance";
    return { success: false, error: message };
  }
}

// ── Update Attendance ─────────────────────────
export interface UpdateAttendanceInput {
  restaurantId:      string;
  attendanceId:      string;
  status?:           AttendanceStatus;
  clockIn?:          string;
  clockOut?:         string;
  breakMinutes?:     number;
  normalDailyHours?: number;
}

export async function updateAttendance(
  input: UpdateAttendanceInput
): Promise<AttendanceServiceResult> {
  const {
    restaurantId, attendanceId,
    status, clockIn, clockOut,
    breakMinutes, normalDailyHours,
  } = input;

  try {
    const existing = await fetchAttendance(restaurantId, attendanceId);
    if (!existing) {
      return { success: false, error: "Attendance record not found" };
    }

    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };

    if (status)                    updates.status       = status;
    if (clockIn)                   updates.clockIn      = clockIn;
    if (clockOut)                  updates.clockOut     = clockOut;
    if (breakMinutes !== undefined) updates.breakMinutes = breakMinutes;

    const finalClockIn      = clockIn      ?? existing.clockIn;
    const finalClockOut     = clockOut     ?? existing.clockOut;
    const finalBreakMinutes = breakMinutes ?? existing.breakMinutes;
    const finalNormalHours  = normalDailyHours ?? 8;

    if (finalClockIn && finalClockOut) {
      const workedHours   = calcWorkedHours(finalClockIn, finalClockOut, finalBreakMinutes);
      const overtimeHours = calcOvertimeHours(workedHours, finalNormalHours);
      const lateMinutes   = existing.scheduledStart
        ? calcLateMinutes(finalClockIn, existing.scheduledStart)
        : 0;
      updates.workedHours   = workedHours;
      updates.overtimeHours = overtimeHours;
      updates.lateMinutes   = lateMinutes;
    }

    await updateDoc(docRef(restaurantId, attendanceId), updates);
    return { success: true, id: attendanceId };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update attendance";
    return { success: false, error: message };
  }
}

// ── Delete Attendance ─────────────────────────
export async function deleteAttendance(
  restaurantId: string,
  attendanceId: string,
): Promise<AttendanceServiceResult> {
  try {
    await deleteDoc(docRef(restaurantId, attendanceId));
    return { success: true, id: attendanceId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete attendance";
    return { success: false, error: message };
  }
}

// ── Clock In ──────────────────────────────────
export async function clockIn(
  restaurantId: string,
  attendanceId: string,
  time: string,
): Promise<AttendanceServiceResult> {
  try {
    const existing = await fetchAttendance(restaurantId, attendanceId);
    if (!existing) {
      return { success: false, error: "Attendance record not found" };
    }

    // ✅ Overwrite protection
    if (existing.clockIn) {
      return { success: false, error: "Already clocked in" };
    }

    const lateMinutes = existing.scheduledStart
      ? calcLateMinutes(time, existing.scheduledStart)
      : 0;
    const status: AttendanceStatus = lateMinutes > 0 ? "LATE" : "PRESENT";

    await updateDoc(docRef(restaurantId, attendanceId), {
      clockIn:          time,
      status,
      lateMinutes,
      attendanceSource: "CLOCK_IN",
      updatedAt:        serverTimestamp(),
    });
    return { success: true, id: attendanceId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clock in";
    return { success: false, error: message };
  }
}

// ── Clock Out ─────────────────────────────────
export async function clockOut(
  restaurantId: string,
  attendanceId: string,
  clockOutTime: string,
  breakMinutes: number,
  normalDailyHours: number,
): Promise<AttendanceServiceResult> {
  try {
    const existing = await fetchAttendance(restaurantId, attendanceId);
    if (!existing) {
      return { success: false, error: "Attendance record not found" };
    }
    if (!existing.clockIn) {
      return { success: false, error: "Employee has not clocked in yet" };
    }

    // ✅ Overwrite protection
    if (existing.clockOut) {
      return { success: false, error: "Already clocked out" };
    }

    const workedHours   = calcWorkedHours(existing.clockIn, clockOutTime, breakMinutes);
    const overtimeHours = calcOvertimeHours(workedHours, normalDailyHours);

    await updateDoc(docRef(restaurantId, attendanceId), {
      clockOut:         clockOutTime,
      breakMinutes,
      workedHours,
      overtimeHours,
      attendanceSource: "CLOCK_IN",
      updatedAt:        serverTimestamp(),
    });
    return { success: true, id: attendanceId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clock out";
    return { success: false, error: message };
  }
}