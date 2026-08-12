// ============================================
// SERVORA ERP — EditBatchModal Component
// ✅ Correction/typo-fix form for a single batch — calls
//    inventory-service.ts's correctBatchDetails() (FROZEN). This
//    modal contains NO Firestore calls of its own.
// ✅ Distinct from ReceiveBatchModal (creates a NEW batch) and
//    StockAdjustmentModal (records a real WASTE/consumption event
//    via FEFO) — this is specifically for fixing a mistake on an
//    EXISTING batch's own fields (batchNo typo, wrong expiryDate,
//    mis-keyed quantity), not a new business event.
// ✅ All three fields (batchNo, expiryDate, quantity) are editable,
//    per confirmed design. quantity changes ARE synced to
//    InventoryItem.currentStock by correctBatchDetails() itself
//    (recomputed from all batches) — this modal doesn't need to
//    know or care about that, it only calls the service function
//    and shows the result.
// ✅ Pre-fills all fields from the batch being edited — this is an
//    EDIT form, not a blank Receive Batch form.
// ✅ submitting/error/success state owned locally, mirroring
//    ReceiveBatchModal's own pattern.
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
import { correctBatchDetails } from "../services/inventory-service";

interface EditBatchModalProps {
  visible:      boolean;
  batch:        InventoryBatch | undefined;
  item:         InventoryItem | undefined;
  restaurantId: string;
  onClose:      () => void;
}

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function EditBatchModal({ visible, batch, item, restaurantId, onClose }: EditBatchModalProps) {
  const [batchNo,    setBatchNo]    = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity,   setQuantity]   = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error,       setError]     = useState<string | null>(null);
  const [success,     setSuccess]   = useState(false);

  useEffect(() => {
    if (visible && batch) {
      setBatchNo(batch.batchNo);
      setExpiryDate(batch.expiryDate ?? "");
      setQuantity(String(batch.quantity));
      setError(null);
      setSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, batch?.id]);

  if (!batch || !item) return null;

  const quantityNum = Number(quantity);
  const quantityIsValid = quantity.trim() !== "" && !Number.isNaN(quantityNum) && quantityNum >= 0;
  const dateIsValid = expiryDate.trim() === "" || isValidDateInput(expiryDate);
  const canSubmit = batchNo.trim() !== "" && quantityIsValid && dateIsValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
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
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update batch");
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
                <Text style={styles.successText}>Batch updated successfully</Text>
              </View>
            ) : (
              <>
                {error && (
                  <View style={styles.errorBox}>
                    <MaterialIcons name="error" size={16} color="#dc2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

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
                <TouchableOpacity
                  style={[styles.saveBtn, !canSubmit && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                >
                  <Text style={styles.saveBtnText}>{submitting ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
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
  saveBtnText: { color: "#fff", fontWeight: "700" },
  doneBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: "#059669", alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontWeight: "700" },
});