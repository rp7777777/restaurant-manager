// ============================================
// SERVORA ERP — ScheduleScreen
// ✅ Break threshold auto deduct
// ✅ Net hours saved to Firestore
// ✅ Holiday batch write
// ✅ Apply whole week all statuses
// ✅ updateScheduleDay() is the single source of truth for
//    schedule-day mutation + Attendance sync (sync happens inside
//    the repository function itself, re-reading the latest
//    committed day before syncing) — saveCellEdit() no longer
//    calls sync separately, it just reads the syncFailed/syncError
//    result back.
// ✅ Set Holiday remains a documented exception: it bypasses
//    updateScheduleDay() for bulk-write performance (writeBatch),
//    so it still calls the batch sync helper explicitly afterward.
// ✅ createSchedule() now receives real restaurant settings
//    (mandatory parameter — no silent hardcoded fallback).
// ✅ deleteSchedule() now cleans up SCHEDULE-origin Attendance
//    records for the deleted week — handleDelete() surfaces a
//    warning if any couldn't be cleaned up automatically.
// ============================================

import React, { useState } from "react";
import {
  View, StyleSheet, Alert,
  Platform, ActivityIndicator,
} from "react-native";
import { writeBatch, doc } from "firebase/firestore";
import { db } from "../../../firebase";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../../../context/AppContext";
import { useSchedules } from "../hooks/useSchedules";
import { useEmployees } from "../hooks/useEmployees";
import {
  getMondayOfWeek, getWeekDates,
  formatMonthStr, addDays,
} from "../utils/date-utils";
import { buildWeekSummary } from "../utils/overtime-utils";
import { calcHours }        from "../utils/hours-utils";
import { SCHEDULE_CONFIG }  from "../constants/schedule-config";
import {
  createSchedule, updateScheduleDay, deleteSchedule,
} from "../firestore/schedule-repository";
import { copyScheduleToNextWeek } from "../services/schedule-copy-service";
import { generateSchedulePDF }    from "../services/schedule-pdf-service";
import { generateMonthlyPayroll } from "../../payroll-module/payroll-generator";
import {
  DayStatus, DaySchedule, EmployeeSchedule,
} from "../types/schedule-types";
import { RestaurantSettings } from "../types/restaurant-types";
import { EmployeeDB }         from "../types/employee-types";
import { ScheduleHeader }      from "../components/ScheduleHeader";
import { WeekSelector }        from "../components/WeekSelector";
import { StatsBar }            from "../components/StatsBar";
import { ScheduleTable }       from "../components/ScheduleTable";
import { EmployeePickerModal } from "../components/EmployeePickerModal";
import { CellEditorModal }     from "../components/CellEditorModal";
import { CalendarModal }       from "../components/CalendarModal";
import { HolidayModal }        from "../components/HolidayModal";
import {
  syncScheduleDaysToAttendance,
  ScheduleSyncItem,
} from "../../../integrations/schedule-attendance-sync";

