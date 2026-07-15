// ============================================
// SERVORA ERP — Schedule → Attendance Sync
// ✅ Schedule = Planned truth (initial source)
// ✅ Attendance = Actual truth (once clock-in happens)
// ✅ Full status coverage — every Schedule DayStatus now maps to
//    an Attendance status:
//    WORK → PRESENT, ABSENT → ABSENT, SICK → SICK,
//    VACATION → VACATION, HOLIDAY → HOLIDAY, DO/DC → OFF,
//    TRAINING → TRAINING
// ✅ Roster-based PRESENT — a SCHEDULE-origin record may be
//    PRESENT without an actual clock-in (attendance-service.ts's
//    guards allow this only for attendanceSource === "SCHEDULE")
// ✅ Actual CLOCK_IN / clockIn always wins — never overwritten
// ✅ Forward-sync allowlist: only records this sync itself
//    created (attendanceSource === "SCHEDULE") are ever updated.
//    MANUAL, CLOCK_IN, and unknown/undefined-origin legacy
//    records are ALL protected by default.
// ✅ Reversal cleanup kept as a defensive fallback for any future
//    DayStatus added without a mapping (currently unreachable
//    since every status maps to something, by design)
// ✅ Existing-record mutation protected by transaction
// ✅ Deterministic ID + legacy random-ID fallback
// ✅ Employee snapshot fetched fresh on create
// ✅ Scheduled shift times (start/end/hours) passed through so a
//    later actual clock-in can still compute lateness correctly
// ✅ Service create/update results always checked
// ✅ Never throws to caller — returns ScheduleSyncResult
// ✅ syncScheduleDaysToAttendance() — batch helper with bounded
//    concurrency (chunks of 50)
// ✅ cleanupScheduleOriginAttendance() — used when a whole Schedule
//    is deleted, to remove the SCHEDULE-origin Attendance records it
//    generated for that week. Only deletes records whose origin is
//    confirmed "SCHEDULE" with no clockIn — CLOCK_IN/MANUAL/actual
//    records are never touched.
// FROZEN
// ============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase";

import {
  DayStatus,
} from "../app/schedule-module/types/schedule-types";

import {
  AttendanceStatus,
} from "../app/attendance-module/types/attendance-types";

import {
  mapAttendanceDoc,
} from "../app/attendance-module/firestore/attendance-repository";

import {
  createAttendance,
} from "../app/attendance-module/services/attendance-service";

import {
  mapEmployeeDoc,
} from "../app/employees-module/firestore/employee-repository";

// ── Result ────────────────────────────────────
export interface ScheduleSyncResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

// ── Schedule → Attendance mapping — every DayStatus now maps to
//    an Attendance status. WORK maps to PRESENT (roster-based,
//    no clock-in required for SCHEDULE-origin records). ──
const SYNCABLE_STATUS_MAP: Partial<
  Record<DayStatus, AttendanceStatus>
> = {
  WORK: "PRESENT",
  ABSENT: "ABSENT",
  HOLIDAY: "HOLIDAY",
  SICK: "SICK",
  VACATION: "VACATION",
  DO: "OFF",
  DC: "OFF",
  TRAINING: "TRAINING",
};

// ── Attendance document ref ───────────────────
function attendanceDocRef(
  restaurantId: string,
  attendanceId: string,
) {
  return doc(
    db,
    "restaurants",
    restaurantId,
    "attendance",
    attendanceId,
  );
}

// ── Attendance collection ref ─────────────────
function attendanceCollectionRef(
  restaurantId: string,
) {
  return collection(
    db,
    "restaurants",
    restaurantId,
    "attendance",
  );
}

// ── Employee document ref ─────────────────────
function employeeDocRef(
  restaurantId: string,
  employeeId: string,
) {
  return doc(
    db,
    "restaurants",
    restaurantId,
    "employees",
    employeeId,
  );
}

// ── Resolve attendance document ID ────────────
// Deterministic fast path first.
// Legacy employeeId + date fallback second.
//
// Returns the REAL Firestore document ID so legacy records
// are mutated in place.
async function resolveAttendanceId(
  restaurantId: string,
  employeeId: string,
  date: string,
): Promise<string | null> {
  const deterministicId = `${employeeId}_${date}`;

  const deterministicSnap = await getDoc(
    attendanceDocRef(
      restaurantId,
      deterministicId,
    )
  );

  if (deterministicSnap.exists()) {
    return deterministicSnap.id;
  }

  const legacySnap = await getDocs(
    query(
      attendanceCollectionRef(restaurantId),
      where("employeeId", "==", employeeId),
      where("date", "==", date),
      limit(1),
    )
  );

  if (legacySnap.empty) {
    return null;
  }

  return legacySnap.docs[0].id;
}

