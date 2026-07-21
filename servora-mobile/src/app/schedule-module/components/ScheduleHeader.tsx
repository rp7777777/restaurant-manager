// ============================================
// SERVORA ERP — ScheduleHeader Component
// ✅ Set Holiday button added
// ✅ Resync Attendance button — re-syncs the CURRENTLY VIEWED
//    week's already-existing schedule data to Attendance (does not
//    copy/create any new schedule days). Useful when a schedule was
//    populated via an older Copy Next Week that predates a sync fix,
//    or any other historical gap between Schedule and Attendance.
// ✅ fontWeight "800" Android safe
// ✅ Generate Payroll disabled when saving
// ============================================

import React from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface Props {
  isManager: boolean;
  showAddEmployee: boolean;
  hasSchedules: boolean;
  generatingPdf: boolean;
  generatingPayroll: boolean;
  saving: boolean;
  resyncing: boolean;
  onPrint: () => void;
  onToggleAddEmployee: () => void;
  onCopyNextWeek: () => void;
  onGeneratePayroll: () => void;
  onSetHoliday: () => void;
  onResyncAttendance: () => void;
}

export function ScheduleHeader({
  isManager,
  showAddEmployee,
  hasSchedules,
  generatingPdf,
  generatingPayroll,
  saving,
  resyncing,
  onPrint,
  onToggleAddEmployee,
  onCopyNextWeek,
  onGeneratePayroll,
  onSetHoliday,
  onResyncAttendance,
}: Props) {
  return (
    <View>
      {/* Title row */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>SCHEDULE</Text>
          <Text style={styles.subtitle}>Weekly Duty Roster</Text>
        </View>
        <View style={styles.iconBtns}>
          {/* Print */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onPrint}
            disabled={generatingPdf}
          >
            {generatingPdf
              ? <ActivityIndicator size="small" color="#00154f" />
              : <MaterialIcons name="print" size={16} color="#00154f" />
            }
          </TouchableOpacity>

          {/* Add employee */}
          {isManager && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onToggleAddEmployee}
            >
              <MaterialIcons
                name={showAddEmployee ? "close" : "person-add"}
                size={16}
                color="#00154f"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Action bar */}
      {isManager && (
        <View style={styles.actionBar}>
          {hasSchedules && (
            <>
              {/* Copy Next Week */}
              <TouchableOpacity
                style={[styles.copyBtn, saving && { opacity: 0.7 }]}
                onPress={onCopyNextWeek}
                disabled={saving}
              >
                <MaterialIcons name="content-copy" size={13} color="#00154f" />
                <Text style={styles.copyBtnText}>Copy Next Week</Text>
              </TouchableOpacity>

              {/* ✅ Set Holiday */}
              <TouchableOpacity
                style={[styles.holidayBtn, saving && { opacity: 0.7 }]}
                onPress={onSetHoliday}
                disabled={saving}
              >
                <MaterialIcons name="celebration" size={13} color="#fff" />
                <Text style={styles.holidayBtnText}>Set Holiday</Text>
              </TouchableOpacity>

              {/* ✅ Resync Attendance — re-syncs this week's already
                  existing schedule to Attendance, for fixing any
                  historical gap without re-copying anything. */}
              <TouchableOpacity
                style={[styles.resyncBtn, resyncing && { opacity: 0.7 }]}
                onPress={onResyncAttendance}
                disabled={resyncing}
              >
                {resyncing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialIcons name="sync" size={13} color="#fff" />
                }
                <Text style={styles.resyncBtnText}>Resync Attendance</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Generate Payroll */}
          <TouchableOpacity
            style={[
              styles.payrollBtn,
              (generatingPayroll || saving) && { opacity: 0.7 },
            ]}
            onPress={onGeneratePayroll}
            disabled={generatingPayroll || saving}
          >
            {generatingPayroll
              ? <ActivityIndicator size="small" color="#fff" />
              : <MaterialIcons name="payments" size={13} color="#fff" />
            }
            <Text style={styles.payrollBtnText}>Generate Payroll</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   10,
  },
  title:    { color: "#FFD700", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 },
  iconBtns: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width:          34,
    height:         34,
    borderRadius:   17,
    backgroundColor: "#FFD700",
    alignItems:     "center",
    justifyContent: "center",
  },
  actionBar: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  copyBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: "#FFD700",
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:    8,
  },
  copyBtnText: { color: "#00154f", fontSize: 11, fontWeight: "800" },
  holidayBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:    8,
  },
  holidayBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  // ✅ Resync Attendance button
  resyncBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: "#0891b2",
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:    8,
  },
  resyncBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  payrollBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:    8,
  },
  payrollBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});