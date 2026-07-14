// ============================================
// SERVORA ERP — AttendanceScreen
// ✅ FlatList — 500+ employees performance
// ✅ Date navigation — timezone safe
// ✅ Time — toTimeString() no tz conversion
// ✅ selectedDate = single source of truth
// ✅ filter = search + status only
// ✅ canManageAttendance — role based only
// ✅ Delete error handling
// ✅ No business logic — service layer
// ✅ selectedDate auto-follows midnight rollover
//    ONLY while viewing "today" — navigating to another
//    day is never yanked back when midnight passes.
// ✅ Add/Edit Attendance — wired to AttendanceForm modal
// ✅ Edit clears clockIn/clockOut explicitly (null signal)
//    instead of silently keeping stale values on blank Save
// ✅ Clock Out uses the record's own persisted normalDailyHours
//    snapshot before falling back to current restaurant settings
// ✅ Schedule auto-fill — resolves employee's planned shift from
//    Schedule Module so Sched. Start/End don't need manual re-entry
// FROZEN
// ============================================

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View, StyleSheet, FlatList,
  ActivityIndicator, Text, Platform, Alert, TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useAttendance, filterAttendance } from "../hooks/useAttendance";
import { useAttendanceStats } from "../hooks/useAttendanceStats";
import { useEmployees } from "../../employees-module/hooks/useEmployees";
import { useSchedules } from "../../schedule-module/hooks/useSchedules";
import { getMondayOfWeek, parseDate } from "../../schedule-module/utils/date-utils";
import {
  AttendanceRecord,
  AttendanceFilter,
} from "../types/attendance-types";
import {
  clockIn as serviceClockIn,
  clockOut as serviceClockOut,
  deleteAttendance,
  createAttendance,
  updateAttendance,
} from "../services/attendance-service";
import { AttendanceStatsBar } from "../components/AttendanceStatsBar";
import { AttendanceSearch }   from "../components/AttendanceSearch";
import { AttendanceCard }     from "../components/AttendanceCard";
import {
  AttendanceForm,
  AttendanceFormState,
} from "../components/AttendanceForm";
import { useTodayISO } from "../../../hooks/useTodayISO";

// ── Add days to ISO date ──────────────────────
function addDaysToISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000)
    .toISOString().split("T")[0];
}

// ── Format date label ─────────────────────────
function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    year:    "numeric",
  });
}

// ── Current local time ────────────────────────
function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

