// ============================================
// SERVORA ERP — AttendanceCalendar Component
// ✅ Monthly calendar view
// ✅ Attendance status per day — priority system
// ✅ Date selection
// ✅ useWindowDimensions — rotate/resize safe
// ✅ Unused bgColor removed
// ✅ Pure presentation — no Firestore
// ✅ theme prop — no AppContext dependency
// ✅ Timezone safe date handling
// FROZEN
// ============================================

import React, { useMemo, useCallback } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView, useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AttendanceRecord, AttendanceStatus } from "../types/attendance-types";
import {
  ATTENDANCE_STATUS_COLORS,
} from "../constants/attendance-status-colors";

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
}

// ── Date helpers ──────────────────────────────
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayISO(): string {
  const d  = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000)
    .toISOString().split("T")[0];
}

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ✅ Outside component — stable reference
const STATUS_PRIORITY: Record<AttendanceStatus, number> = {
  ABSENT:   6,
  LATE:     5,
  SICK:     4,
  VACATION: 3,
  HOLIDAY:  2,
  OFF:      1,
  PRESENT:  0,
};

interface Props {
  year:         number;
  month:        number;   // 0-based
  selectedDate: string;   // ISO
  records:      AttendanceRecord[];
  theme:        Theme;
  onSelectDate: (date: string) => void;
  onPrevMonth:  () => void;
  onNextMonth:  () => void;
}

export function AttendanceCalendar({
  year,
  month,
  selectedDate,
  records,
  theme,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: Props) {

  const today = todayISO();

  // ✅ Fix — useWindowDimensions — rotate/resize safe
  const { width } = useWindowDimensions();
  const cellSize  = useMemo(() => {
    // 12 padding each side + 12 margin each side = 48 total
    return Math.floor((width - 48) / 7);
  }, [width]);

  // ── Build date → status map ───────────────
  const dateStatusMap = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    records.forEach((r) => {
      const existing = map[r.date];
      if (!existing) {
        map[r.date] = r.status;
      } else {
        if (STATUS_PRIORITY[r.status] > STATUS_PRIORITY[existing]) {
          map[r.date] = r.status;
        }
      }
    });
    return map;
  }, [records]);

  // ── Build calendar grid ───────────────────
  const { days, startOffset } = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const startOffset = getFirstDayOfMonth(year, month);
    const days: number[] = [];
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return { days, startOffset };
  }, [year, month]);

  const handleDayPress = useCallback((day: number) => {
    onSelectDate(toISO(year, month, day));
  }, [year, month, onSelectDate]);

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface }]}>

      {/* ── Month Header ── */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.arrow}>
          <MaterialIcons name="chevron-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: theme.text }]}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.arrow}>
          <MaterialIcons name="chevron-right" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* ── Day Names ── */}
      <View style={styles.dayNamesRow}>
        {DAY_NAMES.map((d) => (
          <Text
            key={d}
            style={[
              styles.dayName,
              { color: theme.textSecondary, width: cellSize },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* ── Calendar Grid ── */}
      <View style={styles.grid}>

        {/* ── Empty offset cells ── */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <View
            key={`empty-${i}`}
            style={{ width: cellSize, height: cellSize }}
          />
        ))}

        {/* ── Day cells ── */}
        {days.map((day) => {
          const iso        = toISO(year, month, day);
          const status     = dateStatusMap[iso];
          const isToday    = iso === today;
          const isSelected = iso === selectedDate;
          const dotColor   = status
            ? ATTENDANCE_STATUS_COLORS[status]
            : undefined;

          return (
            <TouchableOpacity
              key={day}
              onPress={() => handleDayPress(day)}
              style={[
                {
                  width:          cellSize,
                  height:         cellSize,
                  alignItems:     "center",
                  justifyContent: "center",
                  position:       "relative",
                },
                isSelected && {
                  backgroundColor: theme.primary,
                  borderRadius:    cellSize / 2,
                },
              ]}
            >
              {/* ── Today indicator ── */}
              {isToday && !isSelected && (
                <View style={[
                  styles.todayDot,
                  { backgroundColor: theme.primary },
                ]} />
              )}

              <Text style={[
                styles.dayText,
                { color: isSelected ? "#fff" : theme.text },
                isToday && !isSelected && {
                  color:      theme.primary,
                  fontWeight: "800",
                },
              ]}>
                {day}
              </Text>

              {/* ── Status dot ── */}
              {dotColor && (
                <View style={[
                  styles.statusDot,
                  {
                    backgroundColor: isSelected ? "#ffffff80" : dotColor,
                  },
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Legend ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.legendRow}
      >
        {(Object.keys(ATTENDANCE_STATUS_COLORS) as AttendanceStatus[]).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[
              styles.legendDot,
              { backgroundColor: ATTENDANCE_STATUS_COLORS[s] },
            ]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              {s === "OFF"  ? "Day Off" :
               s === "SICK" ? "Sick"    :
               s.charAt(0) + s.slice(1).toLowerCase()}
            </Text>
          </View>
        ))}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    padding:      12,
    margin:       12,
  },
  monthHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   12,
  },
  arrow: {
    padding: 4,
  },
  monthTitle: {
    fontSize:   16,
    fontWeight: "800",
  },
  dayNamesRow: {
    flexDirection:  "row",
    justifyContent: "space-around",
    marginBottom:   8,
  },
  dayName: {
    textAlign:  "center",
    fontSize:   11,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap:      "wrap",
  },
  dayText: {
    fontSize:   13,
    fontWeight: "600",
  },
  todayDot: {
    position:     "absolute",
    top:          4,
    right:        4,
    width:        5,
    height:       5,
    borderRadius: 3,
  },
  statusDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
    marginTop:    2,
  },
  legendRow: {
    gap:        12,
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
  },
});