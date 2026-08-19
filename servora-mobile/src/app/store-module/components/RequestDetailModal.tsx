// ============================================
// SERVORA ERP — RequestDetailModal Component
// ✅ NEW — read-only detail view for ISSUED/REJECTED requests
//    (tapped from KitchenRequestTable's generic onRowPress). Never
//    mutates anything — no Firestore calls, no service imports, no
//    action buttons besides Close.
// ✅ Shows the fields relevant to how the request was resolved:
//    - ISSUED: item, requested/issued qty, requested by, required
//      date, issued by, issued at, both notes (request + issue).
//    - REJECTED: item, requested qty, requested by, required date,
//      rejected by, rejected at, the original request note.
// ✅ formatTimestamp() moved here (was inline in the old index.tsx)
//    since this is the only component that needs to render a
//    Firestore timestamp as a readable date.
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";

interface RequestDetailModalProps {
  visible: boolean;
  request: IngredientRequest | null;
  theme: { surface: string; text: string; textSecondary: string; border: string };
  onClose: () => void;
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return "—";
  try {
    const d = (ts as any).toDate ? (ts as any).toDate() : new Date(ts as any);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function DetailRow({ label, value, textColor, secondaryColor }: { label: string; value: string; textColor: string; secondaryColor: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: secondaryColor }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

export function RequestDetailModal({ visible, request, theme, onClose }: RequestDetailModalProps) {
  if (!request) return null;

  const isIssued = request.status === "ISSUED";
  const isRejected = request.status === "REJECTED";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            {isIssued ? "Issued Request" : "Rejected Request"}
          </Text>
          <Text style={[styles.itemName, { color: theme.text }]}>{request.itemName}</Text>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <DetailRow label="Requested Qty" value={`${request.orderQuantity} ${request.unit}`} textColor={theme.text} secondaryColor={theme.textSecondary} />
          {isIssued && (
            <DetailRow
              label="Issued Qty"
              value={request.issuedQuantity !== undefined ? `${request.issuedQuantity} ${request.unit}` : "—"}
              textColor={theme.text} secondaryColor={theme.textSecondary}
            />
          )}
          <DetailRow label="Requested By" value={request.requestedBy} textColor={theme.text} secondaryColor={theme.textSecondary} />
          <DetailRow label="Required Date" value={request.requiredDate} textColor={theme.text} secondaryColor={theme.textSecondary} />

          {isIssued && (
            <>
              <DetailRow label="Issued By" value={request.issuedBy ?? "—"} textColor={theme.text} secondaryColor={theme.textSecondary} />
              <DetailRow label="Issued On" value={formatTimestamp(request.issuedAt)} textColor={theme.text} secondaryColor={theme.textSecondary} />
            </>
          )}
          {isRejected && (
            <>
              <DetailRow label="Rejected By" value={request.rejectedBy ?? "—"} textColor={theme.text} secondaryColor={theme.textSecondary} />
              <DetailRow label="Rejected On" value={formatTimestamp(request.rejectedAt)} textColor={theme.text} secondaryColor={theme.textSecondary} />
            </>
          )}

          {request.note ? (
            <DetailRow label="Request Note" value={request.note} textColor={theme.text} secondaryColor={theme.textSecondary} />
          ) : null}
          {isIssued && request.issueNote ? (
            <DetailRow label="Issue Note" value={request.issueNote} textColor={theme.text} secondaryColor={theme.textSecondary} />
          ) : null}

          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.border }]} onPress={onClose}>
            <Text style={[styles.closeBtnText, { color: theme.text }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 380, borderRadius: 16, padding: 20 },
  title: { fontSize: 14, fontWeight: "700", opacity: 0.7 },
  itemName: { fontSize: 17, fontWeight: "800", marginTop: 2, marginBottom: 10 },
  divider: { height: 1, marginBottom: 10 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  detailLabel: { fontSize: 12, fontWeight: "600" },
  detailValue: { fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "right", marginLeft: 12 },
  closeBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  closeBtnText: { fontSize: 14, fontWeight: "700" },
});