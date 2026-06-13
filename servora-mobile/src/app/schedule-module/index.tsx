// ============================================
// SERVORA ERP — Schedule Module v2
// English days + Calendar + Auto Payroll
// Service layer connected
// ============================================

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Platform, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection, addDoc, onSnapshot, query,
  doc, updateDoc, deleteDoc,
  serverTimestamp, where, getDocs,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useApp } from "../../context/AppContext";
import { generateMonthlyPayroll } from "../../services/payroll-service";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ── Types ────────────────────────────────────
type DayStatus = "WORK" | "DO" | "DC" | "ABSENT" | "HOLIDAY";

interface DaySchedule {
  status: DayStatus;
  startTime: string;
  endTime: string;
  hours: number;
}

interface EmployeeSchedule {
  id: string;
  employeeNo: string;
  employeeName: string;
  category: string;
  basicSalary: number;
  weekStart: string;
  days: Record<string, DaySchedule>;
  totalHours: number;
  overtimeHours: number;
  workingDays: number;
  absentDays: number;
  holidayDays: number;
  restaurantId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── Constants ─────────────────────────────────
const DAYS_EN = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

const POSITIONS = [
  "Chef 3rd","Chef 2nd","Head Chef",
  "Waiter/Waitress","Supervisor","Cashier",
  "Store Keeper","Manager",
];

const STATUS_COLORS: Record<DayStatus, string> = {
  WORK:    "#10b981",
  DO:      "#f97316",
  DC:      "#dc2626",
  ABSENT:  "#94a3b8",
  HOLIDAY: "#8b5cf6",
};

const STATUS_BG: Record<DayStatus, string> = {
  WORK:    "#10b98115",
  DO:      "#f9731615",
  DC:      "#dc262615",
  ABSENT:  "#94a3b815",
  HOLIDAY: "#8b5cf615",
};

const NORMAL_DAILY_HOURS = 8;

// ── Helpers ───────────────────────────────────
function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em)) return 0;
  return Math.max(0, parseFloat(((eh*60+em - sh*60-sm)/60).toFixed(2)));
}

function formatDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function formatFull(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function getMonthWeeks(year: number, month: number): string[] {
  const weeks: string[] = [];
  const start = new Date(year, month, 1);
  const dow = start.getDay();
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  const end = new Date(year, month + 1, 0);
  const cur = new Date(start);
  while (cur <= end) {
    weeks.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function recalcStats(days: Record<string, DaySchedule>, weekDates: string[]) {
  let totalHours = 0, workingDays = 0, absentDays = 0, holidayDays = 0;
  weekDates.forEach((date) => {
    const day = days[date];
    if (!day) return;
    if (day.status === "WORK") { totalHours += day.hours; workingDays++; }
    else if (day.status === "ABSENT") absentDays++;
    else if (day.status === "HOLIDAY") holidayDays++;
  });
  return {
    totalHours,
    overtimeHours: Math.max(0, totalHours - workingDays * NORMAL_DAILY_HOURS),
    workingDays, absentDays, holidayDays,
  };
}

// ── Main Screen ───────────────────────────────
export default function ScheduleScreen() {
  const { theme, restaurant, restaurantId, userProfile } = useApp();

  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);

  const today = new Date();
  const [selectedWeek, setSelectedWeek] = useState(getMondayOfWeek(today));
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [showCellEditor, setShowCellEditor] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    scheduleId: string; dayKey: string; current: DaySchedule;
  } | null>(null);

  const [newEmpNo, setNewEmpNo] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newCategory, setNewCategory] = useState("Waiter/Waitress");

  const [cellStatus, setCellStatus] = useState<DayStatus>("WORK");
  const [cellStart, setCellStart] = useState("09:00");
  const [cellEnd, setCellEnd] = useState("17:00");

  const weekDates = getWeekDates(selectedWeek);
  const isManager = ["MANAGER","OWNER"].includes(userProfile?.role ?? "");

  // ── Load schedules ─────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, "restaurants", restaurantId, "schedules"),
      where("weekStart", "==", selectedWeek)
    );
    return onSnapshot(q, (snap) => {
      setSchedules(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<EmployeeSchedule,"id">),
      })));
      setLoading(false);
    }, () => setLoading(false));
  }, [restaurantId, selectedWeek]);

  // ── Week navigation ────────────────────────
  const goWeek = (dir: 1 | -1) => {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + dir * 7);
    setSelectedWeek(d.toISOString().split("T")[0]);
  };

  // ── Add employee ───────────────────────────
  const handleAddEmployee = async () => {
    if (!newEmpNo.trim() || !newEmpName.trim()) {
      Alert.alert("Error","Employee No. and Name required"); return;
    }
    if (schedules.find((s) => s.employeeNo === newEmpNo.trim())) {
      Alert.alert("Duplicate",`${newEmpNo} already in this week`); return;
    }
    if (!restaurantId) return;
    setSaving(true);
    try {
      const days: Record<string, DaySchedule> = {};
      weekDates.forEach((date) => {
        days[date] = { status:"WORK", startTime:"09:00", endTime:"17:00", hours: calcHours("09:00","17:00") };
      });
      const stats = recalcStats(days, weekDates);
      await addDoc(collection(db,"restaurants",restaurantId,"schedules"), {
        employeeNo: newEmpNo.trim(),
        employeeName: newEmpName.trim(),
        category: newCategory,
        basicSalary: 0,
        weekStart: selectedWeek,
        days, ...stats,
        restaurantId,
        userId: auth.currentUser?.uid ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewEmpNo(""); setNewEmpName("");
      setShowAddEmployee(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Cell editor ────────────────────────────
  const openCell = (scheduleId: string, dayKey: string, current: DaySchedule) => {
    if (!isManager) return;
    setEditingCell({ scheduleId, dayKey, current });
    setCellStatus(current.status);
    setCellStart(current.startTime || "09:00");
    setCellEnd(current.endTime || "17:00");
    setShowCellEditor(true);
  };

  const saveCellEdit = async () => {
    if (!editingCell || !restaurantId) return;
    const { scheduleId, dayKey } = editingCell;
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    const updatedDay: DaySchedule = {
      status: cellStatus,
      startTime: cellStatus === "WORK" ? cellStart : "",
      endTime:   cellStatus === "WORK" ? cellEnd   : "",
      hours:     cellStatus === "WORK" ? calcHours(cellStart, cellEnd) : 0,
    };
    const updatedDays = { ...schedule.days, [dayKey]: updatedDay };
    const stats = recalcStats(updatedDays, weekDates);
    try {
      await updateDoc(doc(db,"restaurants",restaurantId,"schedules",scheduleId), {
        [`days.${dayKey}`]: updatedDay, ...stats, updatedAt: serverTimestamp(),
      });
      setShowCellEditor(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    }
  };

  // ── Copy next week ─────────────────────────
  const copyToNextWeek = async () => {
    if (!restaurantId || schedules.length === 0) return;

    const confirmed = Platform.OS === "web"
      ? window.confirm(`Copy ${schedules.length} employees to next week?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Copy to Next Week", `Copy ${schedules.length} employees?`, [
            { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
            { text: "Copy", onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;

    setSaving(true);
    try {
      const nextMonday = new Date(selectedWeek);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const nextWeekStr = nextMonday.toISOString().split("T")[0];
      const nextDates = getWeekDates(nextWeekStr);
      const existing = await getDocs(query(
        collection(db,"restaurants",restaurantId,"schedules"),
        where("weekStart","==",nextWeekStr)
      ));
      const existingNos = new Set(existing.docs.map((d) => d.data().employeeNo));
      for (const emp of schedules) {
        if (existingNos.has(emp.employeeNo)) continue;
        const oldDates = getWeekDates(emp.weekStart);
        const newDays: Record<string, DaySchedule> = {};
        oldDates.forEach((oldDate, idx) => {
          if (emp.days[oldDate] && nextDates[idx]) {
            newDays[nextDates[idx]] = { ...emp.days[oldDate] };
          }
        });
        const stats = recalcStats(newDays, nextDates);
        await addDoc(collection(db,"restaurants",restaurantId,"schedules"), {
          employeeNo: emp.employeeNo,
          employeeName: emp.employeeName,
          category: emp.category,
          basicSalary: emp.basicSalary,
          weekStart: nextWeekStr,
          days: newDays, ...stats,
          restaurantId,
          userId: auth.currentUser?.uid ?? "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setSelectedWeek(nextWeekStr);
      if (Platform.OS === "web") {
        window.alert("✅ Schedule copied to next week!");
      } else {
        Alert.alert("✅ Copied!", "Schedule copied to next week");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete employee ────────────────────────
  const handleDelete = (emp: EmployeeSchedule) => {
    Alert.alert("Remove", `Remove ${emp.employeeName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db,"restaurants",restaurantId,"schedules",emp.id));
      }},
    ]);
  };

  // ── Generate Payroll ──────────────────────
  const generateMonthPayroll = async () => {
    if (!restaurantId) return;
    const monthStr =
      new Date(calendarYear, calendarMonth)
        .toLocaleString("en-GB", { month: "short" }) + `-${calendarYear}`;

    const confirmed = Platform.OS === "web"
      ? window.confirm(`Generate salary slips for ${monthStr}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Generate Payroll", `Generate salary slips for ${monthStr}?`, [
            { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
            { text: "Generate", onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;

    setGeneratingPayroll(true);
    try {
      const { created, skipped } = await generateMonthlyPayroll(
        restaurantId, calendarYear, calendarMonth, monthStr
      );
      const msg = `${created} slips created\n${skipped} already existed`;
      if (Platform.OS === "web") {
        window.alert(`✅ Done!\n${msg}\n\nGo to Payroll to view.`);
      } else {
        Alert.alert("✅ Done!", `${msg}\n\nGo to Payroll to view.`);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setGeneratingPayroll(false);
    }
  };

  // ── PDF ────────────────────────────────────
  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      const restName = restaurant?.name ?? "SERVORA ERP";
      const rows = schedules.map((emp) => {
        const cells = weekDates.map((date) => {
          const day = emp.days[date];
          if (!day) return "<td style='text-align:center;padding:5px'>-</td>";
          const colors: Record<DayStatus,string> = {
            WORK:"#10b981",DO:"#f97316",DC:"#dc2626",ABSENT:"#94a3b8",HOLIDAY:"#8b5cf6",
          };
          if (day.status === "WORK")
            return `<td style='text-align:center;padding:5px;font-size:10px'>${day.startTime}/${day.endTime}</td>`;
          return `<td style='text-align:center;padding:5px;color:${colors[day.status]};font-weight:bold'>${day.status}</td>`;
        }).join("");
        return `<tr>
          <td style='padding:5px'>${emp.employeeNo}</td>
          <td style='padding:5px;font-weight:bold'>${emp.employeeName}</td>
          <td style='padding:5px;font-size:10px'>${emp.category}</td>
          ${cells}
          <td style='text-align:center;padding:5px'>${(emp.totalHours||0).toFixed(1)}</td>
          <td style='text-align:center;padding:5px;color:#3b82f6;font-weight:bold'>${(emp.overtimeHours||0).toFixed(1)}</td>
          <td style='text-align:center;padding:5px;color:#ef4444'>${emp.absentDays||0}</td>
        </tr>`;
      }).join("");

      const dayHeaders = weekDates.map((date, idx) =>
        `<th style='padding:6px;background:#00154f;color:#FFD700;min-width:80px'>
          ${DAYS_EN[idx]}<br/><span style='font-size:9px'>${formatDisplay(date)}</span>
        </th>`
      ).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>body{font-family:Arial;font-size:11px;margin:20px}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px}</style>
        </head><body>
        <h2 style='color:#00154f;margin:0'>${restName}</h2>
        <h3 style='color:#444;margin:4px 0'>Weekly Schedule: ${formatFull(weekDates[0])} — ${formatFull(weekDates[6])}</h3>
        <table><thead><tr>
          <th style='background:#00154f;color:#FFD700'>No</th>
          <th style='background:#00154f;color:#FFD700'>Name</th>
          <th style='background:#00154f;color:#FFD700'>Position</th>
          ${dayHeaders}
          <th style='background:#00154f;color:#FFD700'>Total(h)</th>
          <th style='background:#00154f;color:#FFD700'>OT(h)</th>
          <th style='background:#00154f;color:#FFD700'>ABS</th>
        </tr></thead><tbody>${rows}</tbody></table>
        <div style='margin-top:10px;font-size:10px;color:#666'>
          DO=Day Off (Mandatory) | DC=Day Off (Complementary) | ABS=Absent | HOL=Holiday
        </div>
        <div style='margin-top:20px;display:flex;justify-content:space-between'>
          <div>Manager: _______________</div><div>Date: _______________</div>
        </div></body></html>`;

      if (Platform.OS === "web") {
        const win = window.open("","_blank");
        if (win) { win.document.write(html); win.document.close(); win.print(); }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { mimeType:"application/pdf" });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const totalOT = schedules.reduce((s,e) => s + (e.overtimeHours||0), 0);
  const totalAbsent = schedules.reduce((s,e) => s + (e.absentDays||0), 0);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <LinearGradient colors={["#00154f","#0039cb"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>SCHEDULE</Text>
            <Text style={styles.headerSub}>Weekly Duty Roster</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.iconBtn} onPress={generatePDF} disabled={generatingPdf}>
              {generatingPdf
                ? <ActivityIndicator size="small" color="#00154f" />
                : <MaterialIcons name="print" size={16} color="#00154f" />}
            </TouchableOpacity>
            {isManager && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddEmployee(!showAddEmployee)}>
                <MaterialIcons name={showAddEmployee ? "close" : "person-add"} size={16} color="#00154f" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Week nav */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => goWeek(-1)} style={styles.weekArrow}>
            <MaterialIcons name="chevron-left" size={24} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.weekDisplay} onPress={() => setShowCalendar(true)}>
            <MaterialIcons name="calendar-today" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.weekText}>
              {formatFull(weekDates[0])} — {formatFull(weekDates[6])}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goWeek(1)} style={styles.weekArrow}>
            <MaterialIcons name="chevron-right" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {/* Action bar */}
        <View style={styles.actionBar}>
          {isManager && schedules.length > 0 && (
            <TouchableOpacity style={styles.copyBtn} onPress={copyToNextWeek} disabled={saving}>
              <MaterialIcons name="content-copy" size={13} color="#00154f" />
              <Text style={styles.copyBtnText}>Copy Next Week</Text>
            </TouchableOpacity>
          )}
          {isManager && (
            <TouchableOpacity
              style={[styles.payrollBtn, generatingPayroll && { opacity:0.7 }]}
              onPress={generateMonthPayroll}
              disabled={generatingPayroll}
            >
              {generatingPayroll
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialIcons name="payments" size={13} color="#fff" />}
              <Text style={styles.payrollBtnText}>Generate Payroll</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Add Employee */}
      {showAddEmployee && isManager && (
        <View style={[styles.addForm, { backgroundColor:theme.card, borderBottomColor:theme.border }]}>
          <Text style={[styles.addFormTitle, { color:theme.text }]}>Add Employee</Text>
          <View style={styles.addFormRow}>
            <TextInput
              style={[styles.addInputField, { flex:0.7, backgroundColor:theme.bg, borderColor:theme.border, color:theme.text }]}
              placeholder="No."
              placeholderTextColor={theme.textSecondary}
              value={newEmpNo}
              onChangeText={setNewEmpNo}
            />
            <TextInput
              style={[styles.addInputField, { flex:2, backgroundColor:theme.bg, borderColor:theme.border, color:theme.text }]}
              placeholder="Full Name"
              placeholderTextColor={theme.textSecondary}
              value={newEmpName}
              onChangeText={setNewEmpName}
            />
          </View>
          <TouchableOpacity
            style={[styles.posSelector,{backgroundColor:theme.bg,borderColor:theme.border}]}
            onPress={() => setShowPositionPicker(true)}
          >
            <Text style={[styles.posSelectorText,{color:theme.text}]}>{newCategory}</Text>
            <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addEmpBtn,{backgroundColor:theme.primary},saving&&{opacity:0.7}]}
            onPress={handleAddEmployee} disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.addEmpBtnText}>Add to This Week</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Stats bar */}
      <View style={[styles.statsBar,{backgroundColor:theme.card,borderBottomColor:theme.border}]}>
        {[
          { label:"Employees", value:schedules.length, color:"#3b82f6" },
          { label:"Total OT (h)", value:totalOT.toFixed(1), color:"#f59e0b" },
          { label:"Absences", value:totalAbsent, color:"#ef4444" },
        ].map(({label,value,color}) => (
          <View key={label} style={styles.statItem}>
            <Text style={[styles.statValue,{color}]}>{value}</Text>
            <Text style={[styles.statLabel,{color:theme.textSecondary}]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Table */}
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{marginTop:40}} />
      ) : (
        <ScrollView style={styles.tableScroll} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[styles.tableHead,{backgroundColor:"#00154f"}]}>
                <Text style={styles.thNo}>NO</Text>
                <Text style={styles.thName}>NAME</Text>
                <Text style={styles.thCat}>POSITION</Text>
                {weekDates.map((date,idx) => (
                  <View key={date} style={styles.thDay}>
                    <Text style={styles.thDayName}>{DAYS_EN[idx]}</Text>
                    <Text style={styles.thDayDate}>{formatDisplay(date)}</Text>
                  </View>
                ))}
                <Text style={styles.thTotal}>TOT(h)</Text>
                <Text style={styles.thOT}>OT(h)</Text>
                <Text style={styles.thAbs}>ABS</Text>
                {isManager && <Text style={styles.thDel}></Text>}
              </View>

              {schedules.length === 0 ? (
                <View style={[styles.emptyRow,{backgroundColor:theme.card}]}>
                  <MaterialIcons name="people-outline" size={32} color={theme.textSecondary} />
                  <Text style={[styles.emptyText,{color:theme.textSecondary}]}>No employees this week</Text>
                </View>
              ) : (
                schedules.map((emp, idx) => (
                  <View
                    key={emp.id}
                    style={[
                      styles.empRow,
                      { backgroundColor: idx%2===0 ? theme.card : theme.bg },
                      { borderBottomColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.tdNo,{color:theme.textSecondary}]}>{emp.employeeNo}</Text>
                    <Text style={[styles.tdName,{color:theme.text}]}>{emp.employeeName}</Text>
                    <Text style={[styles.tdCat,{color:theme.textSecondary}]} numberOfLines={1}>{emp.category}</Text>
                    {weekDates.map((date) => {
                      const day = emp.days[date] ?? { status:"WORK" as DayStatus, startTime:"09:00", endTime:"17:00", hours:8 };
                      const color = STATUS_COLORS[day.status];
                      const bg = STATUS_BG[day.status];
                      return (
                        <TouchableOpacity
                          key={date}
                          style={[styles.tdDay,{backgroundColor:bg}]}
                          onPress={() => openCell(emp.id, date, day)}
                          activeOpacity={isManager ? 0.7 : 1}
                        >
                          {day.status === "WORK" ? (
                            <Text style={[styles.tdTime,{color:theme.text}]}>{day.startTime}/{day.endTime}</Text>
                          ) : (
                            <Text style={[styles.tdStatus,{color}]}>{day.status}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={[styles.tdTotal,{color:"#3b82f6"}]}>{(emp.totalHours||0).toFixed(1)}</Text>
                    <Text style={[styles.tdOT,{
                      color: (emp.overtimeHours||0)>0 ? "#f59e0b" : theme.textSecondary,
                      fontWeight: (emp.overtimeHours||0)>0 ? "800" : "400",
                    }]}>{(emp.overtimeHours||0).toFixed(1)}</Text>
                    <Text style={[styles.tdAbs,{
                      color: (emp.absentDays||0)>0 ? "#ef4444" : theme.textSecondary,
                    }]}>{emp.absentDays||0}</Text>
                    {isManager && (
                      <TouchableOpacity style={styles.tdDel} onPress={() => handleDelete(emp)}>
                        <MaterialIcons name="remove-circle-outline" size={15} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}

              <View style={[styles.legend,{backgroundColor:theme.card,borderTopColor:theme.border}]}>
                {Object.entries(STATUS_COLORS).map(([status,color]) => (
                  <View key={status} style={styles.legendItem}>
                    <View style={[styles.legendDot,{backgroundColor:color}]} />
                    <Text style={[styles.legendText,{color:theme.textSecondary}]}>
                      {status==="WORK"?"Working":status==="DO"?"Day Off (Mandatory)":
                       status==="DC"?"Day Off (Complementary)":status==="ABSENT"?"Absent (No Pay)":"Public Holiday"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCalendar(false)}>
          <View style={[styles.calendarCard,{backgroundColor:theme.surface}]} onStartShouldSetResponder={()=>true}>
            <View style={styles.calMonthNav}>
              <TouchableOpacity onPress={() => {
                if (calendarMonth===0){setCalendarMonth(11);setCalendarYear(y=>y-1);}
                else setCalendarMonth(m=>m-1);
              }}>
                <MaterialIcons name="chevron-left" size={22} color={theme.primary} />
              </TouchableOpacity>
              <Text style={[styles.calMonthTitle,{color:theme.text}]}>
                {new Date(calendarYear,calendarMonth).toLocaleString("en-GB",{month:"long",year:"numeric"})}
              </Text>
              <TouchableOpacity onPress={() => {
                if (calendarMonth===11){setCalendarMonth(0);setCalendarYear(y=>y+1);}
                else setCalendarMonth(m=>m+1);
              }}>
                <MaterialIcons name="chevron-right" size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.calHint,{color:theme.textSecondary}]}>Tap a week to select</Text>
            {getMonthWeeks(calendarYear,calendarMonth).map((monday) => {
              const dates = getWeekDates(monday);
              const isSelected = monday === selectedWeek;
              return (
                <TouchableOpacity
                  key={monday}
                  style={[styles.calWeekRow,{borderColor:theme.border},
                    isSelected && {backgroundColor:theme.primary+"22",borderColor:theme.primary}]}
                  onPress={() => { setSelectedWeek(monday); setShowCalendar(false); }}
                >
                  {dates.map((date,idx) => (
                    <View key={date} style={styles.calDay}>
                      <Text style={[styles.calDayName,{color:theme.textSecondary}]}>{DAYS_EN[idx]}</Text>
                      <Text style={[styles.calDayNum,{
                        color: isSelected ? theme.primary : theme.text,
                        fontWeight: isSelected ? "800" : "500",
                      }]}>{new Date(date).getDate()}</Text>
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Cell Editor Modal */}
      <Modal visible={showCellEditor} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCellEditor(false)}>
          <View style={[styles.cellModal,{backgroundColor:theme.surface}]} onStartShouldSetResponder={()=>true}>
            <Text style={[styles.cellModalTitle,{color:theme.text}]}>
              {editingCell && new Date(editingCell.dayKey).toLocaleDateString("en-GB",{
                weekday:"long",day:"numeric",month:"short",
              })}
            </Text>
            <View style={styles.statusGrid}>
              {(["WORK","DO","DC","ABSENT","HOLIDAY"] as DayStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusBtn,{borderColor:STATUS_COLORS[s]},
                    cellStatus===s && {backgroundColor:STATUS_COLORS[s]}]}
                  onPress={() => setCellStatus(s)}
                >
                  <Text style={[styles.statusBtnText,{
                    color: cellStatus===s ? "#fff" : STATUS_COLORS[s],
                  }]}>
                    {s==="WORK"?"Working":s==="DO"?"Day Off (DO)":
                     s==="DC"?"Day Off (DC)":s==="ABSENT"?"Absent":"Holiday"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {cellStatus === "WORK" && (
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={[styles.timeLabel,{color:theme.textSecondary}]}>START</Text>
                  <TextInput
                    style={[styles.timeInput,{backgroundColor:theme.bg,borderColor:theme.border,color:theme.text}]}
                    value={cellStart} onChangeText={setCellStart} placeholder="09:00"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <Text style={[styles.timeSep,{color:theme.textSecondary}]}>/</Text>
                <View style={styles.timeField}>
                  <Text style={[styles.timeLabel,{color:theme.textSecondary}]}>END</Text>
                  <TextInput
                    style={[styles.timeInput,{backgroundColor:theme.bg,borderColor:theme.border,color:theme.text}]}
                    value={cellEnd} onChangeText={setCellEnd} placeholder="17:00"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={[styles.timeLabel,{color:theme.textSecondary}]}>HOURS</Text>
                  <View style={[styles.timeInput,{backgroundColor:"#3b82f615",borderColor:"#3b82f6",justifyContent:"center"}]}>
                    <Text style={{color:"#3b82f6",fontWeight:"800",textAlign:"center",fontSize:14}}>
                      {calcHours(cellStart,cellEnd).toFixed(1)}h
                    </Text>
                  </View>
                </View>
              </View>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn,{backgroundColor:theme.primary}]} onPress={saveCellEdit}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn,{backgroundColor:theme.border}]} onPress={() => setShowCellEditor(false)}>
                <Text style={[styles.modalBtnText,{color:theme.text}]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Position Picker */}
      <Modal visible={showPositionPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPositionPicker(false)}>
          <View style={[styles.pickerCard,{backgroundColor:theme.surface}]}>
            <Text style={[styles.pickerTitle,{color:theme.text}]}>Select Position</Text>
            <ScrollView>
              {POSITIONS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pickerItem,{borderBottomColor:theme.border},
                    newCategory===p && {backgroundColor:theme.sidebarActive}]}
                  onPress={() => { setNewCategory(p); setShowPositionPicker(false); }}
                >
                  <Text style={[styles.pickerItemText,{color:theme.text}]}>{p}</Text>
                  {newCategory===p && <MaterialIcons name="check" size={14} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const W = { NO:46, NAME:150, CAT:130, DAY:100, TOT:60, OT:55, ABS:45, DEL:36 };

const styles = StyleSheet.create({
  root: { flex:1 },
  header: { paddingTop: Platform.OS==="web" ? 24 : 48, paddingBottom:12, paddingHorizontal:16 },
  headerTop: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  headerTitle: { color:"#FFD700", fontSize:22, fontWeight:"900" },
  headerSub: { color:"rgba(255,255,255,0.65)", fontSize:11, marginTop:2 },
  headerBtns: { flexDirection:"row", gap:8 },
  iconBtn: { width:34, height:34, borderRadius:17, backgroundColor:"#FFD700", alignItems:"center", justifyContent:"center" },
  weekNav: { flexDirection:"row", alignItems:"center", gap:8, marginBottom:8 },
  weekArrow: { padding:2 },
  weekDisplay: { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, backgroundColor:"rgba(255,255,255,0.1)", paddingVertical:6, borderRadius:8 },
  weekText: { color:"#fff", fontSize:12, fontWeight:"700" },
  actionBar: { flexDirection:"row", gap:8 },
  copyBtn: { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"#FFD700", paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  copyBtnText: { color:"#00154f", fontSize:11, fontWeight:"800" },
  payrollBtn: { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"#10b981", paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  payrollBtnText: { color:"#fff", fontSize:11, fontWeight:"800" },
  addForm: { padding:12, borderBottomWidth:1 },
  addFormTitle: { fontSize:13, fontWeight:"700", marginBottom:8 },
  addFormRow: { flexDirection:"row", gap:6, marginBottom:6 },
  // ✅ FIX: addInputField added here
  addInputField: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 6,
  },
  inputWrap: { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderRadius:8, paddingHorizontal:8, paddingVertical:8 },
  input: { flex:1, fontSize:13, padding:0 },
  posSelector: { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderRadius:8, paddingHorizontal:10, paddingVertical:8, marginBottom:8 },
  posSelectorText: { flex:1, fontSize:13 },
  addEmpBtn: { padding:10, borderRadius:8, alignItems:"center" },
  addEmpBtnText: { color:"#fff", fontSize:13, fontWeight:"700" },
  statsBar: { flexDirection:"row", padding:10, borderBottomWidth:1, gap:16 },
  statItem: { alignItems:"center" },
  statValue: { fontSize:16, fontWeight:"900" },
  statLabel: { fontSize:9, fontWeight:"600" },
  tableScroll: { flex:1 },
  tableHead: { flexDirection:"row", alignItems:"center", paddingVertical:8, paddingHorizontal:4 },
  thNo: { width:W.NO, color:"#FFD700", fontSize:9, fontWeight:"800", paddingHorizontal:2 },
  thName: { width:W.NAME, color:"#FFD700", fontSize:9, fontWeight:"800", paddingHorizontal:2 },
  thCat: { width:W.CAT, color:"#FFD700", fontSize:9, fontWeight:"800", paddingHorizontal:2 },
  thDay: { width:W.DAY, alignItems:"center" },
  thDayName: { color:"#FFD700", fontSize:9, fontWeight:"800" },
  thDayDate: { color:"rgba(255,215,0,0.7)", fontSize:8 },
  thTotal: { width:W.TOT, color:"#FFD700", fontSize:9, fontWeight:"800", textAlign:"center" },
  thOT: { width:W.OT, color:"#FFD700", fontSize:9, fontWeight:"800", textAlign:"center" },
  thAbs: { width:W.ABS, color:"#FFD700", fontSize:9, fontWeight:"800", textAlign:"center" },
  thDel: { width:W.DEL },
  empRow: { flexDirection:"row", alignItems:"center", borderBottomWidth:0.5, paddingVertical:4, paddingHorizontal:4 },
  tdNo: { width:W.NO, fontSize:11, paddingHorizontal:2 },
  tdName: { width:W.NAME, fontSize:12, fontWeight:"700", paddingHorizontal:2 },
  tdCat: { width:W.CAT, fontSize:10, paddingHorizontal:2 },
  tdDay: { width:W.DAY, height:38, alignItems:"center", justifyContent:"center", borderRadius:4, margin:1 },
  tdTime: { fontSize:9, fontWeight:"600", textAlign:"center" },
  tdStatus: { fontSize:10, fontWeight:"800" },
  tdTotal: { width:W.TOT, fontSize:11, fontWeight:"700", textAlign:"center" },
  tdOT: { width:W.OT, fontSize:11, textAlign:"center" },
  tdAbs: { width:W.ABS, fontSize:11, textAlign:"center" },
  tdDel: { width:W.DEL, alignItems:"center" },
  emptyRow: { padding:40, alignItems:"center", gap:8 },
  emptyText: { fontSize:13 },
  legend: { flexDirection:"row", flexWrap:"wrap", gap:10, padding:10, borderTopWidth:1 },
  legendItem: { flexDirection:"row", alignItems:"center", gap:5 },
  legendDot: { width:8, height:8, borderRadius:4 },
  legendText: { fontSize:10 },
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.55)", justifyContent:"center", alignItems:"center", padding:16 },
  calendarCard: { width:"100%", maxWidth:480, borderRadius:18, padding:16 },
  calMonthNav: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:8 },
  calMonthTitle: { fontSize:15, fontWeight:"800" },
  calHint: { fontSize:11, marginBottom:8, textAlign:"center" },
  calWeekRow: { flexDirection:"row", borderWidth:1, borderRadius:8, marginBottom:6, overflow:"hidden" },
  calDay: { flex:1, alignItems:"center", paddingVertical:8 },
  calDayName: { fontSize:9, fontWeight:"700" },
  calDayNum: { fontSize:14, marginTop:2 },
  cellModal: { width:"100%", maxWidth:380, borderRadius:18, padding:18 },
  cellModalTitle: { fontSize:15, fontWeight:"800", marginBottom:14 },
  statusGrid: { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:14 },
  statusBtn: { paddingHorizontal:10, paddingVertical:7, borderRadius:8, borderWidth:1.5 },
  statusBtnText: { fontSize:11, fontWeight:"700" },
  timeRow: { flexDirection:"row", alignItems:"flex-end", gap:8, marginBottom:14 },
  timeField: { flex:1 },
  timeLabel: { fontSize:9, fontWeight:"700", marginBottom:4 },
  timeInput: { borderWidth:1.5, borderRadius:8, padding:8, fontSize:14, fontWeight:"700", textAlign:"center" },
  timeSep: { fontSize:20, fontWeight:"800", paddingBottom:8 },
  modalBtns: { flexDirection:"row", gap:10 },
  modalBtn: { flex:1, padding:12, borderRadius:10, alignItems:"center" },
  modalBtnText: { color:"#fff", fontSize:14, fontWeight:"700" },
  pickerCard: { width:"100%", maxWidth:340, borderRadius:16, overflow:"hidden", maxHeight:380 },
  pickerTitle: { fontSize:15, fontWeight:"800", padding:16, paddingBottom:8 },
  pickerItem: { flexDirection:"row", alignItems:"center", gap:10, padding:12, borderBottomWidth:1 },
  pickerItemText: { fontSize:13, fontWeight:"600", flex:1 },
});