// ============================================
// SERVORA ERP — RequestCard Component
// ✅ Pure presentation — displays one kitchen IngredientRequest in
//    the Request History list.
// ✅ Moved verbatim from the old kitchen-module/index.tsx's
//    Request History section JSX — same layout, same fields shown.
// ✅ Keeps `theme` as a prop (dynamic theming) rather than switching
//    to the hardcoded-color style some other cards (e.g.
//    PurchaseOrderCard) use — this is a refactor of existing
//    behavior, not a visual redesign, so the original's theming
//    stays intact.
// ✅ Status badge now delegated to RequestStatusBadge — completes
//    the extraction already planned in an earlier review (this card
//    used to compute statusColor/statusIcon inline).
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { IngredientRequest } from "../types/kitchen-types";
import RequestStatusBadge from "./RequestStatusBadge";

// ✅ Local Theme interface with only the fields this component
// uses — matches the established real pattern already used by
// other presentation components (e.g. AttendanceCard.tsx), rather
// than importing the full canonical Theme from constants/theme.ts
// (which would pull in many unused fields) or typing loosely as any.
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