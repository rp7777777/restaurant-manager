// ============================================
// SERVORA ERP — RequestHistoryScreen
// ✅ Day-scoped Request History — moved from the old
//    kitchen-module/index.tsx's inline "Request History" section.
// ✅ Composes useRequestHistory() (day nav + filtered list) and
//    RequestCard (one card per request) — no business logic here,
//    pure composition + the day-nav header/empty-state JSX.
// ============================================

import React from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequestHistory } from "../hooks/useRequestHistory";
import { formatSelectedDate } from "../utils/kitchen-format";
import { IngredientRequest } from "../types/kitchen-types";
import RequestCard from "../components/RequestCard";

interface Theme {
  card:          string;
  text:          string;
  textSecondary: string;
  primary:       string;
}

interface RequestHistoryScreenProps {
  requests: IngredientRequest[];
  loading:  boolean;
  theme:    Theme;
}

export default function RequestHistoryScreen({ requests, loading, theme }: RequestHistoryScreenProps) {
  const { selectedDate, historyRequests, goToPrevDay, goToNextDay, isToday } = useRequestHistory(requests);

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Request History</Text>

      <View style={[styles.dateNav, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.dateNavArrow}>
          <MaterialIcons name="chevron-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.dateNavLabel, { color: theme.text }]}>
          {isToday ? "Today — " : ""}{formatSelectedDate(selectedDate)}
        </Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.dateNavArrow}>
          <MaterialIcons name="chevron-right" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
      ) : historyRequests.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
          <MaterialIcons name="add-shopping-cart" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No requests for {formatSelectedDate(selectedDate)}
          </Text>
        </View>
      ) : (
        historyRequests.map((req) => (
          <RequestCard key={req.id} request={req} theme={theme} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 10, paddingVertical: 8, marginBottom: 12,
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 13, fontWeight: "700" },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
});