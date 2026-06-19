// ============================================
// SERVORA ERP — HolidayModal Component
// ✅ useEffect — modal reopen reset
// ✅ Double-click protection
// ✅ Confirmation dialog
// ✅ Select/Unselect toggle
// ============================================

import React, { useState, useEffect } from "react";
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  ScrollView, Alert, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { parseDate, formatFull, isToday } from "../utils/date-utils";

interface Props {
  visible: boolean;
  weekDates: string[];
  applying: boolean;
  onApply: (date: string) => void;
  onClose: () => void;
}

export function HolidayModal({
  visible,
  weekDates,
  applying,
  onApply,
  onClose,
}: Props) {
  const { theme } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  // ✅ Reset on close
  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  // ✅ Select/Unselect toggle
  const handleDayPress = (date: string) => {
    setSelected((prev) => prev === date ? null : date);
  };

  // ✅ Double-click protection + confirmation
  const handleApply = () => {
    if (!selected || applying) return;

    const d = parseDate(selected);
    const dateLabel = formatFull(selected);
    const msg = `Apply Public Holiday on ${dateLabel}?\n\nThis will update ALL employees for this day.`;

    if (Platform.OS === "web") {
      if (window.confirm(msg)) onApply(selected);
    } else {
      Alert.alert("Apply Public Holiday?", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Apply",  style: "destructive", onPress: () => onApply(selected) },
      ]);
    }
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} onPress={handleClose}>
        <View
          style={[styles.modal, { backgroundColor: theme.surface }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color: theme.text }]}>
            🎉 Set Public Holiday
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select a day — all employees will be set to Public Holiday
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {weekDates.map((date) => {
              const d          = parseDate(date);
              const isSelected = selected === date;
              const todayDate  = isToday(date);

              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.dayRow,
                    { borderColor: theme.border },
                    isSelected && {
                      backgroundColor: "#8b5cf620",
                      borderColor:     "#8b5cf6",
                    },
                  ]}
                  // ✅ Toggle select/unselect
                  onPress={() => handleDayPress(date)}
                >
                  <View style={[
                    styles.dayCircle,
                    { backgroundColor: isSelected ? "#8b5cf6" : theme.bg },
                    todayDate && !isSelected && {
                      borderColor: "#8b5cf6",
                      borderWidth: 2,
                    },
                  ]}>
                    <Text style={[
                      styles.dayNum,
                      { color: isSelected ? "#fff" : theme.text },
                    ]}>
                      {d.getDate()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.dayName,
                      { color: isSelected ? "#8b5cf6" : theme.text },
                    ]}>
                      {d.toLocaleDateString("en-GB", { weekday: "long" })}
                    </Text>
                    <Text style={[styles.dayDate, { color: theme.textSecondary }]}>
                      {formatFull(date)}
                      {todayDate ? " • Today" : ""}
                    </Text>
                  </View>

                  {isSelected
                    ? <MaterialIcons name="check-circle" size={22} color="#8b5cf6" />
                    : <MaterialIcons name="radio-button-unchecked" size={22} color={theme.border} />
                  }
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.applyBtn,
                (!selected || applying) && { opacity: 0.5 },
              ]}
              onPress={handleApply}
              disabled={!selected || applying}
            >
              {applying
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialIcons name="celebration" size={16} color="#fff" />
              }
              <Text style={styles.applyBtnText}>
                {applying ? "Applying..." : "Apply to All"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.border }]}
              onPress={handleClose}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: 380,
    borderRadius: 18,
    padding: 18,
    maxHeight: "80%",
  },
  title:    { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 8 },
  divider:  { height: 1, marginVertical: 10 },
  dayRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            12,
    padding:        12,
    borderRadius:   10,
    borderWidth:    1,
    marginBottom:   8,
  },
  dayCircle: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  dayNum:   { fontSize: 15, fontWeight: "800" },
  dayName:  { fontSize: 13, fontWeight: "700" },
  dayDate:  { fontSize: 11, marginTop: 2 },
  btnRow:   { flexDirection: "row", gap: 10, marginTop: 4 },
  applyBtn: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             6,
    backgroundColor: "#8b5cf6",
    padding:         12,
    borderRadius:    10,
  },
  applyBtnText:  { color: "#fff", fontSize: 13, fontWeight: "800" },
  cancelBtn: {
    flex:         1,
    alignItems:   "center",
    padding:      12,
    borderRadius: 10,
    borderWidth:  1.5,
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
});