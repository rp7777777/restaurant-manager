// ============================================
// SERVORA ERP — useAttendanceStats Hook
// ✅ Single O(n) pass
// ✅ ?? 0 — NaN protection
// ✅ attendanceRate/absenceRate/lateRate — KPI ready
// ✅ Schedule vs Actual comparison
// ✅ No Firestore, No Context
// FROZEN
// ============================================

import { useMemo } from "react";
import { AttendanceRecord, AttendanceStats } from "../types/attendance-types";

export function useAttendanceStats(
  records: AttendanceRecord[]
): AttendanceStats {
  return useMemo(() => {
    const stats: AttendanceStats = {
      total:    records.length,
      present:  0,
      absent:   0,
      late:     0,
      sick:     0,
      vacation: 0,
      holiday:  0,
      off:      0,

      totalWorkedHours:    0,
      totalOvertimeHours:  0,
      totalLateMinutes:    0,
      totalScheduledHours: 0,
      hoursVariance:       0,

      attendanceRate: 0,
      absenceRate:    0,
      lateRate:       0,
    };

    // ✅ Single O(n) pass
    records.forEach((r) => {
      switch (r.status) {
        case "PRESENT":  stats.present++;  break;
        case "ABSENT":   stats.absent++;   break;
        case "LATE":     stats.late++;     break;
        case "SICK":     stats.sick++;     break;
        case "VACATION": stats.vacation++; break;
        case "HOLIDAY":  stats.holiday++;  break;
        case "OFF":      stats.off++;      break;
      }

      // ✅ ?? 0 — NaN protection
      stats.totalWorkedHours    += r.workedHours    ?? 0;
      stats.totalOvertimeHours  += r.overtimeHours  ?? 0;
      stats.totalLateMinutes    += r.lateMinutes     ?? 0;
      stats.totalScheduledHours += r.scheduledHours ?? 0;
    });

    // ✅ Round
    stats.totalWorkedHours    = parseFloat(stats.totalWorkedHours.toFixed(2));
    stats.totalOvertimeHours  = parseFloat(stats.totalOvertimeHours.toFixed(2));
    stats.totalScheduledHours = parseFloat(stats.totalScheduledHours.toFixed(2));
    stats.hoursVariance       = parseFloat(
      (stats.totalWorkedHours - stats.totalScheduledHours).toFixed(2)
    );

    // ✅ KPI rates — OFF + HOLIDAY excluded from working total
    const workingTotal = stats.total - stats.off - stats.holiday;

    stats.attendanceRate = workingTotal > 0
      ? parseFloat(((stats.present + stats.late) / workingTotal).toFixed(2))
      : 0;

    stats.absenceRate = workingTotal > 0
      ? parseFloat((stats.absent / workingTotal).toFixed(2))
      : 0;

    stats.lateRate = (stats.present + stats.late) > 0
      ? parseFloat((stats.late / (stats.present + stats.late)).toFixed(2))
      : 0;

    return stats;
  }, [records]);
}