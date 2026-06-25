// ============================================
// SERVORA ERP — AttendanceCard Component
// ✅ Pure presentation component
// ✅ theme prop — no AppContext dependency
// ✅ Status badge with colors
// ✅ Clock In/Out display
// ✅ Worked hours + Late minutes
// ✅ Manager only edit/delete
// ✅ Initials crash protection
// ✅ BLOCKED_CLOCK_IN Set — future-proof
// ✅ isClockingIn/Out/Deleting — loading states
// ✅ Custom memo — all visible fields compared
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AttendanceRecord, AttendanceStatus } from "../types/attendance-types";
import { ATTENDANCE_STATUS_LABELS } from "../constants/attendance-status";
import {
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_BG_COLORS,
} from "../constants/attendance-status-colors";
import {
  formatDuration,
  formatLateMinutes,
} from "../utils/attendance-calculations";

// ✅ Future-proof — new status thapda yaha matra change
const BLOCKED_CLOCK_IN = new Set<AttendanceStatus>([
  "ABSENT",
  "HOLIDAY",
  "OFF",
  "VACATION",
  "SICK",
]);

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
}

interface Props {
  record:         AttendanceRecord;
  theme:          Theme;
  isManager:      boolean;
  isClockingIn?:  boolean;
  isClockingOut?: boolean;
  isDeleting?:    boolean;
  onEdit?:        (record: AttendanceRecord) => void;
  onDelete?:      (record: AttendanceRecord) => void;
  onClockIn?:     (record: AttendanceRecord) => void;
  onClockOut?:    (record: AttendanceRecord) => void;
}

// ✅ All visible fields compared — dark/light mode safe
function areEqual(prev: Props, next: Props): boolean {
  return (
    // ✅ Record — all visible fields
    prev.record.id                        === next.record.id                        &&
    prev.record.status                    === next.record.status                    &&
    prev.record.clockIn                   === next.record.clockIn                   &&
    prev.record.clockOut                  === next.record.clockOut                  &&
    prev.record.workedHours               === next.record.workedHours               &&
    prev.record.lateMinutes               === next.record.lateMinutes               &&
    prev.record.employeeName              === next.record.employeeName              &&
    prev.record.employeeNo                === next.record.employeeNo                &&
    prev.record.employeeSnapshot.position === next.record.employeeSnapshot.position &&
    // ✅ Loading states
    prev.isManager                        === next.isManager                        &&
    prev.isClockingIn                     === next.isClockingIn                     &&
    prev.isClockingOut                    === next.isClockingOut                    &&
    prev.isDeleting                       === next.isDeleting                       &&
    // ✅ Theme — all visible fields — dark/light mode safe
    prev.theme.bg                         === next.theme.bg                         &&
    prev.theme.surface                    === next.theme.surface                    &&
    prev.theme.text                       === next.theme.text                       &&
    prev.theme.textSecondary              === next.theme.textSecondary              &&
    prev.theme.border                     === next.theme.border
  );
}

