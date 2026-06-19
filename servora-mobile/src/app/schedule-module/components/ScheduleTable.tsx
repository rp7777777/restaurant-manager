// ============================================
// SERVORA ERP — ScheduleTable Component
// ✅ theme passed as prop — not per row
// ✅ removeClippedSubviews web fix
// ✅ React.memo with stable props
// ✅ FlatList performance props
// ============================================

import React, { memo, useCallback } from "react";
import {
  View, Text, FlatList,
  ScrollView, TouchableOpacity,
  StyleSheet, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmployeeSchedule, DayStatus, DaySchedule } from "../types/schedule-types";
import { STATUS_COLORS, STATUS_BG } from "../constants/statuses";
import { DAYS_EN } from "../constants/schedule-config";
import { formatDisplay } from "../utils/date-utils";
import { ScheduleLegend } from "./ScheduleLegend";

const W = { NO: 46, NAME: 150, CAT: 130, DAY: 100, TOT: 60, OT: 55, ABS: 45, DEL: 36 };

interface Theme {
  card: string;
  bg: string;
  border: string;
  text: string;
  textSecondary: string;
}

interface RowProps {
  emp: EmployeeSchedule;
  idx: number;
  weekDates: string[];
  isManager: boolean;
  theme: Theme;
  onCellPress: (scheduleId: string, dayKey: string, current: DaySchedule) => void;
  onDelete: (schedule: EmployeeSchedule) => void;
}

// ✅ React.memo — theme as prop, not useApp per row
const ScheduleRow = memo(({
  emp, idx, weekDates, isManager, theme, onCellPress, onDelete,
}: RowProps) => (
  <View
    style={[
      styles.empRow,
      { backgroundColor: idx % 2 === 0 ? theme.card : theme.bg },
      { borderBottomColor: theme.border },
    ]}
  >
    <Text style={[styles.tdNo, { color: theme.textSecondary }]}>
      {emp.employeeNo}
    </Text>
    <Text style={[styles.tdName, { color: theme.text }]}>
      {emp.employeeName}
    </Text>
    <Text
      style={[styles.tdCat, { color: theme.textSecondary }]}
      numberOfLines={1}
    >
      {emp.position}
    </Text>

    {weekDates.map((date) => {
      const day = emp.days[date];
      if (!day) {
        return (
          <View
            key={date}
            style={[styles.tdDay, { backgroundColor: "transparent" }]}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>—</Text>
          </View>
        );
      }

      const color = STATUS_COLORS[day.status as DayStatus] ?? "#94a3b8";
      const bg    = STATUS_BG[day.status as DayStatus]    ?? "#94a3b815";

      return (
        <TouchableOpacity
          key={date}
          style={[styles.tdDay, { backgroundColor: bg }]}
          onPress={() => {
            if (isManager) onCellPress(emp.id, date, day);
          }}
          activeOpacity={isManager ? 0.7 : 1}
        >
          {day.status === "WORK" ? (
            <Text style={[styles.tdTime, { color: theme.text }]}>
              {day.startTime}/{day.endTime}
            </Text>
          ) : (
            <Text style={[styles.tdStatus, { color }]}>
              {day.status}
            </Text>
          )}
        </TouchableOpacity>
      );
    })}

    <Text style={[styles.tdTotal, { color: "#3b82f6" }]}>
      {(emp.totalHours || 0).toFixed(1)}
    </Text>
    <Text style={[styles.tdOT, {
      color:      (emp.overtimeHours || 0) > 0 ? "#f59e0b" : theme.textSecondary,
      fontWeight: (emp.overtimeHours || 0) > 0 ? "800" : "500",
    }]}>
      {(emp.overtimeHours || 0).toFixed(1)}
    </Text>
    <Text style={[styles.tdAbs, {
      color: (emp.absentDays || 0) > 0 ? "#ef4444" : theme.textSecondary,
    }]}>
      {emp.absentDays || 0}
    </Text>

    {isManager && (
      <TouchableOpacity
        style={styles.tdDel}
        onPress={() => onDelete(emp)}
      >
        <MaterialIcons name="remove-circle-outline" size={15} color="#ef4444" />
      </TouchableOpacity>
    )}
  </View>
));

interface Props {
  schedules: EmployeeSchedule[];
  weekDates: string[];
  isManager: boolean;
  onCellPress: (scheduleId: string, dayKey: string, current: DaySchedule) => void;
  onDelete: (schedule: EmployeeSchedule) => void;
}