// ── Sync one Schedule day → Attendance ────────
// scheduledStart/scheduledEnd/scheduledHours are the Schedule day's
// own planned shift times (only meaningful for WORK days) — passed
// through so a later actual clock-in can still compute lateness.
export async function syncScheduleDayToAttendance(
  restaurantId: string,
  employeeId: string,
  date: string,
  scheduleStatus: DayStatus,
  normalDailyHours: number,
  scheduledStart?: string,
  scheduledEnd?: string,
  scheduledHours?: number,
): Promise<ScheduleSyncResult> {
  try {
    const attendanceStatus =
      SYNCABLE_STATUS_MAP[scheduleStatus];

    const existingAttendanceId =
      await resolveAttendanceId(
        restaurantId,
        employeeId,
        date,
      );

    // ==========================================
    // EXISTING ATTENDANCE RECORD
    // ==========================================
    if (existingAttendanceId) {
      const ref = attendanceDocRef(
        restaurantId,
        existingAttendanceId,
      );

      const transactionResult =
        await runTransaction(
          db,
          async (transaction) => {
            const snap = await transaction.get(ref);

            if (!snap.exists()) {
              return "MISSING" as const;
            }

            const existing = mapAttendanceDoc(
              snap.id,
              snap.data() as Record<string, unknown>,
            );

            // ── Actual truth always wins — never touched. ──
            const hasActualOrigin =
              existing.attendanceSource === "CLOCK_IN" ||
              !!existing.clockIn;

            if (hasActualOrigin) {
              return "ACTUAL_SKIP" as const;
            }

            // ── Reversal cleanup — defensive fallback only.
            //    Currently unreachable since every DayStatus maps to
            //    an Attendance status above, but kept in case a
            //    future DayStatus is added without a mapping. ──
            if (!attendanceStatus) {
              if (
                existing.attendanceSource === "SCHEDULE"
              ) {
                transaction.delete(ref);
                return "DELETED" as const;
              }

              return "NOOP_SKIP" as const;
            }

            // ── Forward-sync allowlist: ONLY a record this sync
            //    itself created (attendanceSource === "SCHEDULE")
            //    may be updated below. Anything else — MANUAL,
            //    CLOCK_IN, or an unknown/undefined-origin legacy
            //    record — is left alone.
            //    "SCHEDULE owns only SCHEDULE records." ──
            if (existing.attendanceSource !== "SCHEDULE") {
              return "PROTECTED_SKIP" as const;
            }

            // ── Sync new planned status ───────
            //
            // Safe: this record's origin is confirmed to be this
            // sync itself, so it may transition freely between
            // PRESENT/ABSENT/SICK/VACATION/HOLIDAY/OFF/TRAINING as
            // the Schedule changes (attendance-service.ts's guards
            // allow PRESENT without a clock-in for SCHEDULE origin).
            transaction.update(ref, {
              status: attendanceStatus,
              attendanceSource: "SCHEDULE",
              scheduledStart: scheduledStart ?? null,
              scheduledEnd: scheduledEnd ?? null,
              scheduledHours: scheduledHours ?? null,
              workedHours: 0,
              overtimeHours: 0,
              lateMinutes: 0,
              updatedAt: serverTimestamp(),
            });

            return "UPDATED" as const;
          }
        );

      if (
        transactionResult === "ACTUAL_SKIP" ||
        transactionResult === "NOOP_SKIP" ||
        transactionResult === "PROTECTED_SKIP"
      ) {
        return {
          success: true,
          skipped: true,
        };
      }

      // Record disappeared between resolve and transaction.
      // Continue to create path only when the new Schedule status
      // is syncable.
      if (
        transactionResult !== "MISSING" ||
        !attendanceStatus
      ) {
        return {
          success: true,
        };
      }
    }

    // ==========================================
    // NO EXISTING ATTENDANCE RECORD
    // ==========================================

    // No mapping for this DayStatus (defensive fallback — currently
    // every DayStatus has a mapping above).
    if (!attendanceStatus) {
      return {
        success: true,
        skipped: true,
      };
    }

    // ── Fetch employee fresh ──────────────────
    const empSnap = await getDoc(
      employeeDocRef(
        restaurantId,
        employeeId,
      )
    );

    if (!empSnap.exists()) {
      return {
        success: false,
        error:
          "Employee not found for schedule attendance sync",
      };
    }

    const employee = mapEmployeeDoc(
      empSnap.id,
      empSnap.data() as Record<string, unknown>,
      restaurantId,
    );

    // ── Create Schedule-origin Attendance ─────
    const createResult = await createAttendance({
      restaurantId,
      employee,
      date,
      status: attendanceStatus,
      breakMinutes: 0,
      normalDailyHours,
      scheduledStart,
      scheduledEnd,
      scheduledHours,
      attendanceSource: "SCHEDULE",
    });

    if (!createResult.success) {
      return {
        success: false,
        error:
          createResult.error ??
          "Failed to create attendance during schedule sync",
      };
    }

    return {
      success: true,
    };

  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Schedule attendance sync failed";

    return {
      success: false,
      error: message,
    };
  }
}

