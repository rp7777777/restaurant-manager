// ============================================
// SERVORA ERP — AttendanceForm Component
// ✅ Add + Edit attendance
// ✅ Employee picker integration
// ✅ Schedule auto-fill — stale data fix
// ✅ HH:mm validation — 00:00–23:59 only
// ✅ Edit mode — employeeId validation skip
// ✅ scheduledHours — readonly display
// ✅ useMemo — filtered employees
// ✅ Modal close disabled while saving
// ✅ Pure presentation — no Firestore
// ✅ theme prop — no AppContext dependency
// FROZEN
// ============================================

import React, {
  useState, useEffect, useCallback, useMemo,
} from "react";
import {
  View, Text, Modal, TouchableOpacity,
  TextInput, ScrollView, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  AttendanceRecord,
  AttendanceStatus,
} from "../types/attendance-types";
import { EmployeeDB } from "../../employees-module/types/employee-types";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
} from "../constants/attendance-status";
import {
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_BG_COLORS,
} from "../constants/attendance-status-colors";

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
  error?:        string;
}

// ── Form State ────────────────────────────────
export interface AttendanceFormState {
  employeeId:     string;
  employeeName:   string;
  employeeNo:     string;
  date:           string;
  status:         AttendanceStatus;
  clockIn:        string;
  clockOut:       string;
  breakMinutes:   string;
  scheduledStart: string;
  scheduledEnd:   string;
  scheduledHours: string;
}

export function createEmptyAttendanceForm(
  date: string
): AttendanceFormState {
  return {
    employeeId:     "",
    employeeName:   "",
    employeeNo:     "",
    date,
    status:         "PRESENT",
    clockIn:        "",
    clockOut:       "",
    breakMinutes:   "0",
    scheduledStart: "",
    scheduledEnd:   "",
    scheduledHours: "",
  };
}

export function formFromAttendanceRecord(
  record: AttendanceRecord
): AttendanceFormState {
  return {
    employeeId:     record.employeeId,
    employeeName:   record.employeeName,
    employeeNo:     record.employeeNo,
    date:           record.date,
    status:         record.status,
    clockIn:        record.clockIn        ?? "",
    clockOut:       record.clockOut       ?? "",
    breakMinutes:   String(record.breakMinutes),
    scheduledStart: record.scheduledStart ?? "",
    scheduledEnd:   record.scheduledEnd   ?? "",
    scheduledHours: record.scheduledHours !== undefined
      ? String(record.scheduledHours) : "",
  };
}

// ── HH:mm validation ──────────────────────────
// ✅ Fix #1 — 00:00–23:59 only
function isValidTime(value: string): boolean {
  if (!value.trim()) return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

// ── Validate form ─────────────────────────────
function validateForm(
  form: AttendanceFormState,
  isEditing: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};

  // ✅ Fix #3 — skip employeeId check in edit mode
  if (!isEditing && !form.employeeId) {
    errors.employeeId = "Employee is required";
  }
  if (!isValidTime(form.clockIn)) {
    errors.clockIn = "Format: HH:mm (00:00–23:59)";
  }
  if (!isValidTime(form.clockOut)) {
    errors.clockOut = "Format: HH:mm (00:00–23:59)";
  }
  if (!isValidTime(form.scheduledStart)) {
    errors.scheduledStart = "Format: HH:mm";
  }
  if (!isValidTime(form.scheduledEnd)) {
    errors.scheduledEnd = "Format: HH:mm";
  }
  const breakMins = Number(form.breakMinutes);
  if (isNaN(breakMins) || breakMins < 0) {
    errors.breakMinutes = "Must be 0 or more";
  }

  return errors;
}

interface ScheduleInfo {
  scheduledStart?: string;
  scheduledEnd?:   string;
  scheduledHours?: number;
}

interface Props {
  visible:     boolean;
  date:        string;
  editRecord?: AttendanceRecord;
  employees:   EmployeeDB[];
  theme:       Theme;
  saving:      boolean;
  getScheduleForEmployee?: (
    employeeId: string,
    date: string
  ) => ScheduleInfo | undefined;
  onSave:  (form: AttendanceFormState) => void;
  onClose: () => void;
}

