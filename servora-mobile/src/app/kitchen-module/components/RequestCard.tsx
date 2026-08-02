// ============================================
// SERVORA ERP — RequestCard Component
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { IngredientRequest } from "../types/kitchen-types";
import RequestStatusBadge from "./RequestStatusBadge";

interface Theme {
  card:          string;
  text:          string;
  textSecondary: string;
}

interface RequestCardProps {
  request: IngredientRequest;
  theme:   Theme;
}

export default function RequestCard({ request, theme }: RequestCardProps) {
  return (
    <View style={[styles.requestCard, { backgroundColor: theme.card }]}>
      <View style={styles.requestCardHeader}>
        <View style={styles.requestCardLeft}>
          <Text style={[styles.requestItemName, { color: theme.text }]}>{request.itemName}</Text>
          <Text style={[styles.requestDate, { color: theme.textSecondary }]}>
            Required: {request.requiredDate} · By: {request.requestedBy}
          </Text>
        </View>
        <RequestStatusBadge status={request.status} />
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.requestDetailItem}>
          <Text style={[styles.requestDetailLabel, { color: theme.textSecondary }]}>Closing Stock</Text>
          <Text style={[styles.requestDetailValue, { color: theme.text }]}>{request.closingStock} {request.unit}</Text>
        </View>
        <View style={styles.requestDetailItem}>
          <Text style={[styles.requestDetailLabel, { color: theme.textSecondary }]}>Min Level</Text>
          <Text style={[styles.requestDetailValue, { color: theme.text }]}>{request.minimumLevel} {request.unit}</Text>
        </View>
        <View style={styles.requestDetailItem}>
          <Text style={[styles.requestDetailLabel, { color: theme.textSecondary }]}>Order Qty</Text>
          <Text style={[styles.requestDetailValue, { color: "#10b981", fontWeight: "800" }]}>{request.orderQuantity} {request.unit}</Text>
        </View>
      </View>

      {request.note ? (
        <Text style={[styles.requestNote, { color: theme.textSecondary }]}>
          Note: {request.note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  requestCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  requestCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  requestCardLeft: { flex: 1 },
  requestItemName: { fontSize: 14, fontWeight: "700" },
  requestDate: { fontSize: 11, marginTop: 2 },
  requestDetails: { flexDirection: "row", gap: 8 },
  requestDetailItem: { flex: 1, alignItems: "center" },
  requestDetailLabel: { fontSize: 9, fontWeight: "600", marginBottom: 2 },
  requestDetailValue: { fontSize: 12, fontWeight: "700" },
  requestNote: { fontSize: 11, marginTop: 8, fontStyle: "italic" },
});