// ============================================
// SERVORA ERP — CellEditorModal Component
// ✅ Apply whole week — ALL statuses
// ✅ Break threshold — 6h+ only
// ✅ Company policy message
// ✅ Quick templates
// ============================================

import React from "react";
import {
  View, Text, Modal, TouchableOpacity,
  TextInput, StyleSheet, Platform,
  ScrollView, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { DayStatus, DaySchedule } from "../types/schedule-types";
import { STATUS_OPTIONS } from "../constants/statuses";
import { calcHours } from "../utils/hours-utils";
import { parseDate } from "../utils/date-utils";

interface Props {
  visible: boolean;
  editingCell: {
    scheduleId: string;
    dayKey: string;
    current: DaySchedule;
  } | null;
  cellStatus: DayStatus;
  cellStart: string;
  cellEnd: string;
  applyWholeWeek: boolean;
  onStatusChange: (status: DayStatus) => void;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
  onApplyWholeWeekChange: (val: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

const TEMPLATES = [
  { label: "Morning", start: "09:00", end: "17:00" },
  { label: "Evening", start: "14:00", end: "22:00" },
  { label: "Night",   start: "22:00", end: "06:00" },
  { label: "Split",   start: "10:00", end: "15:00" },
];

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatTimeInput(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2);
}

export function CellEditorModal({
  visible,
  editingCell,
  cellStatus,
  cellStart,
  cellEnd,
  applyWholeWeek,
  onStatusChange,
  onStartChange,
  onEndChange,
  onApplyWholeWeekChange,
  onSave,
  onClose,
}: Props) {
  const {
    theme,
    autoDeductBreak,
    defaultBreakMinutes,
    autoDeductBreakAfterHours,
  } = useApp();

  const dateLabel = editingCell
    ? parseDate(editingCell.dayKey).toLocaleDateString("en-GB", {
        weekday: "long",
        day:     "numeric",
        month:   "short",
      })
    : "";

  const totalHours = TIME_REGEX.test(cellStart) && TIME_REGEX.test(cellEnd)
    ? calcHours(cellStart, cellEnd)
    : 0;

  const breakHours =
    autoDeductBreak && totalHours >= autoDeductBreakAfterHours
      ? defaultBreakMinutes / 60
      : 0;

  const netHours     = Math.max(0, totalHours - breakHours);
  const breakApplied = breakHours > 0;

  const handleSave = () => {
    if (cellStatus === "WORK") {
      if (!TIME_REGEX.test(cellStart)) {
        Alert.alert("Invalid Time", "Start time must be HH:MM (e.g. 09:00)");
        return;
      }
      if (!TIME_REGEX.test(cellEnd)) {
        Alert.alert("Invalid Time", "End time must be HH:MM (e.g. 17:00)");
        return;
      }
    }
    onSave();
  };

  const timeInputStyle = {
    borderWidth:     1.5,
    borderRadius:    8,
    padding:         8,
    fontSize:        16,
    fontWeight:      "700" as const,
    textAlign:       "center" as const,
    borderColor:     theme.border,
    color:           theme.text,
    backgroundColor: theme.bg,
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: theme.text }]}>
              {dateLabel}
            </Text>

            {/* Status buttons */}
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.statusBtn,
                    { borderColor: item.color },
                    cellStatus === item.value && { backgroundColor: item.color },
                  ]}
                  onPress={() => onStatusChange(item.value as DayStatus)}
                >
                  <Text style={[
                    styles.statusBtnText,
                    { color: cellStatus === item.value ? "#fff" : item.color },
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ✅ WORK only — time inputs */}
            {cellStatus === "WORK" && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  QUICK TEMPLATES
                </Text>
                <View style={styles.templateRow}>
                  {TEMPLATES.map((t) => (
                    <TouchableOpacity
                      key={t.label}
                      style={[styles.templateBtn, {
                        borderColor:     theme.border,
                        backgroundColor: theme.bg,
                      }]}
                      onPress={() => {
                        onStartChange(t.start);
                        onEndChange(t.end);
                      }}
                    >
                      <Text style={[styles.templateLabel, { color: theme.text }]}>
                        {t.label}
                      </Text>
                      <Text style={[styles.templateTime, { color: theme.textSecondary }]}>
                        {t.start}-{t.end}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  SHIFT TIME
                </Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
                      START
                    </Text>
                    {Platform.OS === "web" ? (
                      <input
                        type="text"
                        value={cellStart}
                        placeholder="09:00"
                        maxLength={5}
                        onChange={(e) => onStartChange(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                        style={{
                          border:          `1.5px solid ${theme.border}`,
                          borderRadius:    8,
                          padding:         "8px",
                          fontSize:        16,
                          fontWeight:      "700",
                          textAlign:       "center",
                          backgroundColor: theme.bg,
                          color:           theme.text,
                          width:           "100%",
                          outline:         "none",
                          boxSizing:       "border-box" as any,
                        }}
                      />
                    ) : (
                      <TextInput
                        style={timeInputStyle}
                        value={cellStart}
                        onChangeText={(v) => onStartChange(formatTimeInput(v))}
                        placeholder="09:00"
                        placeholderTextColor={theme.textSecondary}
                        maxLength={5}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    )}
                  </View>

                  <Text style={[styles.timeSep, { color: theme.textSecondary }]}>→</Text>

                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
                      END
                    </Text>
                    {Platform.OS === "web" ? (
                      <input
                        type="text"
                        value={cellEnd}
                        placeholder="17:00"
                        maxLength={5}
                        onChange={(e) => onEndChange(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                        style={{
                          border:          `1.5px solid ${theme.border}`,
                          borderRadius:    8,
                          padding:         "8px",
                          fontSize:        16,
                          fontWeight:      "700",
                          textAlign:       "center",
                          backgroundColor: theme.bg,
                          color:           theme.text,
                          width:           "100%",
                          outline:         "none",
                          boxSizing:       "border-box" as any,
                        }}
                      />
                    ) : (
                      <TextInput
                        style={timeInputStyle}
                        value={cellEnd}
                        onChangeText={(v) => onEndChange(formatTimeInput(v))}
                        placeholder="17:00"
                        placeholderTextColor={theme.textSecondary}
                        maxLength={5}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    )}
                  </View>

                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
                      NET HRS
                    </Text>
                    <View style={[styles.hoursBox, {
                      backgroundColor: "#3b82f615",
                      borderColor:     totalHours > 0 ? "#3b82f6" : theme.border,
                    }]}>
                      <Text style={[styles.hoursText, {
                        color: totalHours > 0 ? "#3b82f6" : theme.textSecondary,
                      }]}>
                        {netHours.toFixed(1)}h
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Break summary */}
                {autoDeductBreak && totalHours > 0 && (
                  <View style={[styles.summaryBox, {
                    backgroundColor: breakApplied ? "#f59e0b10" : "#94a3b810",
                    borderColor:     breakApplied ? "#f59e0b30" : "#94a3b830",
                  }]}>
                    <MaterialIcons
                      name={breakApplied ? "coffee" : "check-circle"}
                      size={14}
                      color={breakApplied ? "#f59e0b" : "#94a3b8"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                        {breakApplied
                          ? `${totalHours.toFixed(1)}h - ${defaultBreakMinutes}min break = `
                          : `${totalHours.toFixed(1)}h (no break — under ${autoDeductBreakAfterHours}h) = `
                        }
                        <Text style={{ color: "#3b82f6", fontWeight: "800" }}>
                          {netHours.toFixed(1)}h paid
                        </Text>
                      </Text>
                      <Text style={[styles.policyText, { color: theme.textSecondary }]}>
                        Company break policy applied
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ✅ Apply whole week — ALL statuses! */}
            <TouchableOpacity
              style={[styles.wholeWeekRow, {
                backgroundColor: applyWholeWeek ? "#3b82f615" : theme.bg,
                borderColor:     applyWholeWeek ? "#3b82f6"   : theme.border,
              }]}
              onPress={() => onApplyWholeWeekChange(!applyWholeWeek)}
            >
              <MaterialIcons
                name={applyWholeWeek ? "check-box" : "check-box-outline-blank"}
                size={20}
                color={applyWholeWeek ? "#3b82f6" : theme.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.wholeWeekLabel, { color: theme.text }]}>
                  Apply same to whole week
                </Text>
                <Text style={[styles.wholeWeekSub, { color: theme.textSecondary }]}>
                  {cellStatus === "WORK"
                    ? `Mon–Sun: ${cellStart} → ${cellEnd}`
                    : `Mon–Sun: all set to ${cellStatus}`
                  }
                </Text>
              </View>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.primary }]}
                onPress={handleSave}
              >
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.border }]}
                onPress={onClose}
              >
                <Text style={[styles.btnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent:  "center",
    alignItems:      "center",
    padding:         16,
  },
  modal: {
    width:        "100%",
    maxWidth:     420,
    borderRadius: 18,
    padding:      18,
    maxHeight:    "92%",
  },
  title:         { fontSize: 15, fontWeight: "800", marginBottom: 14 },
  statusGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  statusBtn:     { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5 },
  statusBtnText: { fontSize: 11, fontWeight: "700" },
  sectionLabel:  { fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  templateRow:   { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  templateBtn: {
    paddingHorizontal: 10,
    paddingVertical:    6,
    borderRadius:      8,
    borderWidth:       1,
    alignItems:        "center",
  },
  templateLabel: { fontSize: 11, fontWeight: "700" },
  templateTime:  { fontSize: 9,  marginTop: 2 },
  timeRow:       { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  timeField:     { flex: 1 },
  timeLabel:     { fontSize: 9, fontWeight: "700", marginBottom: 4 },
  timeSep:       { fontSize: 18, fontWeight: "800", paddingBottom: 10 },
  hoursBox: {
    borderWidth:    1.5,
    borderRadius:   8,
    padding:        8,
    alignItems:     "center",
    justifyContent: "center",
    height:         42,
  },
  hoursText: { fontWeight: "800", fontSize: 14 },
  summaryBox: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            6,
    padding:        10,
    borderRadius:   8,
    borderWidth:    1,
    marginBottom:   10,
  },
  summaryText: { fontSize: 12 },
  policyText:  { fontSize: 10, marginTop: 2, fontStyle: "italic" },
  wholeWeekRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            10,
    padding:        12,
    borderRadius:   10,
    borderWidth:    1.5,
    marginBottom:   14,
    marginTop:      8,
  },
  wholeWeekLabel: { fontSize: 13, fontWeight: "700" },
  wholeWeekSub:   { fontSize: 11, marginTop: 2 },
  btnRow:         { flexDirection: "row", gap: 10 },
  btn:            { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" },
  btnText:        { color: "#fff", fontSize: 14, fontWeight: "700" },
});