export function AttendanceForm({
  visible,
  date,
  editRecord,
  employees,
  theme,
  saving,
  getScheduleForEmployee,
  onSave,
  onClose,
}: Props) {

  const [form,   setForm]   = useState<AttendanceFormState>(
    createEmptyAttendanceForm(date)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [employeeSearch,     setEmployeeSearch]     = useState("");

  const isEditing = !!editRecord;

  // ── Load edit record ──────────────────────
  useEffect(() => {
    if (editRecord) {
      setForm(formFromAttendanceRecord(editRecord));
    } else {
      setForm(createEmptyAttendanceForm(date));
    }
    setErrors({});
    setEmployeeSearch("");
  }, [editRecord, date, visible]);

  const setField = useCallback(
    <K extends keyof AttendanceFormState>(
      key: K, value: AttendanceFormState[K]
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  // ── Employee select + Schedule auto-fill ──
  const handleSelectEmployee = useCallback((emp: EmployeeDB) => {
    const schedule = getScheduleForEmployee?.(emp.id, date);
    setForm((prev) => ({
      ...prev,
      employeeId:   emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      employeeNo:   emp.employeeNumber,
      // ✅ Fix #2 — stale data fix — always reset
      scheduledStart: schedule?.scheduledStart ?? "",
      scheduledEnd:   schedule?.scheduledEnd   ?? "",
      scheduledHours: schedule?.scheduledHours !== undefined
        ? String(schedule.scheduledHours)
        : "",
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.employeeId;
      return next;
    });
    setShowEmployeePicker(false);
    setEmployeeSearch("");
  }, [date, getScheduleForEmployee]);

  // ── Save with validation ──────────────────
  const handleSave = useCallback(() => {
    const validationErrors = validateForm(form, isEditing);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(form);
  }, [form, isEditing, onSave]);

  // ── Filtered employees ────────────────────
  const filteredEmployees = useMemo(() =>
    employees.filter((e) => {
      if (!employeeSearch.trim()) return true;
      const q = employeeSearch.toLowerCase();
      return (
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.employeeNumber.toLowerCase().includes(q)
      );
    }),
    [employees, employeeSearch]
  );

  const errorColor = theme.error ?? "#ef4444";

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {isEditing ? "Edit Attendance" : "Add Attendance"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={{ opacity: saving ? 0.4 : 1 }}
            >
              <MaterialIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Employee ── */}
            {!isEditing && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  EMPLOYEE *
                </Text>
                <TouchableOpacity
                  onPress={() => setShowEmployeePicker(true)}
                  style={[styles.selector, {
                    backgroundColor: theme.bg,
                    borderColor: errors.employeeId ? errorColor : theme.border,
                  }]}
                >
                  <Text style={[
                    styles.selectorText,
                    { color: form.employeeName ? theme.text : theme.textSecondary },
                  ]}>
                    {form.employeeName || "Select employee..."}
                  </Text>
                  <MaterialIcons
                    name="person-search"
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
                {errors.employeeId && (
                  <Text style={[styles.errorText, { color: errorColor }]}>
                    {errors.employeeId}
                  </Text>
                )}
                {/* ✅ Schedule auto-fill indicator */}
                {form.scheduledStart ? (
                  <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                    📅 Schedule: {form.scheduledStart} – {form.scheduledEnd}
                    {form.scheduledHours ? ` (${form.scheduledHours}h)` : ""}
                  </Text>
                ) : null}
              </View>
            )}

            {/* ── Status ── */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                STATUS *
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statusRow}
              >
                {ATTENDANCE_STATUSES.map((s) => {
                  const isActive = form.status === s;
                  const color    = ATTENDANCE_STATUS_COLORS[s];
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setField("status", s)}
                      style={[styles.statusChip, {
                        backgroundColor: isActive
                          ? ATTENDANCE_STATUS_BG_COLORS[s]
                          : theme.bg,
                        borderColor: isActive ? color : theme.border,
                      }]}
                    >
                      <Text style={[
                        styles.statusChipText,
                        { color: isActive ? color : theme.textSecondary },
                      ]}>
                        {ATTENDANCE_STATUS_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Clock In / Out ── */}
            <View style={styles.row2}>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  CLOCK IN
                </Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.bg,
                    borderColor: errors.clockIn ? errorColor : theme.border,
                    color:       theme.text,
                  }]}
                  placeholder="09:00"
                  placeholderTextColor={theme.textSecondary}
                  value={form.clockIn}
                  onChangeText={(v) => setField("clockIn", v)}
                />
                {errors.clockIn && (
                  <Text style={[styles.errorText, { color: errorColor }]}>
                    {errors.clockIn}
                  </Text>
                )}
              </View>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  CLOCK OUT
                </Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.bg,
                    borderColor: errors.clockOut ? errorColor : theme.border,
                    color:       theme.text,
                  }]}
                  placeholder="17:00"
                  placeholderTextColor={theme.textSecondary}
                  value={form.clockOut}
                  onChangeText={(v) => setField("clockOut", v)}
                />
                {errors.clockOut && (
                  <Text style={[styles.errorText, { color: errorColor }]}>
                    {errors.clockOut}
                  </Text>
                )}
              </View>
            </View>

            {/* ── Break Minutes ── */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                BREAK (MINUTES)
              </Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.bg,
                  borderColor: errors.breakMinutes ? errorColor : theme.border,
                  color:       theme.text,
                }]}
                placeholder="30"
                placeholderTextColor={theme.textSecondary}
                value={form.breakMinutes}
                onChangeText={(v) => setField("breakMinutes", v)}
                keyboardType="numeric"
              />
              {errors.breakMinutes && (
                <Text style={[styles.errorText, { color: errorColor }]}>
                  {errors.breakMinutes}
                </Text>
              )}
            </View>

            {/* ── Scheduled ── */}
            <View style={styles.row2}>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  SCHED. START
                </Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.bg,
                    borderColor: errors.scheduledStart
                      ? errorColor : theme.border,
                    color: theme.text,
                  }]}
                  placeholder="09:00"
                  placeholderTextColor={theme.textSecondary}
                  value={form.scheduledStart}
                  onChangeText={(v) => setField("scheduledStart", v)}
                />
                {errors.scheduledStart && (
                  <Text style={[styles.errorText, { color: errorColor }]}>
                    {errors.scheduledStart}
                  </Text>
                )}
              </View>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  SCHED. END
                </Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.bg,
                    borderColor: errors.scheduledEnd
                      ? errorColor : theme.border,
                    color: theme.text,
                  }]}
                  placeholder="17:00"
                  placeholderTextColor={theme.textSecondary}
                  value={form.scheduledEnd}
                  onChangeText={(v) => setField("scheduledEnd", v)}
                />
                {errors.scheduledEnd && (
                  <Text style={[styles.errorText, { color: errorColor }]}>
                    {errors.scheduledEnd}
                  </Text>
                )}
              </View>
            </View>

            {/* ✅ Fix #4 — Scheduled Hours readonly display */}
            {form.scheduledHours ? (
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  SCHEDULED HOURS
                </Text>
                <View style={[styles.readonlyBox, {
                  backgroundColor: theme.bg,
                  borderColor:     theme.border,
                }]}>
                  <MaterialIcons
                    name="schedule"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.readonlyText, { color: theme.text }]}>
                    {form.scheduledHours}h
                  </Text>
                </View>
              </View>
            ) : null}

          </ScrollView>

          {/* ── Save Button ── */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, {
              backgroundColor: theme.primary,
              opacity:         saving ? 0.7 : 1,
            }]}
          >
            {saving ? (
              <ActivityIndicator size={16} color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEditing ? "UPDATE ATTENDANCE" : "SAVE ATTENDANCE"}
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </View>

      {/* ── Employee Picker ── */}
      <Modal
        visible={showEmployeePicker}
        transparent
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          onPress={() => setShowEmployeePicker(false)}
        >
          <View
            style={[styles.pickerModal, { backgroundColor: theme.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.pickerTitle, { color: theme.text }]}>
              Select Employee
            </Text>

            <View style={[styles.searchBox, {
              backgroundColor: theme.bg,
              borderColor:     theme.border,
            }]}>
              <MaterialIcons name="search" size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search..."
                placeholderTextColor={theme.textSecondary}
                value={employeeSearch}
                onChangeText={setEmployeeSearch}
                autoFocus
              />
            </View>

            <ScrollView
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
            >
              {filteredEmployees.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No employees found
                </Text>
              ) : (
                filteredEmployees.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => handleSelectEmployee(emp)}
                    style={[styles.pickerRow, { borderBottomColor: theme.border }]}
                  >
                    <Text style={[styles.pickerName, { color: theme.text }]}>
                      {emp.firstName} {emp.lastName}
                    </Text>
                    <Text style={[styles.pickerSub, { color: theme.textSecondary }]}>
                      {emp.employeeNumber} · {emp.position}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent:  "flex-end",
  },
  modal: {
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    padding:              16,
    maxHeight:            "90%",
  },
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   16,
  },
  title: {
    fontSize:   16,
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
  row2: {
    flexDirection: "row",
    gap:           12,
  },
  input: {
    borderWidth:       1.5,
    borderRadius:      9,
    paddingHorizontal: 12,
    paddingVertical:   10,
    fontSize:          13,
  },
  readonlyBox: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    borderWidth:       1.5,
    borderRadius:      9,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  readonlyText: {
    fontSize:   13,
    fontWeight: "600",
  },
  selector: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    borderWidth:       1.5,
    borderRadius:      9,
    paddingHorizontal: 12,
    paddingVertical:   12,
  },
  selectorText: {
    fontSize: 13,
  },
  statusRow: {
    gap:           6,
    paddingBottom: 2,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      20,
    borderWidth:       1.5,
  },
  statusChipText: {
    fontSize:   12,
    fontWeight: "600",
  },
  errorText: {
    fontSize:  11,
    marginTop: 4,
  },
  hintText: {
    fontSize:  11,
    marginTop: 4,
  },
  saveBtn: {
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      "center",
    marginTop:       8,
  },
  saveBtnText: {
    color:      "#fff",
    fontSize:   14,
    fontWeight: "800",
  },
  pickerOverlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent:  "center",
    alignItems:      "center",
    padding:         16,
  },
  pickerModal: {
    width:        "100%",
    maxWidth:     400,
    borderRadius: 18,
    padding:      16,
    maxHeight:    "70%",
  },
  pickerTitle: {
    fontSize:     15,
    fontWeight:   "800",
    marginBottom: 12,
  },
  searchBox: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    borderWidth:       1.5,
    borderRadius:      9,
    paddingHorizontal: 10,
    paddingVertical:   8,
    marginBottom:      10,
  },
  searchInput: {
    flex:     1,
    fontSize: 13,
    padding:  0,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerRow: {
    paddingVertical:   12,
    borderBottomWidth: 1,
    gap:               3,
  },
  pickerName: {
    fontSize:   13,
    fontWeight: "700",
  },
  pickerSub: {
    fontSize: 11,
  },
  emptyText: {
    textAlign: "center",
    padding:   20,
    fontSize:  13,
  },
});