export function ScheduleTable({
  schedules,
  weekDates,
  isManager,
  onCellPress,
  onDelete,
}: Props) {
  // ✅ theme once — not per row
  const { theme } = useApp();

  // ✅ useCallback — stable function reference
  const renderRow = useCallback(
    ({ item, index }: { item: EmployeeSchedule; index: number }) => (
      <ScheduleRow
        emp={item}
        idx={index}
        weekDates={weekDates}
        isManager={isManager}
        theme={theme}
        onCellPress={onCellPress}
        onDelete={onDelete}
      />
    ),
    [weekDates, isManager, theme, onCellPress, onDelete]
  );

  if (schedules.length === 0) {
    return (
      <View style={[styles.emptyRow, { backgroundColor: theme.card }]}>
        <MaterialIcons name="people-outline" size={32} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No employees this week
        </Text>
      </View>
    );
  }

  const TableHeader = (
    <View style={[styles.tableHead, { backgroundColor: "#00154f" }]}>
      <Text style={styles.thNo}>NO</Text>
      <Text style={styles.thName}>NAME</Text>
      <Text style={styles.thCat}>POSITION</Text>
      {weekDates.map((date, idx) => (
        <View key={date} style={styles.thDay}>
          <Text style={styles.thDayName}>{DAYS_EN[idx]}</Text>
          <Text style={styles.thDayDate}>{formatDisplay(date)}</Text>
        </View>
      ))}
      <Text style={styles.thTotal}>TOT(h)</Text>
      <Text style={styles.thOT}>OT(h)</Text>
      <Text style={styles.thAbs}>ABS</Text>
      {isManager && <Text style={{ width: W.DEL }}></Text>}
    </View>
  );

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {TableHeader}
          <FlatList
            data={schedules}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            scrollEnabled={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            // ✅ Web ma disappear fix
            removeClippedSubviews={Platform.OS !== "web"}
            ListFooterComponent={<ScheduleLegend />}
          />
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:    { flex: 1 },
  emptyRow:  { padding: 40, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 13 },
  tableHead: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   8,
    paddingHorizontal: 4,
  },
  thNo:      { width: W.NO,   color: "#FFD700", fontSize: 9, fontWeight: "800", paddingHorizontal: 2 },
  thName:    { width: W.NAME, color: "#FFD700", fontSize: 9, fontWeight: "800", paddingHorizontal: 2 },
  thCat:     { width: W.CAT,  color: "#FFD700", fontSize: 9, fontWeight: "800", paddingHorizontal: 2 },
  thDay:     { width: W.DAY,  alignItems: "center" },
  thDayName: { color: "#FFD700", fontSize: 9, fontWeight: "800" },
  thDayDate: { color: "rgba(255,215,0,0.7)", fontSize: 8 },
  thTotal:   { width: W.TOT, color: "#FFD700", fontSize: 9, fontWeight: "800", textAlign: "center" },
  thOT:      { width: W.OT,  color: "#FFD700", fontSize: 9, fontWeight: "800", textAlign: "center" },
  thAbs:     { width: W.ABS, color: "#FFD700", fontSize: 9, fontWeight: "800", textAlign: "center" },
  empRow: {
    flexDirection:     "row",
    alignItems:        "center",
    borderBottomWidth: 0.5,
    paddingVertical:   4,
    paddingHorizontal: 4,
  },
  tdNo:   { width: W.NO,   fontSize: 11, paddingHorizontal: 2 },
  tdName: { width: W.NAME, fontSize: 12, fontWeight: "700", paddingHorizontal: 2 },
  tdCat:  { width: W.CAT,  fontSize: 10, paddingHorizontal: 2 },
  tdDay: {
    width:          W.DAY,
    height:         38,
    alignItems:     "center",
    justifyContent: "center",
    borderRadius:   4,
    margin:         1,
  },
  tdTime:   { fontSize: 9,  fontWeight: "600", textAlign: "center" },
  tdStatus: { fontSize: 9,  fontWeight: "800" },
  tdTotal:  { width: W.TOT, fontSize: 11, fontWeight: "700", textAlign: "center" },
  tdOT:     { width: W.OT,  fontSize: 11, textAlign: "center" },
  tdAbs:    { width: W.ABS, fontSize: 11, textAlign: "center" },
  tdDel:    { width: W.DEL, alignItems: "center" },
});