// ============================================
// SERVORA ERP — ClockInOutModal Component
// ✅ Clock In / Clock Out UI
// ✅ Current time auto-fill
// ✅ HH:mm validation — 00:00–23:59
// ✅ Overnight shift display
// ✅ employeeSnapshot?.position — crash safe
// ✅ breakMinutes — Math.floor integer safe
// ✅ previewHours — negative break protection
// ✅ Pure presentation — no Firestore
// ✅ theme prop — no AppContext dependency
// FROZEN
// ============================================

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, Modal, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AttendanceRecord } from "../types/attendance-types";
import { ATTENDANCE_STATUS_COLORS } from "../constants/attendance-status-colors";
import { formatDuration } from "../utils/attendance-calculations";

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
  error?:        string;
}

// ── Current local time ────────────────────────
function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

// ── HH:mm validation ─────────────────────────
function isValidTime(value: string): boolean {
  if (!value.trim()) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

// ── Preview worked hours ──────────────────────
// ✅ Fix #1 — negative break protection
function previewHours(
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
): number | null {
  if (!isValidTime(clockIn) || !isValidTime(clockOut)) return null;
  const [inH, inM]   = clockIn.split(":").map(Number);
  const [outH, outM] = clockOut.split(":").map(Number);
  let inMins  = inH  * 60 + inM;
  let outMins = outH * 60 + outM;
  // ✅ Overnight shift
  if (outMins < inMins) outMins += 24 * 60;
  const shiftMinutes = outMins - inMins;
  // ✅ break cannot exceed shift duration
  const safeBreak = Math.min(Math.max(0, breakMinutes), shiftMinutes);
  const total     = shiftMinutes - safeBreak;
  return Math.max(0, parseFloat((total / 60).toFixed(2)));
}

interface Props {
  visible:             boolean;
  record:              AttendanceRecord | null;
  mode:                "clockIn" | "clockOut";
  theme:               Theme;
  saving:              boolean;
  defaultBreakMinutes?: number;
  normalDailyHours?:   number;
  onConfirm:           (time: string, breakMinutes: number) => void;
  onClose:             () => void;
}

export function ClockInOutModal({
  visible,
  record,
  mode,
  theme,
  saving,
  defaultBreakMinutes = 0,
  normalDailyHours    = 8,
  onConfirm,
  onClose,
}: Props) {

  const [time,         setTime]         = useState(nowTime());
  const [breakMinutes, setBreakMinutes] = useState(String(defaultBreakMinutes));
  const [timeError,    setTimeError]    = useState("");
  const [breakError,   setBreakError]   = useState("");

  // ── Reset on open ─────────────────────────
  useEffect(() => {
    if (visible) {
      setTime(nowTime());
      setBreakMinutes(String(defaultBreakMinutes));
      setTimeError("");
      setBreakError("");
    }
  }, [visible, defaultBreakMinutes]);

  const handleTimeChange = useCallback((value: string) => {
    setTime(value);
    if (timeError) setTimeError("");
  }, [timeError]);

  const handleBreakChange = useCallback((value: string) => {
    setBreakMinutes(value);
    if (breakError) setBreakError("");
  }, [breakError]);

  const handleConfirm = useCallback(() => {
    let valid = true;

    if (!isValidTime(time)) {
      setTimeError("Format: HH:mm (00:00–23:59)");
      valid = false;
    }

    // ✅ Fix #3 — Math.floor integer safe
    const breakMinsRaw = Number(breakMinutes);
    const breakMins    = Math.floor(breakMinsRaw);
    if (isNaN(breakMinsRaw) || breakMinsRaw < 0) {
      setBreakError("Must be 0 or more");
      valid = false;
    }

    if (!valid) return;
    onConfirm(time, breakMins);
  }, [time, breakMinutes, onConfirm]);

  if (!record) return null;

  const isClockIn   = mode === "clockIn";
  const accentColor = isClockIn
    ? ATTENDANCE_STATUS_COLORS.PRESENT
    : ATTENDANCE_STATUS_COLORS.LATE;
  const errorColor  = theme.error ?? "#ef4444";

  // ── Preview hours for clockOut ────────────
  const preview = !isClockIn && record.clockIn
    ? previewHours(record.clockIn, time, Number(breakMinutes) || 0)
    : null;

  // ── Initials ──────────────────────────────
  const nameParts = record.employeeName.trim().split(" ");
  const initials  =
    nameParts.length >= 2 && nameParts[0] && nameParts[nameParts.length - 1]
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.[0] ?? "?").toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        onPress={saving ? undefined : onClose}
        activeOpacity={1}
      >
        <View
          style={[styles.modal, { backgroundColor: theme.surface }]}
          onStartShouldSetResponder={() => true}
        >

          {/* ── Header ── */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.modeIcon, { backgroundColor: `${accentColor}20` }]}>
                <MaterialIcons
                  name={isClockIn ? "login" : "logout"}
                  size={20}
                  color={accentColor}
                />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>
                {isClockIn ? "Clock In" : "Clock Out"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={{ opacity: saving ? 0.4 : 1 }}
            >
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Employee Info ── */}
          <View style={[styles.employeeRow, { backgroundColor: theme.bg }]}>
            <View style={[styles.avatar, { backgroundColor: `${accentColor}20` }]}>
              <Text style={[styles.avatarText, { color: accentColor }]}>
                {initials}
              </Text>
            </View>
            <View style={styles.employeeInfo}>
              <Text style={[styles.employeeName, { color: theme.text }]}>
                {record.employeeName}
              </Text>
              <Text style={[styles.employeeSub, { color: theme.textSecondary }]}>
                {record.employeeNo}
                {/* ✅ Fix #2 — crash safe */}
                {record.employeeSnapshot?.position
                  ? ` · ${record.employeeSnapshot.position}`
                  : ""}
              </Text>
            </View>
            {/* ── Clock In time (clockOut mode) ── */}
            {!isClockIn && record.clockIn && (
              <View style={styles.clockInBadge}>
                <Text style={[styles.clockInLabel, { color: theme.textSecondary }]}>
                  In
                </Text>
                <Text style={[styles.clockInTime, { color: theme.text }]}>
                  {record.clockIn}
                </Text>
              </View>
            )}
          </View>

          {/* ── Time Input ── */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {isClockIn ? "CLOCK IN TIME" : "CLOCK OUT TIME"}
            </Text>
            <TextInput
              style={[styles.timeInput, {
                backgroundColor: theme.bg,
                borderColor:     timeError ? errorColor : accentColor,
                color:           theme.text,
              }]}
              value={time}
              onChangeText={handleTimeChange}
              placeholder="09:00"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            {timeError ? (
              <Text style={[styles.errorText, { color: errorColor }]}>
                {timeError}
              </Text>
            ) : (
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                Format: HH:mm (24-hour)
              </Text>
            )}
          </View>

          {/* ── Break Minutes (clockOut only) ── */}
          {!isClockIn && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                BREAK (MINUTES)
              </Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.bg,
                  borderColor:     breakError ? errorColor : theme.border,
                  color:           theme.text,
                }]}
                value={breakMinutes}
                onChangeText={handleBreakChange}
                placeholder="30"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
              {breakError && (
                <Text style={[styles.errorText, { color: errorColor }]}>
                  {breakError}
                </Text>
              )}
            </View>
          )}

          {/* ── Preview Hours ── */}
          {preview !== null && (
            <View style={[styles.previewBox, { backgroundColor: theme.bg }]}>
              <MaterialIcons
                name="timer"
                size={16}
                color={ATTENDANCE_STATUS_COLORS.PRESENT}
              />
              <Text style={[styles.previewText, { color: theme.text }]}>
                Worked: {formatDuration(preview)}
              </Text>
              {preview > normalDailyHours && (
                <Text style={[styles.overtimeText, {
                  color: ATTENDANCE_STATUS_COLORS.LATE,
                }]}>
                  +{formatDuration(preview - normalDailyHours)} OT
                </Text>
              )}
            </View>
          )}

          {/* ── Confirm Button ── */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={saving}
            style={[styles.confirmBtn, {
              backgroundColor: accentColor,
              opacity:         saving ? 0.7 : 1,
            }]}
          >
            {saving ? (
              <ActivityIndicator size={16} color="#fff" />
            ) : (
              <>
                <MaterialIcons
                  name={isClockIn ? "login" : "logout"}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.confirmText}>
                  {isClockIn ? "CONFIRM CLOCK IN" : "CONFIRM CLOCK OUT"}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent:  "center",
    alignItems:      "center",
    padding:         16,
  },
  modal: {
    width:        "100%",
    maxWidth:     400,
    borderRadius: 20,
    padding:      16,
  },
  header: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    paddingBottom:     12,
    marginBottom:      12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  modeIcon: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  title: {
    fontSize:   16,
    fontWeight: "800",
  },
  employeeRow: {
    flexDirection:  "row",
    alignItems:     "center",
    padding:        12,
    borderRadius:   12,
    gap:            10,
    marginBottom:   16,
  },
  avatar: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize:   13,
    fontWeight: "800",
  },
  employeeInfo: {
    flex: 1,
    gap:  2,
  },
  employeeName: {
    fontSize:   13,
    fontWeight: "700",
  },
  employeeSub: {
    fontSize: 11,
  },
  clockInBadge: {
    alignItems: "flex-end",
    gap:        2,
  },
  clockInLabel: {
    fontSize: 10,
  },
  clockInTime: {
    fontSize:   14,
    fontWeight: "800",
  },
  section: {
    marginBottom: 14,
  },
  label: {
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 0.5,
    marginBottom:  6,
  },
  timeInput: {
    borderWidth:       2,
    borderRadius:      9,
    paddingHorizontal: 16,
    paddingVertical:   14,
    fontSize:          24,
    fontWeight:        "800",
    textAlign:         "center",
    letterSpacing:     2,
  },
  input: {
    borderWidth:       1.5,
    borderRadius:      9,
    paddingHorizontal: 12,
    paddingVertical:   10,
    fontSize:          13,
  },
  errorText: {
    fontSize:  11,
    marginTop: 4,
  },
  hintText: {
    fontSize:  11,
    marginTop: 4,
  },
  previewBox: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
    padding:        12,
    borderRadius:   10,
    marginBottom:   14,
  },
  previewText: {
    fontSize:   13,
    fontWeight: "700",
    flex:       1,
  },
  overtimeText: {
    fontSize:   12,
    fontWeight: "700",
  },
  confirmBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    borderRadius:    12,
    paddingVertical: 14,
    marginTop:       4,
  },
  confirmText: {
    color:      "#fff",
    fontSize:   14,
    fontWeight: "800",
  },
});