export default function ScheduleScreen() {
  const {
    theme, restaurant, restaurantId,
    userProfile, settings,
  } = useApp();

  const today = new Date();
  const [selectedWeek,      setSelectedWeek]      = useState(getMondayOfWeek(today));
  const [calendarMonth,     setCalendarMonth]     = useState(today.getMonth());
  const [calendarYear,      setCalendarYear]      = useState(today.getFullYear());
  const [saving,            setSaving]            = useState(false);
  const [generatingPdf,     setGeneratingPdf]     = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [applyingHoliday,   setApplyingHoliday]   = useState(false);
  const [showCalendar,      setShowCalendar]      = useState(false);
  const [showCellEditor,    setShowCellEditor]    = useState(false);
  const [showEmpPicker,     setShowEmpPicker]     = useState(false);
  const [showHoliday,       setShowHoliday]       = useState(false);
  const [applyWholeWeek,    setApplyWholeWeek]    = useState(false);

  const [editingCell, setEditingCell] = useState<{
    scheduleId: string; dayKey: string; current: DaySchedule;
  } | null>(null);
  const [cellStatus, setCellStatus] = useState<DayStatus>("WORK");
  const [cellStart,  setCellStart]  = useState("09:00");
  const [cellEnd,    setCellEnd]    = useState("17:00");

  const weekDates = getWeekDates(selectedWeek);
  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  const { schedules, loading, totalOT, totalAbsent, addedEmployeeNos } =
    useSchedules(restaurantId, selectedWeek);
  const { employees, employeeMap } = useEmployees(restaurantId);

  const getRestaurantSettings = (): RestaurantSettings => ({
    currency:          settings?.currency          ?? "EUR",
    currencySymbol:    settings?.currencySymbol    ?? "€",
    paymentType:       settings?.paymentType       ?? "MONTHLY",
    normalDailyHours:  settings?.normalDailyHours  ?? 8,
    normalWeeklyHours: settings?.normalWeeklyHours ?? 40,
    defaultTaxRate:    settings?.defaultTaxRate    ?? 11,
    defaultSSRate:     settings?.defaultSSRate     ?? 11,
    payrollMonthDays:  settings?.payrollMonthDays  ?? 30,
    defaultShiftStart: SCHEDULE_CONFIG.DEFAULT_START_TIME,
  });

  // ── Add employee — passes real restaurant settings (was
  //    previously silently falling back to a hardcoded default) ──
  const handleAddEmployee = async (emp: EmployeeDB) => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const { syncFailedCount } = await createSchedule(
        restaurantId, emp, selectedWeek, getRestaurantSettings()
      );
      if (syncFailedCount > 0) {
        Alert.alert(
          "Employee Added",
          `${emp.firstName} added to the schedule, but attendance sync failed for ${syncFailedCount} day(s). Re-save any affected day to retry.`
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to add employee");
    } finally {
      setSaving(false);
      setShowEmpPicker(false);
    }
  };

  // ── Cell editor ───────────────────────────
  const openCell = (
    scheduleId: string, dayKey: string, current: DaySchedule
  ) => {
    if (!isManager) return;
    setEditingCell({ scheduleId, dayKey, current });
    setCellStatus(current.status);
    setCellStart(current.startTime || "09:00");
    setCellEnd(current.endTime     || "17:00");
    setApplyWholeWeek(false);
    setShowCellEditor(true);
  };

  // ✅ Save with break threshold — updateScheduleDay() now syncs
  //    Attendance internally (re-reading the latest committed day
  //    value), so this function just reads back syncFailed/syncError
  //    to surface a warning if needed.
  const saveCellEdit = async () => {
    if (!editingCell || !restaurantId) return;
    const { scheduleId, dayKey } = editingCell;
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    const totalHours = cellStatus === "WORK"
      ? calcHours(cellStart, cellEnd)
      : 0;

    // ✅ Break only if shift >= threshold
    const breakHours =
      settings?.autoDeductBreak &&
      totalHours >= (settings?.autoDeductBreakAfterHours ?? 6)
        ? (settings?.defaultBreakMinutes ?? 0) / 60
        : 0;

    const netHours = Math.max(0, totalHours - breakHours);

    const updatedDay: DaySchedule = {
      status:     cellStatus,
      startTime:  cellStatus === "WORK" ? cellStart : "",
      endTime:    cellStatus === "WORK" ? cellEnd   : "",
      hours:      netHours,
      nightHours: 0,
    };

    const normalDailyHours = settings?.normalDailyHours ?? 8;

    try {
      if (applyWholeWeek) {
        const updatedDays = { ...schedule.days };
        weekDates.forEach((date) => {
          updatedDays[date] = { ...updatedDay };
        });
        const stats = buildWeekSummary(updatedDays, weekDates);

        const results = await Promise.all(
          weekDates.map((date) =>
            updateScheduleDay(
              restaurantId, scheduleId,
              date, updatedDay, stats, normalDailyHours
            )
          )
        );

        const failedDates = weekDates.filter((_, idx) => results[idx].syncFailed);
        if (failedDates.length > 0) {
          Alert.alert(
            "Schedule Saved",
            `Schedule saved, but attendance sync failed for: ${failedDates.join(", ")}. Re-save this day's schedule to retry.`
          );
        }
      } else {
        const updatedDays = { ...schedule.days, [dayKey]: updatedDay };
        const stats       = buildWeekSummary(updatedDays, weekDates);

        const result = await updateScheduleDay(
          restaurantId, scheduleId,
          dayKey, updatedDay, stats, normalDailyHours
        );

        if (result.syncFailed) {
          Alert.alert(
            "Schedule Saved",
            `Schedule saved, but attendance sync failed: ${result.syncError ?? "Unknown error"}. Re-save to retry.`
          );
        }
      }
      setShowCellEditor(false);
      setApplyWholeWeek(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save");
    }
  };

  // ── Delete — deleteSchedule() now also cleans up SCHEDULE-origin
  //    Attendance records for the deleted week; surface a warning
  //    if any couldn't be cleaned up automatically. ──
  const handleDelete = (emp: EmployeeSchedule) => {
    const doDelete = async () => {
      try {
        const { cleanupFailedCount } = await deleteSchedule(restaurantId!, emp.id);
        if (cleanupFailedCount > 0) {
          Alert.alert(
            "Schedule Removed",
            `${emp.employeeName}'s schedule removed, but ${cleanupFailedCount} attendance record(s) could not be cleaned up automatically.`
          );
        }
      } catch (err: any) {
        Alert.alert("Error", err?.message ?? "Delete failed");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Remove ${emp.employeeName}?`)) doDelete();
    } else {
      Alert.alert("Remove", `Remove ${emp.employeeName}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // ── Copy next week ────────────────────────
  const handleCopyNextWeek = async () => {
    if (!restaurantId || schedules.length === 0) return;
    const doConfirm = Platform.OS === "web"
      ? window.confirm(`Copy ${schedules.length} employees to next week?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Copy to Next Week", `Copy ${schedules.length} employees?`, [
            { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
            { text: "Copy",   onPress: () => resolve(true) },
          ]);
        });
    if (!doConfirm) return;
    setSaving(true);
    try {
      const { copied, syncFailedCount } = await copyScheduleToNextWeek(
        restaurantId, selectedWeek, employeeMap, getRestaurantSettings()
      );
      setSelectedWeek(addDays(selectedWeek, 7));
      if (syncFailedCount > 0) {
        Alert.alert(
          "Copied",
          `${copied} employees copied, but attendance sync failed for ${syncFailedCount} day(s). Re-save affected days to retry.`
        );
      } else if (Platform.OS === "web") {
        window.alert(`✅ ${copied} employees copied!`);
      } else {
        Alert.alert("✅ Copied!", `${copied} employees copied`);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Set Holiday batch write — bypasses updateScheduleDay() on
  //    purpose for bulk-write performance (writeBatch across every
  //    employee at once). Documented exception: this is the one
  //    place that still calls the batch sync helper explicitly. ──
  const handleSetHoliday = async (date: string) => {
    if (!restaurantId || applyingHoliday) return;
    setApplyingHoliday(true);
    try {
      const holidayDay: DaySchedule = {
        status:     "HOLIDAY",
        startTime:  "",
        endTime:    "",
        hours:      0,
        nightHours: 0,
      };

      const LIMIT = 400;
      for (let i = 0; i < schedules.length; i += LIMIT) {
        const chunk = schedules.slice(i, i + LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((emp) => {
          const updatedDays = { ...emp.days, [date]: holidayDay };
          const stats       = buildWeekSummary(updatedDays, weekDates);
          const ref = doc(db, "restaurants", restaurantId, "schedules", emp.id);
          batch.update(ref, {
            [`days.${date}`]: holidayDay,
            ...stats,
          });
        });
        await batch.commit();
      }

      const normalDailyHours = settings?.normalDailyHours ?? 8;
      const items: ScheduleSyncItem[] = schedules.map((emp) => ({
        employeeId: emp.employeeId,
        date,
        status: holidayDay.status,
        startTime: undefined,
        endTime: undefined,
        hours: holidayDay.hours,
      }));
      const { failures } = await syncScheduleDaysToAttendance(
        restaurantId, items, normalDailyHours
      );

      setShowHoliday(false);

      if (failures.length > 0) {
        const names = failures
          .map((f) => schedules.find((s) => s.employeeId === f.employeeId)?.employeeName ?? f.employeeId)
          .join(", ");
        Alert.alert(
          "Holiday Set",
          `Public Holiday applied to all ${schedules.length} employees. Attendance sync failed for: ${names}. Re-open Set Holiday for this date to retry.`
        );
      } else {
        Alert.alert(
          "✅ Holiday Set!",
          `Public Holiday applied to all ${schedules.length} employees`
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to set holiday");
    } finally {
      setApplyingHoliday(false);
    }
  };

  // ── Generate Payroll ──────────────────────
  const handleGeneratePayroll = async () => {
    if (!restaurantId) return;
    const monthStr = formatMonthStr(calendarYear, calendarMonth);
    const doConfirm = Platform.OS === "web"
      ? window.confirm(`Generate payroll for ${monthStr}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Generate Payroll", `Generate for ${monthStr}?`, [
            { text: "Cancel",   onPress: () => resolve(false), style: "cancel" },
            { text: "Generate", onPress: () => resolve(true) },
          ]);
        });
    if (!doConfirm) return;
    setGeneratingPayroll(true);
    try {
      const { created, skipped } = await generateMonthlyPayroll(
        restaurantId, calendarYear, calendarMonth, monthStr
      );
      Alert.alert("✅ Done!", `${created} slips created, ${skipped} skipped`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setGeneratingPayroll(false);
    }
  };

  // ── PDF ───────────────────────────────────
  const handlePDF = async () => {
    setGeneratingPdf(true);
    try {
      await generateSchedulePDF(
        restaurant?.name ?? "SERVORA ERP",
        schedules, selectedWeek
      );
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <ScheduleHeader
          isManager={isManager}
          showAddEmployee={showEmpPicker}
          hasSchedules={schedules.length > 0}
          generatingPdf={generatingPdf}
          generatingPayroll={generatingPayroll}
          saving={saving}
          onPrint={handlePDF}
          onToggleAddEmployee={() => setShowEmpPicker(true)}
          onCopyNextWeek={handleCopyNextWeek}
          onGeneratePayroll={handleGeneratePayroll}
          onSetHoliday={() => setShowHoliday(true)}
        />
        <WeekSelector
          weekDates={weekDates}
          onPrev={() => setSelectedWeek(addDays(selectedWeek, -7))}
          onNext={() => setSelectedWeek(addDays(selectedWeek,  7))}
          onCalendarOpen={() => setShowCalendar(true)}
        />
      </LinearGradient>

      <StatsBar
        employeeCount={schedules.length}
        totalOT={totalOT}
        totalAbsent={totalAbsent}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScheduleTable
          schedules={schedules}
          weekDates={weekDates}
          isManager={isManager}
          onCellPress={openCell}
          onDelete={handleDelete}
        />
      )}

      <EmployeePickerModal
        visible={showEmpPicker}
        employees={employees}
        alreadyAdded={addedEmployeeNos}
        onSelect={handleAddEmployee}
        onClose={() => setShowEmpPicker(false)}
      />

      <CalendarModal
        visible={showCalendar}
        calendarMonth={calendarMonth}
        calendarYear={calendarYear}
        selectedWeek={selectedWeek}
        onClose={() => setShowCalendar(false)}
        onSelectWeek={setSelectedWeek}
        onMonthChange={(m, y) => {
          setCalendarMonth(m);
          setCalendarYear(y);
        }}
      />

      <CellEditorModal
        visible={showCellEditor}
        editingCell={editingCell}
        cellStatus={cellStatus}
        cellStart={cellStart}
        cellEnd={cellEnd}
        applyWholeWeek={applyWholeWeek}
        onStatusChange={setCellStatus}
        onStartChange={setCellStart}
        onEndChange={setCellEnd}
        onApplyWholeWeekChange={setApplyWholeWeek}
        onSave={saveCellEdit}
        onClose={() => {
          setShowCellEditor(false);
          setApplyWholeWeek(false);
        }}
      />

      <HolidayModal
        visible={showHoliday}
        weekDates={weekDates}
        applying={applyingHoliday}
        onApply={handleSetHoliday}
        onClose={() => setShowHoliday(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    paddingTop:        Platform.OS === "web" ? 24 : 48,
    paddingBottom:     12,
    paddingHorizontal: 16,
  },
});