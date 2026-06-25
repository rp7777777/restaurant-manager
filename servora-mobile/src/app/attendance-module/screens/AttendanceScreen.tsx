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
// FROZEN
// ============================================

import React, { useState, useCallback, useMemo } from "react";
import {
  View, StyleSheet, FlatList,
  ActivityIndicator, Text, Platform, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../../../context/AppContext";
import { useAttendance, filterAttendance } from "../hooks/useAttendance";
import { useAttendanceStats } from "../hooks/useAttendanceStats";
import {
  AttendanceRecord,
  AttendanceFilter,
} from "../types/attendance-types";
import {
  clockIn as serviceClockIn,
  clockOut as serviceClockOut,
  deleteAttendance,
} from "../services/attendance-service";
import { AttendanceStatsBar } from "../components/AttendanceStatsBar";
import { AttendanceSearch }   from "../components/AttendanceSearch";
import { AttendanceCard }     from "../components/AttendanceCard";

// ── Today ISO — timezone safe ─────────────────
function todayISO(): string {
  const d  = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000)
    .toISOString().split("T")[0];
}

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

  // ✅ selectedDate = single source of truth
  const [selectedDate, setSelectedDate] = useState(todayISO());

  // ✅ filter = search + status only
  const [filter, setFilter] = useState<Omit<AttendanceFilter, "date">>({
    search: "",
    status: "ALL",
  });

  const [clockingInId,  setClockingInId]  = useState<string | null>(null);
  const [clockingOutId, setClockingOutId] = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  // ✅ role based only — no permissions field
  const canManageAttendance =
    ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  // ── Data ──────────────────────────────────
  const { records, loading } = useAttendance(restaurantId, selectedDate);
  const stats                = useAttendanceStats(records);

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

  // ── Clock Out ─────────────────────────────
  const handleClockOut = useCallback(async (record: AttendanceRecord) => {
    if (!restaurantId || clockingOutId) return;
    const breakMinutes     = settings?.defaultBreakMinutes ?? 0;
    const normalDailyHours = settings?.normalDailyHours    ?? 8;
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
        onDelete={canManageAttendance ? handleDelete : undefined}
      />
    ),
    [
      theme, canManageAttendance,
      clockingInId, clockingOutId, deletingId,
      handleClockIn, handleClockOut, handleDelete,
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
        <Text style={styles.headerTitle}>ATTENDANCE</Text>
        <Text style={styles.headerSub}>Daily Attendance Tracker</Text>
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