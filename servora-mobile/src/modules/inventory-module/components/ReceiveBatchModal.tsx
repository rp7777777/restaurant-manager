// ============================================
// SERVORA ERP — ReceiveBatchModal Component
// ✅ Form for creating a new batch (Receive Stock) — calls
//    inventory-service.ts's receiveBatch() (FROZEN, 9.8/10), which
//    orchestrates batch creation + PURCHASE movement + batch-
//    derived currentStock recompute. This modal contains NO
//    Firestore calls of its own.
// ✅ Verified against the actual FROZEN ReceiveBatchResult shape
//    ({ batchId, newCurrentStock, movementId }) — success.newCurrentStock
//    used below matches exactly.
// ✅ inventoryId/itemName/unit are auto-filled from the item prop.
// ✅ status is NEVER set by this form — omitted entirely, letting
//    the repository default to "ACTIVE".
// ✅ locationId is NOT collected — no location picker UI exists yet.
// ✅ Supplier picker reuses the suppliers list already loaded by
//    InventoryScreen.tsx.
// ✅ Date fields default to today; expiryDate has no default.
// ✅ NEW — isValidDateInput() shape-checks purchaseDate/
//    receivedDate/expiryDate as YYYY-MM-DD before allowing submit —
//    a UX-layer catch (matching the existing precedent in
//    useInventoryForm.ts's isValidExpiryDate()) so a malformed date
//    like "02/08/2026" is caught here rather than only surfacing as
//    a repository-thrown error after tapping Receive Batch.
// ✅ NEW — quantity/unitCost inputs now use keyboardType=
//    "decimal-pad" instead of "numeric", since both commonly need
//    decimal values (2.5kg, 1.25L, €4.75/unit) — "numeric" on some
//    platforms doesn't reliably show a decimal point key.
// ✅ submitting/error state owned locally, mirroring
//    useInventoryForm.ts's pattern — a simple, single-shot form.
// ✅ Success shows a brief confirmation before the caller closes the
//    modal, matching StockAdjustmentModal's existing pattern.
// FROZEN
// ============================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, Platform, ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { CreateInventoryBatchInput } from "../types/inventory-batch";
import { receiveBatch, ReceiveBatchResult } from "../services/inventory-receive-service";
import { Supplier } from "../../supplier-module/types/supplier";
import { todayISO } from "../../../utils/date-utils";

interface ReceiveBatchModalProps {
  visible:      boolean;
  item:         InventoryItem | undefined;
  restaurantId: string;
  suppliers:    Supplier[];
  onClose:      () => void;
}

