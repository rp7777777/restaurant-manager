// ============================================
// SERVORA ERP — PendingActionModal Component
// ✅ NEW — small Approve/Reject/Cancel modal shown when a PENDING
//    request's row is tapped. Cross-platform: Alert.alert() alone
//    is unreliable on react-native-web (a known, already-established
//    fact in this codebase — see the old handleReject's own
//    Platform.OS === "web" fallback), so this uses a real custom
//    Modal instead of native Alert, giving identical behavior on
//    both native and web without relying on the platform's own
//    dialog implementation.
// ✅ NO business logic — no Firestore calls, no service imports.
//    Purely captures the Approve/Reject/Cancel tap and calls the
//    corresponding prop callback; the parent (index.tsx) is
//    responsible for actually calling approveKitchenRequest()/
//    rejectKitchenRequest().
// ✅ processing is a prop (parent-owned) — disables all three
//    buttons while an approve/reject call is in flight, preventing
//    double-taps.
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";

interface PendingActionModalProps {
  visible:    boolean;
  request:    IngredientRequest | null;
  processing: boolean;
  theme:      { surface: string; text: string; textSecondary: string; border: string };
  onApprove:  () => void;
  onReject:   () => void;
  onCancel:   () => void;
}

export function PendingActionModal({
  visible, request, processing, theme, onApprove, onReject, onCancel,
}: PendingActionModalProps) {
  if (!request) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.textSecondary }]}>Pending Request</Text>
          <Text style={[styles.itemName, { color: theme.text }]}>{request.itemName}</Text>
          <Text style={[styles.subText, { color: theme.textSecondary }]}>
            Requested: {request.orderQuantity} {request.unit} · By {request.requestedBy}
          </Text>
          {request.note ? (
            <Text style={[styles.noteText, { color: theme.textSecondary }]}>Note: {request.note}</Text>
          ) : null}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}
              onPress={onApprove}
              disabled={processing}
            >
              {processing ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <MaterialIcons name="check" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
              onPress={onReject}
              disabled={processing}
            >
              <MaterialIcons name="close" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={onCancel} disabled={processing}>
            <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 20 },
  title: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  itemName: { fontSize: 17, fontWeight: "800", marginTop: 4 },
  subText: { fontSize: 12, marginTop: 4 },
  noteText: { fontSize: 12, marginTop: 8, fontStyle: "italic" },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cancelBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
});