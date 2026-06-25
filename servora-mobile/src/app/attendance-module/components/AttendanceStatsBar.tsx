// ============================================
// SERVORA ERP — AttendanceStatsBar Component
// ✅ AttendanceStats props — no direct hook
// ✅ attendanceRate/absenceRate/lateRate — KPI
// ✅ theme prop bata — no AppContext dependency
// ✅ Pure presentation component
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AttendanceStats } from "../types/attendance-types";
import { formatDuration } from "../utils/attendance-calculations";
import { ATTENDANCE_STATUS_COLORS } from "../constants/attendance-status-colors";

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
}

interface Props {
  stats: AttendanceStats;
  theme: Theme;
}

export function AttendanceStatsBar({ stats, theme }: Props) {

  const cards = [
    {
      label: "Present",
      value: stats.present,
      color: ATTENDANCE_STATUS_COLORS.PRESENT,
      icon:  "check-circle" as const,
    },
    {
      label: "Absent",
      value: stats.absent,
      color: ATTENDANCE_STATUS_COLORS.ABSENT,
      icon:  "cancel" as const,
    },
    {
      label: "Late",
      value: stats.late,
      color: ATTENDANCE_STATUS_COLORS.LATE,
      icon:  "schedule" as const,
    },
    {
      label: "Sick",
      value: stats.sick,
      color: ATTENDANCE_STATUS_COLORS.SICK,
      icon:  "local-hospital" as const,
    },
    {
      label: "Vacation",
      value: stats.vacation,
      color: ATTENDANCE_STATUS_COLORS.VACATION,
      icon:  "beach-access" as const,
    },
    {
      label: "Holiday",
      value: stats.holiday,
      color: ATTENDANCE_STATUS_COLORS.HOLIDAY,
      icon:  "star" as const,
    },
    {
      label: "Day Off",
      value: stats.off,
      color: ATTENDANCE_STATUS_COLORS.OFF,
      icon:  "event-busy" as const,
    },
  ];

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface }]}>

      {/* ── Status Cards ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cards.map((card) => (
          <View
            key={card.label}
            style={[styles.card, { backgroundColor: theme.bg }]}
          >
            <MaterialIcons name={card.icon} size={18} color={card.color} />
            <Text style={[styles.cardValue, { color: card.color }]}>
              {card.value}
            </Text>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
              {card.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* ── KPI Row ── */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: theme.text }]}>
            {formatDuration(stats.totalWorkedHours)}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Worked
          </Text>
        </View>

        <View style={[styles.kpiDivider, { backgroundColor: theme.border }]} />

        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: theme.text }]}>
            {formatDuration(stats.totalOvertimeHours)}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Overtime
          </Text>
        </View>

        <View style={[styles.kpiDivider, { backgroundColor: theme.border }]} />

        <View style={styles.kpiItem}>
          <Text style={[
            styles.kpiValue,
            { color: stats.attendanceRate >= 0.9
              ? ATTENDANCE_STATUS_COLORS.PRESENT
              : ATTENDANCE_STATUS_COLORS.LATE
            }
          ]}>
            {Math.round(stats.attendanceRate * 100)}%
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Attendance
          </Text>
        </View>

        <View style={[styles.kpiDivider, { backgroundColor: theme.border }]} />

        <View style={styles.kpiItem}>
          <Text style={[
            styles.kpiValue,
            { color: stats.absenceRate > 0.1
              ? ATTENDANCE_STATUS_COLORS.ABSENT
              : theme.text
            }
          ]}>
            {Math.round(stats.absenceRate * 100)}%
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Absence
          </Text>
        </View>

        <View style={[styles.kpiDivider, { backgroundColor: theme.border }]} />

        <View style={styles.kpiItem}>
          <Text style={[
            styles.kpiValue,
            { color: stats.lateRate > 0.2
              ? ATTENDANCE_STATUS_COLORS.LATE
              : theme.text
            }
          ]}>
            {Math.round(stats.lateRate * 100)}%
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Late Rate
          </Text>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff15",
  },
  row: {
    paddingHorizontal: 12,
    gap:               8,
    paddingBottom:     10,
  },
  card: {
    alignItems:        "center",
    paddingVertical:   8,
    paddingHorizontal: 14,
    borderRadius:      10,
    gap:               4,
    minWidth:          64,
  },
  cardValue: {
    fontSize:   18,
    fontWeight: "800",
  },
  cardLabel: {
    fontSize: 10,
  },
  kpiRow: {
    flexDirection:     "row",
    paddingHorizontal: 16,
    alignItems:        "center",
    justifyContent:    "space-between",
  },
  kpiItem: {
    flex:       1,
    alignItems: "center",
    gap:        2,
  },
  kpiValue: {
    fontSize:   13,
    fontWeight: "700",
  },
  kpiLabel: {
    fontSize: 10,
  },
  kpiDivider: {
    width:            1,
    height:           28,
    marginHorizontal: 4,
  },
});