export default function AttendanceScreen() {
  const { theme, restaurantId, userProfile, settings } = useApp();

  // ── Reactive "live today" — rolls over at midnight automatically.
  //    selectedDate only auto-follows it while the user is viewing
  //    "today"; if they've navigated to another day, midnight passing
  //    won't yank their view back to today. ──
  const liveToday = useTodayISO();
  const previousLiveTodayRef = useRef(liveToday);

  // ✅ selectedDate = single source of truth
  const [selectedDate, setSelectedDate] = useState(liveToday);

  useEffect(() => {
    if (liveToday !== previousLiveTodayRef.current) {
      setSelectedDate((current) =>
        current === previousLiveTodayRef.current ? liveToday : current
      );
      previousLiveTodayRef.current = liveToday;
    }
  }, [liveToday]);

  // ✅ filter = search + status only
  const [filter, setFilter] = useState<Omit<AttendanceFilter, "date">>({
    search: "",
    status: "ALL",
  });

  const [clockingInId,  setClockingInId]  = useState<string | null>(null);
  const [clockingOutId, setClockingOutId] = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  // ── Add/Edit form state ──
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | undefined>(undefined);
  const [formSaving, setFormSaving] = useState(false);

  // ✅ role based only — no permissions field
  const canManageAttendance =
    ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  // ── Data ──────────────────────────────────
  const { records, loading } = useAttendance(restaurantId, selectedDate);
  const stats                = useAttendanceStats(records);
  const { employees }        = useEmployees(restaurantId);

  // ── Schedule auto-fill — resolves an employee's planned shift for
  //    the selected date from the Schedule Module, so Sched. Start/End
  //    don't need to be manually re-typed by the manager. ──
  const weekStart = useMemo(
    () => getMondayOfWeek(parseDate(selectedDate)),
    [selectedDate]
  );
  const { getScheduleByEmployeeNo } = useSchedules(restaurantId, weekStart);

  const getScheduleForEmployee = useCallback(
    (employeeId: string, date: string) => {
      const employee = employees.find((e) => e.id === employeeId);
      if (!employee) return undefined;

      const schedule = getScheduleByEmployeeNo(employee.employeeNumber);
      if (!schedule) return undefined;

      const day = schedule.days[date];
      if (!day) return undefined;

      return {
        scheduledStart: day.startTime || undefined,
        scheduledEnd:   day.endTime   || undefined,
        scheduledHours: day.hours,
      };
    },
    [employees, getScheduleByEmployeeNo]
  );

  // ── Full filter — merge date ──────────────
  const fullFilter: AttendanceFilter = useMemo(() => ({
    ...filter,
    date: selectedDate,
  }), [filter, selectedDate]);

  // ── Filtered ─────────────────────────────
  const filtered = useMemo(
    () => filterAttendance(records, fullFilter),
    [records, fullFilter]
  );

  // ── Date navigation ───────────────────────
  const handlePrevDay = useCallback(() => {
    setSelectedDate((d) => addDaysToISO(d, -1));
    setFilter((f) => ({ ...f, search: "", status: "ALL" }));
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDate((d) => addDaysToISO(d, 1));
    setFilter((f) => ({ ...f, search: "", status: "ALL" }));
  }, []);

  // ── Open Add / Edit form ──────────────────
  const handleOpenAdd = useCallback(() => {
    setEditingRecord(undefined);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((record: AttendanceRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    if (formSaving) return;
    setShowForm(false);
    setEditingRecord(undefined);
  }, [formSaving]);

  // ── Save form (create or update) ──────────
  //    clockIn/clockOut: empty string in the form means the manager
  //    left it blank — sent as `null` to the service to explicitly
  //    clear the field, rather than `undefined` which would leave
  //    any existing value untouched. ──
  const handleSaveForm = useCallback(async (form: AttendanceFormState) => {
    if (!restaurantId) return;

    setFormSaving(true);
    try {
      const breakMinutes     = Number(form.breakMinutes) || 0;
      const normalDailyHours = settings?.normalDailyHours ?? 8;

      if (editingRecord) {
        const result = await updateAttendance({
          restaurantId,
          attendanceId: editingRecord.id,
          status: form.status,
          clockIn:  form.clockIn.trim()  ? form.clockIn.trim()  : null,
          clockOut: form.clockOut.trim() ? form.clockOut.trim() : null,
          breakMinutes,
          normalDailyHours,
        });
        if (!result.success) {
          const msg = result.error ?? "Failed to update attendance";
          if (Platform.OS === "web") window.alert(msg); else Alert.alert("Error", msg);
          return;
        }
      } else {
        const employee = employees.find((e) => e.id === form.employeeId);
        if (!employee) {
          const msg = "Please select a valid employee";
          if (Platform.OS === "web") window.alert(msg); else Alert.alert("Error", msg);
          return;
        }

        const result = await createAttendance({
          restaurantId,
          employee,
          date: form.date,
          status: form.status,
          clockIn: form.clockIn || undefined,
          clockOut: form.clockOut || undefined,
          breakMinutes,
          normalDailyHours,
          scheduledStart: form.scheduledStart || undefined,
          scheduledEnd:   form.scheduledEnd   || undefined,
          scheduledHours: form.scheduledHours ? Number(form.scheduledHours) : undefined,
          attendanceSource: "MANUAL",
        });
        if (!result.success) {
          const msg = result.error ?? "Failed to create attendance";
          if (Platform.OS === "web") window.alert(msg); else Alert.alert("Error", msg);
          return;
        }
      }

      setShowForm(false);
      setEditingRecord(undefined);
    } finally {
      setFormSaving(false);
    }
  }, [restaurantId, editingRecord, employees, settings]);

  // ── Clock In ──────────────────────────────
  const handleClockIn = useCallback(async (record: AttendanceRecord) => {
    if (!restaurantId || clockingInId) return;
    setClockingInId(record.id);
    try {
      const result = await serviceClockIn(restaurantId, record.id, nowTime());
      if (!result.success) {
        if (Platform.OS === "web") window.alert(result.error ?? "Failed to clock in");
        else Alert.alert("Error", result.error ?? "Failed to clock in");
      }
    } finally {
      setClockingInId(null);
    }
  }, [restaurantId, clockingInId]);

  // ── Clock Out — uses the record's own persisted normalDailyHours
  //    snapshot first, so a later restaurant-settings change doesn't
  //    retroactively change this record's overtime calculation. ──
  const handleClockOut = useCallback(async (record: AttendanceRecord) => {
    if (!restaurantId || clockingOutId) return;
    const breakMinutes     = settings?.defaultBreakMinutes ?? 0;
    const normalDailyHours = record.normalDailyHours ?? settings?.normalDailyHours ?? 8;
    setClockingOutId(record.id);
    try {
      const result = await serviceClockOut(
        restaurantId, record.id, nowTime(), breakMinutes, normalDailyHours
      );
      if (!result.success) {
        if (Platform.OS === "web") window.alert(result.error ?? "Failed to clock out");
        else Alert.alert("Error", result.error ?? "Failed to clock out");
      }
    } finally {
      setClockingOutId(null);
    }
  }, [restaurantId, clockingOutId, settings]);

  // ── Delete ────────────────────────────────
  const handleDelete = useCallback((record: AttendanceRecord) => {
    if (!restaurantId) return;
    const doDelete = async () => {
      setDeletingId(record.id);
      try {
        const result = await deleteAttendance(restaurantId, record.id);
        if (!result.success) {
          if (Platform.OS === "web") window.alert(result.error ?? "Failed to delete");
          else Alert.alert("Error", result.error ?? "Failed to delete");
        }
      } finally {
        setDeletingId(null);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete attendance for ${record.employeeName}?`)) doDelete();
    } else {
      Alert.alert("Delete", `Delete attendance for ${record.employeeName}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  }, [restaurantId]);

  // ── Render card ───────────────────────────
  const renderRecord = useCallback(
    ({ item }: { item: AttendanceRecord }) => (
      <AttendanceCard
        record={item}
        theme={theme}
        isManager={canManageAttendance}
        isClockingIn={clockingInId   === item.id}
        isClockingOut={clockingOutId === item.id}
        isDeleting={deletingId       === item.id}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        onEdit={canManageAttendance ? handleOpenEdit : undefined}
        onDelete={canManageAttendance ? handleDelete : undefined}
      />
    ),
    [
      theme, canManageAttendance,
      clockingInId, clockingOutId, deletingId,
      handleClockIn, handleClockOut, handleOpenEdit, handleDelete,
    ]
  );

  const keyExtractor = useCallback(
    (item: AttendanceRecord) => item.id,
    []
  );

  // ── List header ───────────────────────────
  const ListHeader = useMemo(() => (
    <>
      <AttendanceStatsBar stats={stats} theme={theme} />
      <AttendanceSearch
        filter={fullFilter}
        onChange={(f) => setFilter({ search: f.search, status: f.status })}
        theme={theme}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        dateLabel={formatDateLabel(selectedDate)}
      />
      {filtered.length > 0 && (
        <Text style={[styles.countText, { color: theme.textSecondary }]}>
          {filtered.length} records
        </Text>
      )}
    </>
  ), [
    stats, theme, fullFilter,
    filtered.length, handlePrevDay,
    handleNextDay, selectedDate,
  ]);

  // ── Empty ─────────────────────────────────
  const ListEmpty = useMemo(() => (
    loading ? null : (
      <View style={styles.emptyBox}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          {filter.search || filter.status !== "ALL"
            ? "No records match your filter"
            : "No attendance records for this date"}
        </Text>
      </View>
    )
  ), [loading, filter, theme]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* ── Header ── */}
      <LinearGradient
        colors={["#00154f", "#0039cb"]}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>ATTENDANCE</Text>
            <Text style={styles.headerSub}>Daily Attendance Tracker</Text>
          </View>
          {canManageAttendance && (
            <TouchableOpacity
              onPress={handleOpenAdd}
              style={styles.addBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Add attendance"
            >
              <MaterialIcons name="add" size={22} color="#00154f" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator
          color={theme.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderRecord}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS !== "web"}
          maxToRenderPerBatch={15}
          windowSize={10}
        />
      )}

      <AttendanceForm
        visible={showForm}
        date={selectedDate}
        editRecord={editingRecord}
        employees={employees}
        theme={theme}
        saving={formSaving}
        getScheduleForEmployee={getScheduleForEmployee}
        onSave={handleSaveForm}
        onClose={handleCloseForm}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop:        Platform.OS === "web" ? 24 : 48,
    paddingBottom:     16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize:      22,
    fontWeight:    "900",
    color:         "#FFD700",
    letterSpacing: 1,
  },
  headerSub: {
    fontSize:  12,
    color:     "#ffffff80",
    marginTop: 2,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent:  { paddingBottom: 40 },
  countText: {
    fontSize:          12,
    paddingHorizontal: 16,
    paddingVertical:   6,
  },
  emptyBox: {
    padding:    40,
    alignItems: "center",
  },
  emptyText: {
    fontSize:  13,
    textAlign: "center",
  },
});