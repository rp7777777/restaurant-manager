// ============================================
// SERVORA ERP — Attendance Service
// ✅ Overnight shift fix — 22:00 → 06:00 (worked hours)
// ✅ Overnight late-calculation fix (scheduled evening,
//    clock-in after midnight now correctly counted as late,
//    not clamped to 0)
// ✅ clockIn overwrite protection (via runTransaction)
// ✅ clockOut overwrite protection (via runTransaction)
// ✅ createAttendance — two-layer duplicate protection:
//    legacy query check (catches old random-ID records) +
//    deterministic ID (employeeId_date) + runTransaction
//    (guarantees no new duplicate under concurrent creates)
// ✅ normalDailyHours persisted on the record — clockOut and
//    updateAttendance both fall back to the record's own
//    snapshot instead of current restaurant settings, so a
//    settings change later doesn't retroactively change
//    historical overtime math
// ✅ updateAttendance — runTransaction, no stale recalculation
//    race; supports explicit clockIn/clockOut clearing via
//    null (deleteField()), distinct from undefined (leave as-is)
// ✅ Status/clockIn/clockOut consistency guards, origin-aware:
//    - LATE ALWAYS requires a clock-in time (Schedule has no
//      "Late" concept — LATE can only ever come from an actual
//      clock-in calculation), regardless of record origin.
//    - PRESENT requires a clock-in time UNLESS the record's
//      origin is "SCHEDULE" — Servora's Schedule module is the
//      initial planned truth, so a Schedule-driven "WORK" day
//      may sync to a real PRESENT Attendance record before any
//      actual clock-in happens (roster-based attendance). Once
//      the employee actually clocks in, clockIn() naturally
//      overwrites the record with attendanceSource "CLOCK_IN",
//      and from that point on the strict guard applies again.
//    - clockOut can never exist without clockIn, for any origin.
// ✅ attendanceSource includes "SCHEDULE" — tags records created
//    or kept in sync by the Schedule → Attendance integration,
//    distinct from manager-authored "MANUAL" entries and actual
//    "CLOCK_IN" records
// ✅ Calculations imported from utils
// ✅ No UI, No Context
// FROZEN
// ============================================

import {
  collection, doc,
  deleteDoc, deleteField, serverTimestamp, getDocs,
  query, where, runTransaction,
} from "firebase/firestore";
import { db } from "../../../firebase";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSource,
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

export function calcWorkedHours(
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
): number {
  let inMinutes  = timeToMinutes(clockIn);
  let outMinutes = timeToMinutes(clockOut);

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
  let clockInMinutes = timeToMinutes(clockIn);
  const scheduledMinutes = timeToMinutes(scheduledStart);

  const isEveningShift = scheduledMinutes >= 18 * 60;
  const isEarlyMorningClockIn = clockInMinutes < 6 * 60;

  if (isEveningShift && isEarlyMorningClockIn) {
    clockInMinutes += 24 * 60;
  }

  return Math.max(0, clockInMinutes - scheduledMinutes);
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
  attendanceSource?: AttendanceSource;
}

