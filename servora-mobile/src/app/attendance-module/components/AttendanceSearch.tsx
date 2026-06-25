// ============================================
// SERVORA ERP — AttendanceSearch Component
// ✅ Pure presentation component
// ✅ theme prop — no AppContext dependency
// ✅ Debounced search 300ms — full deps
// ✅ Status filter chips
// ✅ Date navigation — disabled when undefined
// ✅ Unused import removed
// ✅ Re-export removed — hooks bata direct import
// FROZEN
// ============================================

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  AttendanceFilter,
  AttendanceStatus,
} from "../types/attendance-types";
import {
  ATTENDANCE_STATUS_COLORS,
} from "../constants/attendance-status-colors";

// ── Filter chips ──────────────────────────────
const STATUS_CHIPS: Array<{ label: string; value: AttendanceStatus | "ALL" }> = [
  { label: "All",      value: "ALL"      },
  { label: "Present",  value: "PRESENT"  },
  { label: "Absent",   value: "ABSENT"   },
  { label: "Late",     value: "LATE"     },
  { label: "Sick",     value: "SICK"     },
  { label: "Vacation", value: "VACATION" },
  { label: "Holiday",  value: "HOLIDAY"  },
  { label: "Day Off",  value: "OFF"      },
];

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
}

interface Props {
  filter:      AttendanceFilter;
  onChange:    (filter: AttendanceFilter) => void;
  theme:       Theme;
  onPrevDay?:  () => void;
  onNextDay?:  () => void;
  dateLabel?:  string;
}

export function AttendanceSearch({
  filter,
  onChange,
  theme,
  onPrevDay,
  onNextDay,
  dateLabel,
}: Props) {
  const [localSearch, setLocalSearch] = useState(filter.search);

  // ✅ Sync localSearch when filter.search resets externally
  useEffect(() => {
    setLocalSearch(filter.search);
  }, [filter.search]);

  // ✅ Debounced search 300ms — full deps
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filter.search) {
        onChange({ ...filter, search: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, filter, onChange]);

  const handleStatus = useCallback(
    (status: AttendanceStatus | "ALL") => {
      onChange({ ...filter, status });
    },
    [filter, onChange]
  );

  const handleClearSearch = useCallback(() => {
    setLocalSearch("");
    onChange({ ...filter, search: "" });
  }, [filter, onChange]);

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface }]}>

      {/* ── Date Navigation ── */}
      {(onPrevDay || onNextDay || dateLabel) && (
        <View style={styles.dateRow}>
          {/* ✅ disabled when undefined */}
          <TouchableOpacity
            onPress={onPrevDay}
            disabled={!onPrevDay}
            style={[
              styles.dateArrow,
              { opacity: onPrevDay ? 1 : 0.3 },
            ]}
          >
            <MaterialIcons
              name="chevron-left"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>

          <Text style={[styles.dateLabel, { color: theme.text }]}>
            {dateLabel ?? filter.date}
          </Text>

          {/* ✅ disabled when undefined */}
          <TouchableOpacity
            onPress={onNextDay}
            disabled={!onNextDay}
            style={[
              styles.dateArrow,
              { opacity: onNextDay ? 1 : 0.3 },
            ]}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Search Input ── */}
      <View style={[styles.searchBox, {
        backgroundColor: theme.bg,
        borderColor:     theme.border,
      }]}>
        <MaterialIcons name="search" size={16} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search name, number..."
          placeholderTextColor={theme.textSecondary}
          value={localSearch}
          onChangeText={setLocalSearch}
        />
        {localSearch.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch}>
            <MaterialIcons name="close" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Status Chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {STATUS_CHIPS.map((chip) => {
          const isActive = filter.status === chip.value;
          const color    = chip.value === "ALL"
            ? theme.primary
            : ATTENDANCE_STATUS_COLORS[chip.value as AttendanceStatus];

          return (
            <TouchableOpacity
              key={chip.value}
              onPress={() => handleStatus(chip.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? color : theme.bg,
                  borderColor:     isActive ? color : theme.border,
                },
              ]}
            >
              <Text style={[
                styles.chipText,
                { color: isActive ? "#fff" : theme.textSecondary },
              ]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical:   10,
    paddingHorizontal: 12,
    gap:               10,
  },
  dateRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            16,
  },
  dateArrow: {
    padding: 4,
  },
  dateLabel: {
    fontSize:   15,
    fontWeight: "700",
    minWidth:   120,
    textAlign:  "center",
  },
  searchBox: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    borderWidth:       1.5,
    borderRadius:      9,
    paddingHorizontal: 10,
    paddingVertical:   8,
  },
  searchInput: {
    flex:     1,
    fontSize: 13,
    padding:  0,
  },
  chipsRow: {
    gap:           6,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1.5,
  },
  chipText: {
    fontSize:   12,
    fontWeight: "600",
  },
});