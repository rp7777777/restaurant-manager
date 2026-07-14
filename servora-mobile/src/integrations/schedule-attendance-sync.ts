// ============================================
// SERVORA ERP — Schedule → Attendance Sync
// Cross-module integration: when a manager sets a Schedule day to
// HOLIDAY / SICK / VACATION / DO / DC, the corresponding Attendance
// record is automatically created or updated to reflect it.
//
// ✅ Schedule = Planned truth
// ✅ Attendance = Actual truth
// ✅ HOLIDAY / SICK / VACATION / DO / DC auto-sync
// ✅ WORK / ABSENT / TRAINING — reversal path: if the schedule
//    changes AWAY from a synced status back to WORK/ABSENT/TRAINING,
//    any stale SCHEDULE-originated Attendance record (never touched
//    by actual attendance) is cleared. MANUAL (manager-authored) and
//    CLOCK_IN (actual) records are NEVER touched by this reversal.
// ✅ attendanceSource: "SCHEDULE" tags records this sync creates,
//    distinguishing them from true manager-authored MANUAL entries
// ✅ Actual origin (attendanceSource === "CLOCK_IN" OR clockIn
//    present) always wins — sync never overwrites it
// ✅ Deterministic (employeeId_date) attendance ID fast path, with
//    a legacy random-ID query fallback for records created before
//    the deterministic-ID scheme existed
// ✅ Uses the actual found document's ID (deterministic or legacy)
//    for conflict checks, updates, and deletes
// ✅ updateAttendance()/createAttendance()/deleteAttendance() results
//    are always checked — a service-level failure is never reported
//    as success
// ✅ Employee data is always freshly fetched from the Employees
//    collection here, never copied from Schedule's own snapshot
// ✅ Never throws — always resolves with a ScheduleSyncResult, so a
//    sync failure can never block or crash the Schedule save flow
// FROZEN
// ============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
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
  updateAttendance,
  deleteAttendance,
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

// ── Schedule → Attendance status mapping ─────
const SYNCABLE_STATUS_MAP: Partial<
  Record<DayStatus, AttendanceStatus>
> = {
  HOLIDAY: "HOLIDAY",
  SICK: "SICK",
  VACATION: "VACATION",
  DO: "OFF",
  DC: "OFF",
};

// ── Attendance deterministic document ref ────
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

// ── Attendance collection ref ────────────────
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

// ── Employee document ref ────────────────────
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

// ── Resolve attendance record ────────────────
// Fast path: employeeId_date deterministic document.
// Legacy fallback: query employeeId + date to find old random-ID
// records that predate the deterministic-ID scheme.
//
// IMPORTANT: the actual found document's ID is returned so the
// caller can use it for conflict checks, updates, and deletes —
// a legacy record must be acted on in place, not treated as missing.
async function resolveAttendanceRecord(
  restaurantId: string,
  employeeId: string,
  date: string,
) {
  const deterministicId = `${employeeId}_${date}`;

  const deterministicSnap = await getDoc(
    attendanceDocRef(restaurantId, deterministicId)
  );

  if (deterministicSnap.exists()) {
    return mapAttendanceDoc(
      deterministicSnap.id,
      deterministicSnap.data() as Record<string, unknown>,
    );
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

  const legacyDoc = legacySnap.docs[0];

  return mapAttendanceDoc(
    legacyDoc.id,
    legacyDoc.data() as Record<string, unknown>,
  );
}

// ── Sync a single Schedule day to the Attendance module.
//    Call this after a Schedule day has been successfully saved.
//    normalDailyHours should be the restaurant's already-loaded
//    setting (from useApp()) — no need to refetch it here. ──
export async function syncScheduleDayToAttendance(
  restaurantId: string,
  employeeId: string,
  date: string,
  scheduleStatus: DayStatus,
  normalDailyHours: number,
): Promise<ScheduleSyncResult> {
  try {
    const attendanceStatus = SYNCABLE_STATUS_MAP[scheduleStatus];

    // ── Reversal path — schedule status is no longer one of the
    //    synced statuses (e.g. changed back to WORK/ABSENT/TRAINING).
    //    If a previously schedule-generated Attendance record exists
    //    for this day (attendanceSource === "SCHEDULE") and it was
    //    never touched by actual attendance (no clockIn), it's now
    //    stale — remove it. Manager-authored MANUAL records and
    //    actual CLOCK_IN records are NEVER touched here. ──
    if (!attendanceStatus) {
      const existing = await resolveAttendanceRecord(restaurantId, employeeId, date);

      if (existing && existing.attendanceSource === "SCHEDULE" && !existing.clockIn) {
        const deleteResult = await deleteAttendance(restaurantId, existing.id);
        if (!deleteResult.success) {
          return {
            success: false,
            error:
              deleteResult.error ??
              "Failed to clear stale schedule-derived attendance",
          };
        }
      }

      return {
        success: true,
        skipped: true,
      };
    }

    // ── Resolve deterministic OR legacy record ──
    const existing = await resolveAttendanceRecord(
      restaurantId,
      employeeId,
      date,
    );

    // ── Existing attendance ──────────────────
    if (existing) {
      // Actual truth always wins.
      //
      // Both checks are intentional: attendanceSource may remain
      // "CLOCK_IN" even if a manager later clears clockIn via the
      // edit form, since updateAttendance() never resets it.
      const hasActualOrigin =
        existing.attendanceSource === "CLOCK_IN" ||
        !!existing.clockIn;

      if (hasActualOrigin) {
        return {
          success: true,
          skipped: true,
        };
      }

      // IMPORTANT: use existing.id — this may be a legacy
      // random-ID attendance document, not the deterministic one.
      const updateResult = await updateAttendance({
        restaurantId,
        attendanceId: existing.id,
        status: attendanceStatus,
      });

      if (!updateResult.success) {
        return {
          success: false,
          error:
            updateResult.error ??
            "Failed to update attendance during schedule sync",
        };
      }

      return {
        success: true,
      };
    }

    // ── No attendance record — fetch the employee fresh ──
    const empSnap = await getDoc(
      employeeDocRef(restaurantId, employeeId)
    );

    if (!empSnap.exists()) {
      return {
        success: false,
        error: "Employee not found for schedule sync",
      };
    }

    const employee = mapEmployeeDoc(
      empSnap.id,
      empSnap.data() as Record<string, unknown>,
      restaurantId,
    );

    // ── Create attendance — tagged as SCHEDULE-origin, distinct
    //    from a true manager-authored MANUAL entry, so a later
    //    reversal knows it's safe to clear if the schedule changes
    //    away from a synced status. ──
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
        : "Schedule sync failed";

    return {
      success: false,
      error: message,
    };
  }
}