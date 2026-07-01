// ============================================
// SERVORA ERP — ScheduleScreen
// ✅ Break threshold auto deduct
// ✅ Net hours saved to Firestore
// ✅ Holiday batch write
// ✅ Apply whole week all statuses
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

  // ── Add employee ──────────────────────────
const handleAddEmployee = async (emp: EmployeeDB) => {
  console.log("🔥 Adding:", emp.employeeNumber, emp.firstName, restaurantId);
  if (!restaurantId) {
    console.log("❌ No restaurantId!");
    return;
  }
  setSaving(true);
  try {
    await createSchedule(restaurantId, emp, selectedWeek);
    console.log("✅ Schedule created!");
  } catch (err: any) {
    console.log("❌ Error:", err?.message);
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

  // ✅ Save with break threshold
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

    try {
      if (applyWholeWeek) {
        const updatedDays = { ...schedule.days };
        weekDates.forEach((date) => {
          updatedDays[date] = { ...updatedDay };
        });
        const stats = buildWeekSummary(updatedDays, weekDates);
        await Promise.all(
          weekDates.map((date) =>
            updateScheduleDay(restaurantId, scheduleId, date, updatedDay, stats)
          )
        );
      } else {
        const updatedDays = { ...schedule.days, [dayKey]: updatedDay };
        const stats       = buildWeekSummary(updatedDays, weekDates);
        await updateScheduleDay(
          restaurantId, scheduleId, dayKey, updatedDay, stats
        );
      }
      setShowCellEditor(false);
      setApplyWholeWeek(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save");
    }
  };

  // ── Delete ────────────────────────────────
  const handleDelete = (emp: EmployeeSchedule) => {
    const doDelete = async () => {
      try {
        await deleteSchedule(restaurantId!, emp.id);
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
      const { copied } = await copyScheduleToNextWeek(
        restaurantId, selectedWeek, employeeMap, getRestaurantSettings()
      );
      setSelectedWeek(addDays(selectedWeek, 7));
      if (Platform.OS === "web") window.alert(`✅ ${copied} employees copied!`);
      else Alert.alert("✅ Copied!", `${copied} employees copied`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Set Holiday batch write ───────────────
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

      setShowHoliday(false);
      Alert.alert(
        "✅ Holiday Set!",
        `Public Holiday applied to all ${schedules.length} employees`
      );
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
