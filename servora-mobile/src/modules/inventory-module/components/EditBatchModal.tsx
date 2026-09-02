// ============================================
// SERVORA ERP — EditBatchModal Component
// ✅ Correction/typo-fix form for a single batch — calls
//    inventory-service.ts's correctBatchDetails() (FROZEN).
// ✅ Distinct from ReceiveBatchModal and StockAdjustmentModal.
// ✅ All three fields (batchNo, expiryDate, quantity) editable.
// ✅ Pre-fills all fields from the batch being edited.
// ✅ NEW — embeds MoveBatchSection for correcting a batch that was
//    received against the WRONG InventoryItem entirely (a different
//    class of mistake from batchNo/expiryDate/quantity typos — this
//    one requires moving the batch's inventoryId itself, transferring
//    quantity between two items' currentStock, which
//    correctBatchDetails() cannot do). When a move target is
//    selected, the form switches into "move mode": the regular
//    batchNo/quantity/expiry fields are hidden (editing details on a
//    batch you're about to move to a different item is confusing —
//    the target item receives it as-is, correct details later if
//    still needed), replaced by a clear "Move to [item]" confirmation
//    summary and a dedicated "Confirm Move" button that calls
//    moveBatchToItem() instead of correctBatchDetails().
// ✅ submitting/error/success state shared between both flows (edit
//    vs move) — only one can ever be in progress at once, since
//    they're mutually exclusive UI states within the same modal.
// FROZEN
// ============================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, Platform, ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { InventoryBatch } from "../types/inventory-batch";
import { correctBatchDetails } from "../services/inventory-correct-service";
import { moveBatchToItem } from "../services/inventory-move-service";
import { MoveBatchSection } from "./MoveBatchSection";

