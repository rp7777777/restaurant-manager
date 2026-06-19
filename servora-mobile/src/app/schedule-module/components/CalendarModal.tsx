// ============================================
// SERVORA ERP — CalendarModal Component
// ✅ parseDate() — timezone safe
// ✅ Month title — day 1 added
// ✅ Auto close on week select
// ✅ Today indicator
// ============================================

import React from "react";
import {
  View, Text, Modal, TouchableOpacity,
  ScrollView, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import {
  getMonthWeeks, getWeekDates,
  isToday, parseDate,
} from "../utils/date-utils";
import { DAYS_EN } from "../constants/schedule-config";

interface Props {
  visible: boolean;
  calendarMonth: number;
  calendarYear: number;
  selectedWeek: string;
  onClose: () => void;
  onSelectWeek: (weekStart: string) => void;
  onMonthChange: (month: number, year: number) => void;
}

export function CalendarModal({
  visible,
  calendarMonth,
  calendarYear,
  selectedWeek,
  onClose,
  onSelectWeek,
  onMonthChange,
}: Props) {
  const { theme } = useApp();

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      onMonthChange(11, calendarYear - 1);
    } else {
      onMonthChange(calendarMonth - 1, calendarYear);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      onMonthChange(0, calendarYear + 1);
    } else {
      onMonthChange(calendarMonth + 1, calendarYear);
    }
  };

  const weeks = getMonthWeeks(calendarYear, calendarMonth);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.modal, { backgroundColor: theme.surface }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
              <MaterialIcons name="chevron-left" size={22} color={theme.primary} />
            </TouchableOpacity>

            {/* ✅ day 1 added — locale consistent */}
            <Text style={[styles.monthTitle, { color: theme.text }]}>
              {new Date(calendarYear, calendarMonth, 1).toLocaleString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <MaterialIcons name="chevron-right" size={22} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Tap a week to select
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {weeks.map((monday) => {
              const dates      = getWeekDates(monday);
              const isSelected = monday === selectedWeek;
              const hasToday   = dates.some((d) => isToday(d));

              return (
                <TouchableOpacity
                  key={monday}
                  style={[
                    styles.weekRow,
                    { borderColor: theme.border },
                    isSelected && {
                      backgroundColor: theme.primary + "22",
                      borderColor: theme.primary,
                    },
                    hasToday && !isSelected && {
                      borderColor: theme.primary + "66",
                    },
                  ]}
                  // ✅ Auto close on select
                  onPress={() => {
                    onSelectWeek(monday);
                    onClose();
                  }}
                >
                  {dates.map((date, idx) => {
                    const todayDate = isToday(date);
                    return (
                      <View key={date} style={styles.dayCell}>
                        <Text style={[
                          styles.dayName,
                          { color: theme.textSecondary },
                        ]}>
                          {DAYS_EN[idx]}
                        </Text>
                        <View style={[
                          styles.dayNumWrap,
                          todayDate && { backgroundColor: theme.primary },
                        ]}>
                          {/* ✅ parseDate() — timezone safe */}
                          <Text style={[
                            styles.dayNum,
                            {
                              color: isSelected ? theme.primary : theme.text,
                              fontWeight: isSelected ? "800" : "500",
                            },
                            todayDate && { color: "#fff", fontWeight: "800" },
                          ]}>
                            {parseDate(date).getDate()}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 18,
    padding: 16,
    maxHeight: "80%",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navBtn:     { padding: 4 },
  monthTitle: { fontSize: 15, fontWeight: "800" },
  hint:       { fontSize: 11, marginBottom: 8, textAlign: "center" },
  weekRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
    overflow: "hidden",
  },
  dayCell:    { flex: 1, alignItems: "center", paddingVertical: 8 },
  dayName:    { fontSize: 9, fontWeight: "700" },
  dayNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  dayNum: { fontSize: 13 },
});