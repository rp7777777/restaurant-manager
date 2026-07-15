// ============================================
// SERVORA ERP — Schedule → Attendance Sync
// ✅ Schedule = Planned truth
// ✅ Attendance = Actual truth
// ✅ HOLIDAY / SICK / VACATION / DO / DC auto-sync
// ✅ SCHEDULE-origin reversal cleanup
//    HOLIDAY → WORK/ABSENT/TRAINING removes stale
//    Schedule-created Attendance record
// ✅ Actual CLOCK_IN / clockIn always wins
// ✅ MANUAL (manager-authored) records are never overwritten,
//    relabeled, or deleted by this sync — forward-sync only
//    touches SCHEDULE-origin or unlabeled/legacy records
// ✅ Existing-record mutation protected by transaction
// ✅ Deterministic ID + legacy random-ID fallback
// ✅ Employee snapshot fetched fresh on create
// ✅ Restaurant normalDailyHours passed from settings
// ✅ Service create result always checked
// ✅ Never throws to caller — returns ScheduleSyncResult
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

// ── Schedule → Attendance mapping ─────────────
const SYNCABLE_STATUS_MAP: Partial<
  Record<DayStatus, AttendanceStatus>
> = {
  HOLIDAY: "HOLIDAY",
  SICK: "SICK",
  VACATION: "VACATION",
  DO: "OFF",
  DC: "OFF",
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
export async function syncScheduleDayToAttendance(
  restaurantId: string,
  employeeId: string,
  date: string,
  scheduleStatus: DayStatus,
  normalDailyHours: number,
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

            // ── Reversal cleanup ──────────────
            //
            // Example:
            // Schedule HOLIDAY
            // → Attendance HOLIDAY / SCHEDULE
            //
            // Manager later changes Schedule to WORK.
            //
            // WORK is not auto-synced, but the old Schedule-created
            // HOLIDAY attendance must not remain stale.
            //
            // Only SCHEDULE-origin records are deleted. A MANUAL
            // (manager-authored) record is never touched here.
            if (!attendanceStatus) {
              if (
                existing.attendanceSource === "SCHEDULE"
              ) {
                transaction.delete(ref);
                return "DELETED" as const;
              }

              return "NOOP_SKIP" as const;
            }

            // ── Forward-sync guard: a MANUAL (manager-authored)
            //    record is the manager's own planned entry for this
            //    day. It must never be silently overwritten or
            //    relabeled as SCHEDULE-origin here, even though it
            //    has no actual clockIn — only SCHEDULE-origin or
            //    unlabeled/legacy records may be updated below. ──
            if (existing.attendanceSource === "MANUAL") {
              return "MANUAL_SKIP" as const;
            }

            // ── Sync new planned status ───────
            //
            // Existing non-actual, non-manual record can safely
            // become the new Schedule-planned attendance state.
            transaction.update(ref, {
              status: attendanceStatus,
              attendanceSource: "SCHEDULE",
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
        transactionResult === "MANUAL_SKIP"
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

    // WORK / ABSENT / TRAINING do not create Attendance.
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