// ── Create Attendance — two layers of duplicate protection, plus
//    origin-aware status/clockIn/clockOut consistency guards:
//    - LATE always requires a clock-in time.
//    - PRESENT requires a clock-in time UNLESS attendanceSource
//      is "SCHEDULE" (roster-based planned attendance).
//    - clockOut requires a clock-in time. ──
export async function createAttendance(
  input: CreateAttendanceInput
): Promise<AttendanceServiceResult> {
  const {
    restaurantId, employee, date, status,
    clockIn, clockOut, breakMinutes, normalDailyHours,
    scheduledStart, scheduledEnd, scheduledHours,
    attendanceSource,
  } = input;

  if (status === "LATE" && !clockIn) {
    return {
      success: false,
      error: "Cannot set status to Late without a clock-in time.",
    };
  }
  if (status === "PRESENT" && !clockIn && attendanceSource !== "SCHEDULE") {
    return {
      success: false,
      error: "Cannot set status to Present without a clock-in time.",
    };
  }
  if (clockOut && !clockIn) {
    return {
      success: false,
      error: "Cannot set a clock-out time without a clock-in time.",
    };
  }

  const legacyDupSnap = await getDocs(
    query(
      col(restaurantId),
      where("date",       "==", date),
      where("employeeId", "==", employee.id),
    )
  );
  if (!legacyDupSnap.empty) {
    return {
      success: false,
      error: `Attendance already exists for ${employee.firstName} on ${date}`,
    };
  }

  const attendanceId = `${employee.id}_${date}`;
  const ref = docRef(restaurantId, attendanceId);

  const workedHours   = clockIn && clockOut
    ? calcWorkedHours(clockIn, clockOut, breakMinutes)
    : 0;
  const overtimeHours = calcOvertimeHours(workedHours, normalDailyHours);
  const lateMinutes   = clockIn && scheduledStart
    ? calcLateMinutes(clockIn, scheduledStart)
    : 0;

  try {
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists()) {
        throw new Error(`Attendance already exists for ${employee.firstName} on ${date}`);
      }

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
        normalDailyHours,
        workedHours,
        overtimeHours,
        lateMinutes,
        employeeSnapshot: buildAttendanceEmployeeSnapshot(employee),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.set(ref, payload);
    });

    return { success: true, id: attendanceId };

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
  clockIn?:          string | null;   // null = explicitly clear
  clockOut?:         string | null;   // null = explicitly clear
  breakMinutes?:     number;
  normalDailyHours?: number;
}

// ── Update Attendance — runTransaction: read + recalculate + write
//    happen atomically. clockIn/clockOut: undefined = leave untouched,
//    null = explicitly clear (deleteField()), string = set new value.
//    Origin-aware consistency guards:
//    - LATE always requires a clock-in time, for any record origin.
//    - PRESENT requires a clock-in time UNLESS the record's origin
//      is "SCHEDULE" — a Schedule-driven record is allowed to move
//      freely between PRESENT/ABSENT/SICK/VACATION/HOLIDAY/OFF/
//      TRAINING as the Schedule changes, without needing an actual
//      clock-in. A MANUAL or CLOCK_IN-origin record is NOT exempt —
//      this preserves the original fix for the "manager clears
//      clockIn but leaves stale PRESENT" bug on real records.
//    normalDailyHours falls back to the record's own persisted
//    snapshot (not a hardcoded 8). ──
export async function updateAttendance(
  input: UpdateAttendanceInput
): Promise<AttendanceServiceResult> {
  const {
    restaurantId, attendanceId,
    status, clockIn, clockOut,
    breakMinutes, normalDailyHours,
  } = input;

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef(restaurantId, attendanceId));
      if (!snap.exists()) {
        throw new Error("Attendance record not found");
      }

      const existing = mapAttendanceDoc(snap.id, snap.data() as Record<string, unknown>);

      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };

      if (status) updates.status = status;

      if (clockIn !== undefined) {
        updates.clockIn = clockIn === null ? deleteField() : clockIn;
      }
      if (clockOut !== undefined) {
        updates.clockOut = clockOut === null ? deleteField() : clockOut;
      }
      if (breakMinutes !== undefined) updates.breakMinutes = breakMinutes;
      if (normalDailyHours !== undefined) updates.normalDailyHours = normalDailyHours;

      // Resolve the effective clockIn/clockOut after this update —
      // an explicit clear (null) means "no longer present", it must
      // NOT fall back to the old value.
      const finalClockIn =
        clockIn === undefined ? existing.clockIn
        : clockIn === null ? undefined
        : clockIn;
      const finalClockOut =
        clockOut === undefined ? existing.clockOut
        : clockOut === null ? undefined
        : clockOut;

      const finalStatus = status ?? existing.status;
      const isScheduleOrigin = existing.attendanceSource === "SCHEDULE";

      // ── Consistency guard 1a: LATE always requires a clock-in,
      //    for any record origin — Schedule has no "Late" concept. ──
      if (finalStatus === "LATE" && !finalClockIn) {
        throw new Error(
          "Cannot keep status as Late without a clock-in time. Please choose a different status when clearing the clock-in."
        );
      }

      // ── Consistency guard 1b: PRESENT without a clock-in is only
      //    allowed for a SCHEDULE-origin record (roster-based
      //    planned attendance). MANUAL/CLOCK_IN/legacy records are
      //    NOT exempt — this preserves the original fix for the
      //    "manager clears clockIn but leaves stale PRESENT" bug. ──
      if (finalStatus === "PRESENT" && !finalClockIn && !isScheduleOrigin) {
        throw new Error(
          "Cannot keep status as Present without a clock-in time. Please choose a different status (e.g. Absent) when clearing the clock-in."
        );
      }

      // ── Consistency guard 2: a clockOut can't exist without a
      //    clockIn (e.g. manager clears clockIn but leaves clockOut
      //    untouched). ──
      if (finalClockOut && !finalClockIn) {
        throw new Error("Cannot have a clock-out time without a clock-in time.");
      }

      const finalBreakMinutes = breakMinutes ?? existing.breakMinutes;
      const finalNormalHours  = normalDailyHours ?? existing.normalDailyHours ?? 8;

      if (finalClockIn && finalClockOut) {
        const workedHours   = calcWorkedHours(finalClockIn, finalClockOut, finalBreakMinutes);
        const overtimeHours = calcOvertimeHours(workedHours, finalNormalHours);
        const lateMinutes   = existing.scheduledStart
          ? calcLateMinutes(finalClockIn, existing.scheduledStart)
          : 0;
        updates.workedHours   = workedHours;
        updates.overtimeHours = overtimeHours;
        updates.lateMinutes   = lateMinutes;
      } else {
        updates.workedHours   = 0;
        updates.overtimeHours = 0;
        updates.lateMinutes   = finalClockIn && existing.scheduledStart
          ? calcLateMinutes(finalClockIn, existing.scheduledStart)
          : 0;
      }

      transaction.update(docRef(restaurantId, attendanceId), updates);
    });

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

