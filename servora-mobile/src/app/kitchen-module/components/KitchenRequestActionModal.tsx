// ============================================
// SERVORA ERP — KitchenRequestActionModal Component
// ✅ Shown when Kitchen taps "View" on a request in its own History
//    table (matches Store's PendingActionModal/RequestDetailModal
//    pattern for the equivalent screens).
// ✅ PENDING requests — Kitchen can EDIT (Quantity ONLY) or DELETE
//    its own mistaken entry, since Store has not yet acted on it.
// ✅ Edit is QUANTITY-ONLY — Item Name and Unit are shown as
//    read-only display text, NOT editable inputs. Rationale: a
//    free-typed item name/unit would not correspond to any real
//    Inventory item (the request's own inventoryId stays pointed at
//    the ORIGINAL item, so a changed name would create a mismatch
//    between the displayed name and the actual linked Inventory
//    item). If the wrong item was picked entirely, Delete + create a
//    fresh request (via the existing New Request form, which does
//    proper Inventory search) is the correct fix — not free-text
//    editing here.
// ✅ APPROVED/ISSUED/REJECTED requests — READ-ONLY detail view only
//    (no Edit/Delete controls) — Store has already acted on these.
// ✅ readOnly prop: when true, Edit/Delete are hidden even for
//    PENDING requests. Used by KitchenHistoryFullScreenModal (View-
//    only there; Edit/Delete live only on the daily screen).
// 🔒 Both mutations are ALSO enforced server-side (status !==
//    "PENDING" throws in kitchen-request-service.ts) — this modal's
//    own status check is a UX convenience, not the source of truth.
// FROZEN
// ============================================

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, TextInput, Alert, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../types/kitchen-types";

const isWeb = Platform.OS === "web";

function confirmDelete(onConfirm: () => void) {
  if (isWeb) {
    if (window.confirm("Delete this request? This cannot be undone.")) onConfirm();
  } else {
    Alert.alert("Delete Request", "Delete this request? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onConfirm },
    ]);
  }
}

interface Theme {
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
}

interface KitchenRequestActionModalProps {
  visible:    boolean;
  request:    IngredientRequest | null;
  processing: boolean;
  theme:      Theme;
  readOnly?:  boolean;
  onSave:     (updated: { itemName: string; orderQuantity: number; unit: string }) => void;
  onDelete:   () => void;
  onClose:    () => void;
}

function DetailRow({ label, value, textColor, secondaryColor }: { label: string; value: string; textColor: string; secondaryColor: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: secondaryColor }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

export function KitchenRequestActionModal({
  visible, request, processing, theme, readOnly = false, onSave, onDelete, onClose,
}: KitchenRequestActionModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState("");

  useEffect(() => {
    if (!visible || !request) {
      setEditMode(false);
      return;
    }
    setOrderQuantity(String(request.orderQuantity));
    setEditMode(false);
  }, [visible, request?.id]);

  if (!request) return null;

  const isPending = request.status === "PENDING";
  const canEdit = isPending && !readOnly;

  const handleSave = () => {
    const qty = Number(orderQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      isWeb ? window.alert("Quantity must be a valid number greater than 0") : Alert.alert("Error", "Quantity must be a valid number greater than 0");
      return;
    }
    onSave({ itemName: request.itemName, orderQuantity: qty, unit: request.unit });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          {!editMode ? (
            <>
              <Text style={[styles.title, { color: theme.textSecondary }]}>{isPending ? "Pending Request" : "Request Details"}</Text>
              <Text style={[styles.itemName, { color: theme.text }]}>{request.itemName}</Text>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <DetailRow label="Requested Qty" value={`${request.orderQuantity} ${request.unit}`} textColor={theme.text} secondaryColor={theme.textSecondary} />
              <DetailRow label="Required Date" value={request.requiredDate} textColor={theme.text} secondaryColor={theme.textSecondary} />
              <DetailRow label="Status" value={request.status} textColor={theme.text} secondaryColor={theme.textSecondary} />
              {request.note ? (
                <DetailRow label="Note" value={request.note} textColor={theme.text} secondaryColor={theme.textSecondary} />
              ) : null}
              {!isPending && request.rejectionNote ? (
                <DetailRow label="Rejection Reason" value={request.rejectionNote} textColor={theme.text} secondaryColor={theme.textSecondary} />
              ) : null}

              {canEdit && (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#2563eb" }]}
                    onPress={() => setEditMode(true)}
                    disabled={processing}
                  >
                    <MaterialIcons name="edit" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#dc2626" }]}
                    onPress={() => confirmDelete(onDelete)}
                    disabled={processing}
                  >
                    {processing ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <MaterialIcons name="delete" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Delete</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.border }]} onPress={onClose} disabled={processing}>
                <Text style={[styles.closeBtnText, { color: theme.text }]}>Close</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.textSecondary }]}>Edit Request</Text>
              <Text style={[styles.itemName, { color: theme.text }]}>{request.itemName}</Text>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Quantity</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={orderQuantity}
                onChangeText={setOrderQuantity}
                keyboardType="decimal-pad"
                editable={!processing}
                autoFocus
              />
              <Text style={[styles.unitReadOnlyText, { color: theme.textSecondary }]}>
                Unit: <Text style={{ fontWeight: "700", color: theme.text }}>{request.unit}</Text> (not editable — delete and re-create if the item/unit itself is wrong)
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, styles.halfBtn, { borderColor: theme.border }]}
                  onPress={() => setEditMode(false)}
                  disabled={processing}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.halfBtn, { backgroundColor: "#2563eb" }]}
                  onPress={handleSave}
                  disabled={processing}
                >
                  {processing ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.actionBtnText}>Save</Text>
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
  modal: { width: "100%", maxWidth: 380, borderRadius: 16, padding: 20 },
  title: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  itemName: { fontSize: 17, fontWeight: "800", marginTop: 4, marginBottom: 10 },
  divider: { height: 1, marginBottom: 10 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  detailLabel: { fontSize: 12, fontWeight: "600" },
  detailValue: { fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "right", marginLeft: 12 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  halfBtn: { flex: 1 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cancelBtn: { paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
  closeBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  closeBtnText: { fontSize: 14, fontWeight: "700" },
  fieldLabel: { fontSize: 10, fontWeight: "700", marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 10,
    fontSize: 13,
  },
  unitReadOnlyText: { fontSize: 10, marginTop: 8, lineHeight: 14 },
});