function AttendanceCardComponent({
  record,
  theme,
  isManager,
  isClockingIn  = false,
  isClockingOut = false,
  isDeleting    = false,
  onEdit,
  onDelete,
  onClockIn,
  onClockOut,
}: Props) {

  // ✅ Initials crash protection
  const nameParts = record.employeeName.trim().split(" ");
  const initials  =
    nameParts.length >= 2 &&
    nameParts[0] &&
    nameParts[nameParts.length - 1]
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.[0] ?? "?").toUpperCase();

  const statusColor   = ATTENDANCE_STATUS_COLORS[record.status];
  const statusBgColor = ATTENDANCE_STATUS_BG_COLORS[record.status];
  const statusLabel   = ATTENDANCE_STATUS_LABELS[record.status];

  // ✅ BLOCKED_CLOCK_IN Set
  const canClockIn  = !record.clockIn && !BLOCKED_CLOCK_IN.has(record.status);
  const canClockOut = !!record.clockIn && !record.clockOut;

  return (
    <View style={[styles.card, {
      backgroundColor: theme.surface,
      borderColor:     theme.border,
      opacity:         isDeleting ? 0.5 : 1,
    }]}>

      {/* ── Avatar ── */}
      <View style={[styles.avatar, { backgroundColor: statusBgColor }]}>
        <Text style={[styles.avatarText, { color: statusColor }]}>
          {initials}
        </Text>
      </View>

      {/* ── Info ── */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: theme.text }]}
            numberOfLines={1}
          >
            {record.employeeName}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusBgColor }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          {record.employeeNo}
          {record.employeeSnapshot.position
            ? ` · ${record.employeeSnapshot.position}`
            : ""}
        </Text>

        {/* ── Clock Times ── */}
        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <MaterialIcons name="login" size={12} color={theme.textSecondary} />
            <Text style={[styles.timeText, { color: theme.text }]}>
              {record.clockIn ?? "--:--"}
            </Text>
          </View>
          <Text style={[styles.timeSep, { color: theme.textSecondary }]}>→</Text>
          <View style={styles.timeItem}>
            <MaterialIcons name="logout" size={12} color={theme.textSecondary} />
            <Text style={[styles.timeText, { color: theme.text }]}>
              {record.clockOut ?? "--:--"}
            </Text>
          </View>

          {record.workedHours > 0 && (
            <>
              <Text style={[styles.timeSep, { color: theme.textSecondary }]}>·</Text>
              <Text style={[styles.workedText, { color: theme.text }]}>
                {formatDuration(record.workedHours)}
              </Text>
            </>
          )}

          {record.lateMinutes > 0 && (
            <Text style={[styles.lateText, {
              color: ATTENDANCE_STATUS_COLORS.LATE,
            }]}>
              {formatLateMinutes(record.lateMinutes)}
            </Text>
          )}
        </View>
      </View>

      {/* ── Actions ── */}
      <View style={styles.actions}>

        {canClockIn && onClockIn && (
          <TouchableOpacity
            onPress={() => onClockIn(record)}
            disabled={isClockingIn}
            style={[styles.actionBtn, {
              backgroundColor: ATTENDANCE_STATUS_BG_COLORS.PRESENT,
              opacity:         isClockingIn ? 0.5 : 1,
            }]}
          >
            {isClockingIn ? (
              <ActivityIndicator
                size={14}
                color={ATTENDANCE_STATUS_COLORS.PRESENT}
              />
            ) : (
              <MaterialIcons
                name="login"
                size={16}
                color={ATTENDANCE_STATUS_COLORS.PRESENT}
              />
            )}
          </TouchableOpacity>
        )}

        {canClockOut && onClockOut && (
          <TouchableOpacity
            onPress={() => onClockOut(record)}
            disabled={isClockingOut}
            style={[styles.actionBtn, {
              backgroundColor: ATTENDANCE_STATUS_BG_COLORS.LATE,
              opacity:         isClockingOut ? 0.5 : 1,
            }]}
          >
            {isClockingOut ? (
              <ActivityIndicator
                size={14}
                color={ATTENDANCE_STATUS_COLORS.LATE}
              />
            ) : (
              <MaterialIcons
                name="logout"
                size={16}
                color={ATTENDANCE_STATUS_COLORS.LATE}
              />
            )}
          </TouchableOpacity>
        )}

        {isManager && (
          <>
            {onEdit && (
              <TouchableOpacity
                onPress={() => onEdit(record)}
                disabled={isDeleting}
                style={[styles.actionBtn, {
                  backgroundColor: theme.bg,
                  opacity:         isDeleting ? 0.5 : 1,
                }]}
              >
                <MaterialIcons
                  name="edit"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => onDelete(record)}
                disabled={isDeleting}
                style={[styles.actionBtn, {
                  backgroundColor: theme.bg,
                  opacity:         isDeleting ? 0.5 : 1,
                }]}
              >
                {isDeleting ? (
                  <ActivityIndicator
                    size={14}
                    color={ATTENDANCE_STATUS_COLORS.ABSENT}
                  />
                ) : (
                  <MaterialIcons
                    name="delete-outline"
                    size={16}
                    color={ATTENDANCE_STATUS_COLORS.ABSENT}
                  />
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

    </View>
  );
}

export const AttendanceCard = memo(AttendanceCardComponent, areEqual);

const styles = StyleSheet.create({
  card: {
    flexDirection:    "row",
    alignItems:       "center",
    padding:          12,
    marginHorizontal: 12,
    marginVertical:   4,
    borderRadius:     12,
    borderWidth:      1,
    gap:              10,
  },
  avatar: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize:   15,
    fontWeight: "800",
  },
  info: {
    flex: 1,
    gap:  3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    flexWrap:      "wrap",
  },
  name: {
    fontSize:   13,
    fontWeight: "700",
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      6,
  },
  badgeText: {
    fontSize:   10,
    fontWeight: "700",
  },
  sub: {
    fontSize: 11,
  },
  timeRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    flexWrap:      "wrap",
    marginTop:     2,
  },
  timeItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
  },
  timeText: {
    fontSize:   12,
    fontWeight: "600",
  },
  timeSep: {
    fontSize: 11,
  },
  workedText: {
    fontSize:   12,
    fontWeight: "700",
  },
  lateText: {
    fontSize:   11,
    fontWeight: "600",
  },
  actions: {
    gap: 6,
  },
  actionBtn: {
    width:          32,
    height:         32,
    borderRadius:   8,
    alignItems:     "center",
    justifyContent: "center",
  },
});