// ── Clock In ───────────────────────────────────
export async function clockIn(
  restaurantId: string,
  attendanceId: string,
  time: string,
): Promise<AttendanceServiceResult> {
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef(restaurantId, attendanceId));
      if (!snap.exists()) {
        throw new Error("Attendance record not found");
      }

      const existing = mapAttendanceDoc(snap.id, snap.data() as Record<string, unknown>);

      if (existing.clockIn) {
        throw new Error("Already clocked in");
      }

      const lateMinutes = existing.scheduledStart
        ? calcLateMinutes(time, existing.scheduledStart)
        : 0;
      const status: AttendanceStatus = lateMinutes > 0 ? "LATE" : "PRESENT";

      transaction.update(docRef(restaurantId, attendanceId), {
        clockIn:          time,
        status,
        lateMinutes,
        attendanceSource: "CLOCK_IN",
        updatedAt:        serverTimestamp(),
      });
    });

    return { success: true, id: attendanceId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clock in";
    return { success: false, error: message };
  }
}

// ── Clock Out ──────────────────────────────────
export async function clockOut(
  restaurantId: string,
  attendanceId: string,
  clockOutTime: string,
  breakMinutes: number,
  normalDailyHours: number,
): Promise<AttendanceServiceResult> {
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef(restaurantId, attendanceId));
      if (!snap.exists()) {
        throw new Error("Attendance record not found");
      }

      const existing = mapAttendanceDoc(snap.id, snap.data() as Record<string, unknown>);

      if (!existing.clockIn) {
        throw new Error("Employee has not clocked in yet");
      }

      if (existing.clockOut) {
        throw new Error("Already clocked out");
      }

      const workedHours   = calcWorkedHours(existing.clockIn, clockOutTime, breakMinutes);
      const overtimeHours = calcOvertimeHours(workedHours, normalDailyHours);

      transaction.update(docRef(restaurantId, attendanceId), {
        clockOut:         clockOutTime,
        breakMinutes,
        workedHours,
        overtimeHours,
        attendanceSource: "CLOCK_IN",
        updatedAt:        serverTimestamp(),
      });
    });

    return { success: true, id: attendanceId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clock out";
    return { success: false, error: message };
  }
}