// ── Lightweight YYYY-MM-DD shape check — same precedent as
//    useInventoryForm.ts's isValidExpiryDate(). Not a full calendar-
//    validity check (that stays a repository-layer concern), just a
//    UX-layer catch for obviously malformed input. ──
function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function ReceiveBatchModal({ visible, item, restaurantId, suppliers, onClose }: ReceiveBatchModalProps) {
  const [batchNo,      setBatchNo]      = useState("");
  const [quantity,     setQuantity]     = useState("");
  const [unitCost,     setUnitCost]     = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [expiryDate,   setExpiryDate]   = useState("");
  const [supplierId,   setSupplierId]   = useState("");
  const [notes,        setNotes]        = useState("");
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error,       setError]     = useState<string | null>(null);
  const [success,     setSuccess]   = useState<ReceiveBatchResult | null>(null);

  useEffect(() => {
    if (visible) {
      const today = todayISO();
      setBatchNo("");
      setQuantity("");
      setUnitCost(item ? String(item.unitCost) : "");
      setPurchaseDate(today);
      setReceivedDate(today);
      setExpiryDate("");
      setSupplierId(item?.supplierId ?? "");
      setNotes("");
      setShowSupplierPicker(false);
      setError(null);
      setSuccess(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id]);

  if (!item) return null;

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const quantityNum = Number(quantity);
  const unitCostNum = Number(unitCost);
  const quantityIsValid = quantity.trim() !== "" && !Number.isNaN(quantityNum) && quantityNum > 0;
  const unitCostIsValid = unitCost.trim() !== "" && !Number.isNaN(unitCostNum) && unitCostNum >= 0;
  const datesAreValid =
    isValidDateInput(purchaseDate) &&
    isValidDateInput(receivedDate) &&
    (expiryDate.trim() === "" || isValidDateInput(expiryDate));

  const canSubmit =
    batchNo.trim() !== "" &&
    quantityIsValid &&
    unitCostIsValid &&
    datesAreValid &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    const input: CreateInventoryBatchInput = {
      inventoryId:  item.id,
      itemName:     item.itemName,
      batchNo:      batchNo.trim(),
      quantity:     quantityNum,
      unit:         item.unit,
      unitCost:     unitCostNum,
      purchaseDate,
      receivedDate,
      expiryDate:   expiryDate.trim() || undefined,
      supplierId:   supplierId || undefined,
      notes:        notes.trim() || undefined,
    };

    try {
      const result = await receiveBatch(restaurantId, item, input);
      setSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive batch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Receive Batch</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.itemName}>{item.itemName}</Text>
            <Text style={styles.currentStockLine}>
              Current Stock: <Text style={styles.currentStockValue}>{item.currentStock} {item.unit}</Text>
            </Text>

            {success ? (
              <View style={styles.successBox}>
                <MaterialIcons name="check-circle" size={20} color="#059669" />
                <Text style={styles.successText}>
                  Batch received — stock is now {success.newCurrentStock} {item.unit}
                </Text>
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

                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Quantity ({item.unit}) *</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Unit Cost *</Text>
                    <TextInput
                      style={styles.input}
                      value={unitCost}
                      onChangeText={setUnitCost}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Purchase Date *</Text>
                    <TextInput
                      style={styles.input}
                      value={purchaseDate}
                      onChangeText={setPurchaseDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Received Date *</Text>
                    <TextInput
                      style={styles.input}
                      value={receivedDate}
                      onChangeText={setReceivedDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Expiry Date (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                  placeholder="YYYY-MM-DD"
                />

                <Text style={styles.label}>Supplier (optional)</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowSupplierPicker((v) => !v)}
                >
                  <Text style={styles.pickerButtonText}>
                    {selectedSupplier ? selectedSupplier.name : "None"}
                  </Text>
                  <MaterialIcons name={showSupplierPicker ? "expand-less" : "expand-more"} size={20} color="#64748b" />
                </TouchableOpacity>
                {showSupplierPicker && (
                  <View style={styles.pickerList}>
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => { setSupplierId(""); setShowSupplierPicker(false); }}
                    >
                      <Text style={styles.pickerItemText}>None</Text>
                    </TouchableOpacity>
                    {suppliers.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.pickerItem}
                        onPress={() => { setSupplierId(s.id); setShowSupplierPicker(false); }}
                      >
                        <Text style={styles.pickerItemText}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Delivered slightly bruised"
                  multiline
                  numberOfLines={3}
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
                <TouchableOpacity
                  style={[styles.saveBtn, !canSubmit && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                >
                  <Text style={styles.saveBtnText}>{submitting ? "Receiving..." : "Receive Batch"}</Text>
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
  itemName: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginTop: 12 },
  currentStockLine: { fontSize: 13, color: "#64748b", marginTop: 2, marginBottom: 8 },
  currentStockValue: { fontWeight: "700", color: "#1e293b" },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14, color: "#1e293b",
  },
  notesInput: { minHeight: 64, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  pickerButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pickerButtonText: { fontSize: 14, color: "#1e293b" },
  pickerList: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 200, backgroundColor: "#f8fafc", overflow: "hidden",
  },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 10 },
  pickerItemText: { fontSize: 14, color: "#1e293b" },
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