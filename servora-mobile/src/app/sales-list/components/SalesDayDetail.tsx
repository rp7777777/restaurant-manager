// ============================================
// SERVORA ERP — Sales Day Detail Component
// Expanded view for a selected day: shift breakdown + payment summary
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../../context/AppContext";
import { SaleHistoryEntry } from "../types/sales-history-types";
import { formatShortDate } from "../utils/sales-date";
import SalesByShift from "./SalesByShift";
import PaymentSummary from "./PaymentSummary";

interface SalesDayDetailProps {
  date: string;
  sales: SaleHistoryEntry[];
  total: number;
  isManager: boolean;
  onEdit: (sale: SaleHistoryEntry) => void;
  onDelete: (sale: SaleHistoryEntry) => void;
  onLayout?: (y: number) => void;
}

export function SalesDayDetail({
  date,
  sales,
  total,
  isManager,
  onEdit,
  onDelete,
  onLayout,
}: SalesDayDetailProps) {
  const { theme, fmt } = useApp();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface }]}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {formatShortDate(date)}
        </Text>
        <Text style={[styles.total, { color: "#10b981" }]}>
          {fmt(total)}
        </Text>
      </View>

      <SalesByShift
        sales={sales}
        isManager={isManager}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <PaymentSummary sales={sales} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  total: {
    fontSize: 18,
    fontWeight: "900",
  },
});