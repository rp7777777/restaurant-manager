// ============================================
// SERVORA ERP — PendingActionModal Component
// ✅ Small Approve/Reject/Cancel modal shown when a PENDING request's
//    row is tapped. Cross-platform: custom Modal instead of native
//    Alert (Alert.alert() is unreliable on react-native-web).
// ✅ NO business logic — no Firestore calls, no service imports.
//    Purely captures the Approve/Reject/Cancel tap and calls the
//    corresponding prop callback; the parent (index.tsx) is
//    responsible for actually calling approveKitchenRequest()/
//    rejectKitchenRequest().
// ✅ processing is a prop (parent-owned) — disables all buttons
//    while an approve/reject call is in flight.
// ✅ NEW — tapping "Reject" no longer rejects immediately. It
//    switches this modal to a second internal view (rejectReasonMode)
//    offering quick-select reasons (Out of Stock / Quality Issue /
//    Quantity Too High / Wrong Item or Category / Duplicate Request
//    / Other), with a free-text field shown only when "Other" is
//    selected. onReject(reason) is only called once the user taps
//    "Confirm Reject" — going "Back" returns to the
//    Approve/Reject/Cancel view without rejecting anything.
// ✅ Internal view state resets to the initial view whenever the
//    modal closes/reopens for a different request (via visible/
//    request identity), so a previous reject-reason selection never
//    leaks into the next request's modal.
// FROZEN
// ============================================

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";

interface PendingActionModalProps {
  visible:    boolean;
  request:    IngredientRequest | null;
  processing: boolean;
  theme:      { surface: string; text: string; textSecondary: string; border: string };
  onApprove:  () => void;
  onReject:   (reason: string) => void;
  onCancel:   () => void;
}

const QUICK_REASONS = [
  "Out of Stock",
  "Quality Issue",
  "Quantity Too High",
  "Wrong Item / Category",
  "Duplicate Request",
  "Other",
];

export function PendingActionModal({
  visible, request, processing, theme, onApprove, onReject, onCancel,
}: PendingActionModalProps) {
  const [rejectMode, setRejectMode] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");

  // ✅ Reset internal state whenever the modal is closed or a
  // different request is shown, so stale selections never leak.
  useEffect(() => {
    if (!visible) {
      setRejectMode(false);
      setSelectedReason(null);
      setCustomReason("");
    }
  }, [visible, request?.id]);

  if (!request) return null;

  const handleCancelClick = () => {
    if (rejectMode) {
      setRejectMode(false);
      setSelectedReason(null);
      setCustomReason("");
    } else {
      onCancel();
    }
  };

  const handleConfirmReject = () => {
    const finalReason = selectedReason === "Other" ? customReason.trim() : (selectedReason ?? "");
    onReject(finalReason);
  };

  const canConfirmReject = selectedReason !== null && (selectedReason !== "Other" || customReason.trim().length > 0);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          {!rejectMode ? (
            <>
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
                  onPress={() => setRejectMode(true)}
                  disabled={processing}
                >
                  <MaterialIcons name="close" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={onCancel} disabled={processing}>
                <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.textSecondary }]}>Reject Reason</Text>
              <Text style={[styles.itemName, { color: theme.text }]}>{request.itemName}</Text>

              <View style={styles.reasonList}>
                {QUICK_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={styles.reasonRow}
                      onPress={() => setSelectedReason(reason)}
                      disabled={processing}
                    >
                      <View style={[styles.radioOuter, isSelected && { borderColor: "#ef4444" }]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.reasonText, { color: theme.text }]}>{reason}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedReason === "Other" && (
                <TextInput
                  style={[styles.textInput, { borderColor: theme.border, color: theme.text }]}
                  placeholder="Describe the reason..."
                  placeholderTextColor={theme.textSecondary}
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                  editable={!processing}
                />
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, styles.halfBtn, { borderColor: theme.border }]}
                  onPress={handleCancelClick}
                  disabled={processing}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.text }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.halfBtn, { backgroundColor: "#ef4444", opacity: canConfirmReject ? 1 : 0.5 }]}
                  onPress={handleConfirmReject}
                  disabled={processing || !canConfirmReject}
                >
                  {processing ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.actionBtnText}>Confirm Reject</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
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
  halfBtn: { flex: 1 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cancelBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
  reasonList: { marginTop: 14, gap: 4 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  radioOuter: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#1e293b",
    alignItems: "center", justifyContent: "center",
  },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#ef4444" },
  reasonText: { fontSize: 13, fontWeight: "600" },
  textInput: {
    borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8,
    fontSize: 13, minHeight: 60, textAlignVertical: "top",
  },
});