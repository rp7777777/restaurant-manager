// ============================================
// SERVORA ERP — YearPickerModal
// ✅ Modal year picker
// ✅ Theme compatible
// ✅ React.memo
// ✅ TypeScript typed props
// ✅ TouchableWithoutFeedback — card touch safe
// ✅ accessibilityViewIsModal — screen reader
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, Modal, TouchableOpacity,
  ScrollView, StyleSheet, TouchableWithoutFeedback,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../context/AppContext";
import { getYearRange } from "../../constants/dashboard";

// ── Props ─────────────────────────────────────
interface YearPickerModalProps {
  visible:      boolean;
  selectedYear: number;
  onSelect:     (year: number) => void;
  onClose:      () => void;
}

// ── Component ─────────────────────────────────
function YearPickerModal({
  visible,
  selectedYear,
  onSelect,
  onClose,
}: YearPickerModalProps) {
  const { theme } = useApp();
  const years     = getYearRange();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // ✅ accessibilityViewIsModal — screen reader
      accessibilityViewIsModal
    >
      {/* ✅ Outer tap — close modal */}
      <TouchableWithoutFeedback
        onPress={onClose}
        accessible
        accessibilityLabel="Close year picker"
      >
        <View style={styles.overlay}>
          {/* ✅ Inner tap — stop propagation */}
          <TouchableWithoutFeedback>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.title, { color: theme.text }]}>
                Select Year
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
              >
                {years.map((year) => {
                  const isSelected = year === selectedYear;
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.item,
                        { borderBottomColor: theme.border },
                        isSelected && { backgroundColor: theme.primary + "22" },
                      ]}
                      onPress={() => {
                        onSelect(year);
                        onClose();
                      }}
                      accessibilityLabel={`Select year ${year}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[
                        styles.itemText,
                        {
                          color:      isSelected ? theme.primary : theme.text,
                          fontWeight: isSelected ? "800" : "500",
                        },
                      ]}>
                        {year}
                      </Text>
                      {isSelected && (
                        <MaterialIcons
                          name="check"
                          size={16}
                          color={theme.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent:  "center",
    alignItems:      "center",
    padding:         40,
  },
  card: {
    width:        "100%",
    maxWidth:     280,
    borderRadius: 16,
    overflow:     "hidden",
    maxHeight:    400,
  },
  title: {
    fontSize:      15,
    fontWeight:    "800",
    padding:       16,
    paddingBottom:  8,
  },
  scroll: {
    flexGrow: 0,
  },
  item: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth:  1,
  },
  itemText: {
    fontSize: 14,
  },
});

// ✅ React.memo
export default memo(YearPickerModal);