interface EditBatchModalProps {
  visible:      boolean;
  batch:        InventoryBatch | undefined;
  item:         InventoryItem | undefined;
  allItems:     InventoryItem[];
  restaurantId: string;
  actorName:    string;
  onClose:      () => void;
}

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function EditBatchModal({
  visible, batch, item, allItems, restaurantId, actorName, onClose,
}: EditBatchModalProps) {
  const [batchNo,    setBatchNo]    = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity,   setQuantity]   = useState("");

  const [moveTarget, setMoveTarget] = useState<InventoryItem | undefined>(undefined);

  const [submitting, setSubmitting] = useState(false);
  const [error,       setError]     = useState<string | null>(null);
  const [success,     setSuccess]   = useState(false);
  const [successMessage, setSuccessMessage] = useState("Batch updated successfully");

  useEffect(() => {
    if (visible && batch) {
      setBatchNo(batch.batchNo);
      setExpiryDate(batch.expiryDate ?? "");
      setQuantity(String(batch.quantity));
      setMoveTarget(undefined);
      setError(null);
      setSuccess(false);
      setSuccessMessage("Batch updated successfully");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, batch?.id]);

  if (!batch || !item) return null;

  const quantityNum = Number(quantity);
  const quantityIsValid = quantity.trim() !== "" && !Number.isNaN(quantityNum) && quantityNum >= 0;
  const dateIsValid = expiryDate.trim() === "" || isValidDateInput(expiryDate);
  const canSubmitEdit = !moveTarget && batchNo.trim() !== "" && quantityIsValid && dateIsValid && !submitting;
  const canSubmitMove = !!moveTarget && !submitting;

  const handleSubmitEdit = async () => {
    if (!canSubmitEdit) return;
    setSubmitting(true);
    setError(null);

    try {
      await correctBatchDetails(restaurantId, item, {
        batchId:    batch.id,
        itemId:     item.id,
        batchNo:    batchNo.trim() !== batch.batchNo ? batchNo.trim() : undefined,
        expiryDate: expiryDate.trim() !== (batch.expiryDate ?? "") ? expiryDate.trim() : undefined,
        quantity:   quantityNum !== batch.quantity ? quantityNum : undefined,
      });
      setSuccessMessage("Batch updated successfully");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update batch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMove = async () => {
    if (!moveTarget) return;
    setSubmitting(true);
    setError(null);

    try {
      await moveBatchToItem(restaurantId, batch.id, moveTarget, {
        createdByName: actorName,
      });
      setSuccessMessage(`Batch moved to "${moveTarget.itemName}"`);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move batch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Batch</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.itemName}>{item.itemName}</Text>

            {success ? (
              <View style={styles.successBox}>
                <MaterialIcons name="check-circle" size={20} color="#059669" />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : (
              <>
                {error && (
                  <View style={styles.errorBox}>
                    <MaterialIcons name="error" size={16} color="#dc2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {moveTarget ? (
                  <View style={styles.moveConfirmBox}>
                    <MaterialIcons name="swap-horiz" size={18} color="#0369a1" />
                    <Text style={styles.moveConfirmText}>
                      Batch {batch.batchNo} ({batch.quantity} {batch.unit}) will move from{" "}
                      <Text style={styles.moveConfirmBold}>{item.itemName}</Text> to{" "}
                      <Text style={styles.moveConfirmBold}>{moveTarget.itemName}</Text>
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>Batch Number *</Text>
                    <TextInput
                      style={styles.input}
                      value={batchNo}
                      onChangeText={setBatchNo}
                      placeholder="e.g. AV-2026-0802"
                    />

                    <Text style={styles.label}>Quantity ({item.unit}) *</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />

                    <Text style={styles.label}>Expiry Date (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={expiryDate}
                      onChangeText={setExpiryDate}
                      placeholder="YYYY-MM-DD"
                    />

                    <View style={styles.warningBox}>
                      <MaterialIcons name="warning" size={14} color="#d97706" />
                      <Text style={styles.warningText}>
                        Changing quantity here corrects a data-entry mistake — it does not create a stock movement record. For actual waste, transfers, or usage, use Adjust Stock instead.
                      </Text>
                    </View>
                  </>
                )}

                <MoveBatchSection
                  allItems={allItems}
                  currentItemId={item.id}
                  selectedTarget={moveTarget}
                  onSelectTarget={setMoveTarget}
                />
              </>
            )}
          </ScrollView>

          <View style={styles.actionRow}>
            {success ? (
              <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                {moveTarget ? (
                  <TouchableOpacity
                    style={[styles.moveBtn, !canSubmitMove && { opacity: 0.5 }]}
                    onPress={handleSubmitMove}
                    disabled={!canSubmitMove}
                  >
                    <Text style={styles.saveBtnText}>{submitting ? "Moving..." : "Confirm Move"}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.saveBtn, !canSubmitEdit && { opacity: 0.5 }]}
                    onPress={handleSubmitEdit}
                    disabled={!canSubmitEdit}
                  >
                    <Text style={styles.saveBtnText}>{submitting ? "Saving..." : "Save"}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: "85%", paddingBottom: Platform.OS === "web" ? 16 : 24,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  body: { paddingHorizontal: 16 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginTop: 12, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14, color: "#1e293b",
  },
  warningBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#fffbeb", padding: 10, borderRadius: 8, marginTop: 16,
  },
  warningText: { color: "#92400e", fontSize: 11, fontWeight: "600", flex: 1 },
  moveConfirmBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#eff6ff", padding: 14, borderRadius: 10, marginTop: 12,
  },
  moveConfirmText: { fontSize: 13, color: "#1e40af", flex: 1, lineHeight: 19 },
  moveConfirmBold: { fontWeight: "800" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 8, marginTop: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "600", flex: 1 },
  successBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ecfdf5", padding: 14, borderRadius: 10, marginTop: 16,
  },
  successText: { color: "#065f46", fontSize: 13, fontWeight: "700", flex: 1 },
  actionRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center",
  },
  cancelBtnText: { color: "#475569", fontWeight: "700" },
  saveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: "#0369a1", alignItems: "center",
  },
  moveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: "#0369a1", alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  doneBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: "#059669", alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontWeight: "700" },
});