// ── Batch item shape for the centralized helper below ──
export interface ScheduleSyncItem {
  employeeId: string;
  date: string;
  status: DayStatus;
  startTime?: string;
  endTime?: string;
  hours?: number;
}

export interface ScheduleSyncFailure {
  employeeId: string;
  date: string;
  error?: string;
}

export interface ScheduleBatchSyncResult {
  failures: ScheduleSyncFailure[];
}

// ── Max concurrent sync/cleanup calls in flight at once. ──
const SYNC_CONCURRENCY_LIMIT = 50;

// ── Centralized batch sync helper ─────────────
// A convenience wrapper that runs syncScheduleDayToAttendance() over
// a list of items with bounded concurrency, and collects failures
// into a single list.
//
// NOTE: this centralizes the batching/failure-collection LOGIC only —
// it does not and cannot enforce that every Schedule write path
// actually calls it. Each write path still has to explicitly call
// this helper after its own write succeeds. ──
export async function syncScheduleDaysToAttendance(
  restaurantId: string,
  items: ScheduleSyncItem[],
  normalDailyHours: number,
): Promise<ScheduleBatchSyncResult> {
  if (items.length === 0) {
    return { failures: [] };
  }

  const failures: ScheduleSyncFailure[] = [];

  for (let i = 0; i < items.length; i += SYNC_CONCURRENCY_LIMIT) {
    const chunk = items.slice(i, i + SYNC_CONCURRENCY_LIMIT);

    const outcomes = await Promise.allSettled(
      chunk.map((item) =>
        syncScheduleDayToAttendance(
          restaurantId,
          item.employeeId,
          item.date,
          item.status,
          normalDailyHours,
          item.startTime,
          item.endTime,
          item.hours,
        )
      )
    );

    outcomes.forEach((outcome, idx) => {
      const item = chunk[idx];
      if (outcome.status === "rejected") {
        failures.push({
          employeeId: item.employeeId,
          date: item.date,
          error: outcome.reason instanceof Error
            ? outcome.reason.message
            : "Unknown sync error",
        });
      } else if (!outcome.value.success) {
        failures.push({
          employeeId: item.employeeId,
          date: item.date,
          error: outcome.value.error,
        });
      }
    });
  }

  return { failures };
}

// ── Clean up a single day's SCHEDULE-origin Attendance record.
//    Only deletes if the resolved record's origin is confirmed
//    "SCHEDULE" AND it has no clockIn — CLOCK_IN, MANUAL, and any
//    record with an actual clockIn are NEVER touched. ──
async function cleanupOneScheduleOriginDay(
  restaurantId: string,
  employeeId: string,
  date: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const attendanceId = await resolveAttendanceId(restaurantId, employeeId, date);
    if (!attendanceId) {
      return { success: true }; // nothing to clean up
    }

    const ref = attendanceDocRef(restaurantId, attendanceId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;

      const existing = mapAttendanceDoc(snap.id, snap.data() as Record<string, unknown>);

      // Never touch actual or manager-authored records.
      if (existing.attendanceSource !== "SCHEDULE") return;
      if (existing.clockIn) return; // extra safety — actual truth wins

      transaction.delete(ref);
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cleanup failed";
    return { success: false, error: message };
  }
}

// ── Clean up all SCHEDULE-origin Attendance records for a list of
//    dates (used when an entire Schedule week is deleted). Only
//    ever removes records this sync itself created — CLOCK_IN,
//    MANUAL, and unknown-origin records are always left alone. ──
export async function cleanupScheduleOriginAttendance(
  restaurantId: string,
  employeeId: string,
  dates: string[],
): Promise<ScheduleBatchSyncResult> {
  if (dates.length === 0) {
    return { failures: [] };
  }

  const failures: ScheduleSyncFailure[] = [];

  for (let i = 0; i < dates.length; i += SYNC_CONCURRENCY_LIMIT) {
    const chunk = dates.slice(i, i + SYNC_CONCURRENCY_LIMIT);

    const outcomes = await Promise.allSettled(
      chunk.map((date) => cleanupOneScheduleOriginDay(restaurantId, employeeId, date))
    );

    outcomes.forEach((outcome, idx) => {
      const date = chunk[idx];
      if (outcome.status === "rejected") {
        failures.push({
          employeeId, date,
          error: outcome.reason instanceof Error ? outcome.reason.message : "Unknown cleanup error",
        });
      } else if (!outcome.value.success) {
        failures.push({ employeeId, date, error: outcome.value.error });
      }
    });
  }

  return { failures };
}