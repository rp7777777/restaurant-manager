// ============================================
// SERVORA ERP — StockAdjustmentModal Component
// ✅ UI-facing "Adjustment Type" maps directly onto the existing
//    StockMovementType/reasonCategory contract.
// ✅ Field semantics per type:
//    - Increase / Decrease / Correction → new ABSOLUTE stock value
//      (movementType: "ADJUSTMENT").
//    - Damage → movementType "WASTE", reasonCategory defaults to
//      "BROKEN" but user-editable.
//    - Waste → movementType "WASTE", reasonCategory defaults to
//      "SPOILED" but user-editable.
//    - Transfer In/Out → movementType "TRANSFER_IN"/"TRANSFER_OUT",
//      quantity is a DELTA.
//    - NEW — Return → movementType "RETURN", quantity is a DELTA
//      (stock increases). Routed through the SAME non-batch path as
//      Transfer In (submitNonBatch() → adjustStock()) — a return
//      isn't attributed to any specific existing batch (there's no
//      clear "which batch does this belong back to" answer for a
//      customer/kitchen return), so it increases the item's
//      aggregate currentStock directly rather than creating or
//      crediting a particular InventoryBatch. This mirrors exactly
//      how Transfer In already works — both are "stock arrived,
//      not from a new purchase, no specific batch to attach it to."
// ✅ BATCH-AWARE ROUTING: Increase/Decrease/Correction/Transfer
//    In/Return → non-batch path (adjustStock()). Damage/Waste/
//    Transfer Out → deductStockBatch() (FEFO).
// ✅ Reason picker (structured reasonCategory) shown for Damage/
//    Waste only — Return doesn't get a reason-category picker
//    (RETURN isn't currently a reasonCategory-bearing type in this
//    UI), only the free-text Notes field, consistent with Transfer
//    In/Out/Increase/Decrease/Correction.
// ✅ Zero-quantity guard for batch-aware types (Damage/Waste/
//    Transfer Out) requires > 0; absolute types (Increase/Decrease/
//    Correction) allow >= 0; Transfer In/Return (delta, non-batch,
//    non-zero-required) also require > 0 — a "return of 0" is a
//    no-op just like a "transfer of 0" would be.
// ✅ Reason picker selection is never overridden by
//    mapToMovementInput() — the picker's own state is the single
//    source of truth for reasonCategory.
// ✅ Success handling unified across both write paths — same
//    before→after confirmation regardless of which backend function
//    actually ran.
// ✅ State reset on modal (re)open — no stale type/quantity/reason/
//    error/success leaks between items.
// FROZEN
// ============================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, Platform, ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { useStockAdjustment } from "../hooks/useStockAdjustment";
import { deductStockBatch } from "../services/inventory-deduct-service";
import {
  StockMovementType,
  StockMovementReasonCategory,
} from "../../stock-movement-module/types/stock-movement";

type AdjustmentTypeOption =
  | "increase" | "decrease" | "correction" | "damage" | "waste" | "transferIn" | "transferOut" | "return";

const ADJUSTMENT_TYPE_OPTIONS: { value: AdjustmentTypeOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "increase",    label: "Increase",     icon: "add-circle-outline" },
  { value: "decrease",    label: "Decrease",     icon: "remove-circle-outline" },
  { value: "correction",  label: "Correction",   icon: "fact-check" },
  { value: "damage",      label: "Damage",       icon: "broken-image" },
  { value: "waste",       label: "Waste",        icon: "delete-outline" },
  { value: "transferIn",  label: "Transfer In",  icon: "call-received" },
  { value: "transferOut", label: "Transfer Out", icon: "call-made" },
  { value: "return",      label: "Return",       icon: "keyboard-return" },
];

const ABSOLUTE_VALUE_TYPES: AdjustmentTypeOption[] = ["increase", "decrease", "correction"];

const BATCH_AWARE_TYPES: AdjustmentTypeOption[] = ["damage", "waste", "transferOut"];

const REASON_CATEGORY_OPTIONS: { value: StockMovementReasonCategory; label: string }[] = [
  { value: "EXPIRED",           label: "Expired" },
  { value: "SPOILED",           label: "Spoiled" },
  { value: "BROKEN",            label: "Broken" },
  { value: "BURNT",             label: "Burnt" },
  { value: "PREPARATION_ERROR", label: "Preparation Error" },
  { value: "CUSTOMER_RETURN",   label: "Customer Return" },
  { value: "OTHER",             label: "Other" },
];

function mapToMovementInput(
  type: AdjustmentTypeOption,
  quantityInput: number
): { movementType: StockMovementType; quantity: number } {
  switch (type) {
    case "increase":
    case "decrease":
    case "correction":
      return { movementType: "ADJUSTMENT", quantity: quantityInput };
    case "damage":
    case "waste":
      return { movementType: "WASTE", quantity: quantityInput };
    case "transferIn":
      return { movementType: "TRANSFER_IN", quantity: quantityInput };
    case "transferOut":
      return { movementType: "TRANSFER_OUT", quantity: quantityInput };
    case "return":
      return { movementType: "RETURN", quantity: quantityInput };
  }
}

interface StockAdjustmentModalProps {
  visible:       boolean;
  item:          InventoryItem | undefined;
  restaurantId:  string;
  onClose:       () => void;
}

interface AdjustmentSuccess {
  beforeQuantity: number;
  afterQuantity:  number;
}

export function StockAdjustmentModal({ visible, item, restaurantId, onClose }: StockAdjustmentModalProps) {
  const { submit: submitNonBatch, reset: resetNonBatch } = useStockAdjustment();

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentTypeOption>("correction");
  const [quantity,       setQuantity]       = useState("");
  const [reasonCategory, setReasonCategory] = useState<StockMovementReasonCategory | undefined>(undefined);
  const [reasonText,     setReasonText]     = useState("");
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error,       setError]     = useState<string | null>(null);
  const [success,     setSuccess]   = useState<AdjustmentSuccess | null>(null);

  const isAbsoluteType = ABSOLUTE_VALUE_TYPES.includes(adjustmentType);
  const isBatchAwareType = BATCH_AWARE_TYPES.includes(adjustmentType);
  const showReasonCategoryPicker = adjustmentType === "damage" || adjustmentType === "waste";

  useEffect(() => {
    if (visible) {
      setAdjustmentType("correction");
      setQuantity(item ? String(item.currentStock) : "");
      setReasonCategory(undefined);
      setReasonText("");
      setShowReasonPicker(false);
      setSubmitting(false);
      setError(null);
      setSuccess(null);
      resetNonBatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id]);

  if (!item) return null;

  const handleTypeChange = (type: AdjustmentTypeOption) => {
    setAdjustmentType(type);
    setQuantity(ABSOLUTE_VALUE_TYPES.includes(type) ? String(item.currentStock) : "");
    setReasonCategory(type === "damage" ? "BROKEN" : type === "waste" ? "SPOILED" : undefined);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const quantityNum = Number(quantity);
    if (Number.isNaN(quantityNum) || quantityNum < 0) return;
    if (!isAbsoluteType && quantityNum <= 0) return;

    const mapped = mapToMovementInput(adjustmentType, quantityNum);

    setSubmitting(true);
    setError(null);

    try {
      if (isBatchAwareType) {
        const result = await deductStockBatch(restaurantId, item, {
          inventoryId:    item.id,
          quantity:       mapped.quantity,
          movementType:   mapped.movementType as "WASTE" | "TRANSFER_OUT",
          reasonCategory: reasonCategory,
          reason:         reasonText.trim() || undefined,
        });
        setSuccess({
          beforeQuantity: result.allocation.beforeQuantity,
          afterQuantity:  result.allocation.afterQuantity,
        });
      } else {
        const result = await submitNonBatch(
          restaurantId,
          item.id,
          mapped.movementType,
          mapped.quantity,
          {
            reasonCategory: reasonCategory,
            reason: reasonText.trim() || undefined,
          }
        );
        if (result) {
          setSuccess({
            beforeQuantity: result.beforeQuantity,
            afterQuantity:  result.afterQuantity,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setSubmitting(false);
    }
  };

  const quantityValue = Number(quantity);
  const quantityIsValid = isAbsoluteType
    ? quantity.trim() !== "" && !Number.isNaN(quantityValue) && quantityValue >= 0
    : quantity.trim() !== "" && !Number.isNaN(quantityValue) && quantityValue > 0;
  const reasonRequired = reasonCategory === "OTHER" && !reasonText.trim();
  const canSubmit = quantityIsValid && !reasonRequired && !submitting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Adjust Stock</Text>
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
                  Stock updated: {success.beforeQuantity} {item.unit} → {success.afterQuantity} {item.unit}
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

                <Text style={styles.label}>Adjustment Type</Text>
                <View style={styles.typeGrid}>
                  {ADJUSTMENT_TYPE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.typeChip, adjustmentType === opt.value && styles.typeChipActive]}
                      onPress={() => handleTypeChange(opt.value)}
                    >
                      <MaterialIcons
                        name={opt.icon}
                        size={16}
                        color={adjustmentType === opt.value ? "#fff" : "#475569"}
                      />
                      <Text style={[styles.typeChipText, adjustmentType === opt.value && styles.typeChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>
                  {isAbsoluteType ? `New Stock (${item.unit}) *` : `Quantity (${item.unit}) *`}
                </Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder={isAbsoluteType ? "New total stock" : "Amount"}
                />

                {showReasonCategoryPicker && (
                  <>
                    <Text style={styles.label}>Reason *</Text>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowReasonPicker((v) => !v)}
                    >
                      <Text style={styles.pickerButtonText}>
                        {reasonCategory
                          ? REASON_CATEGORY_OPTIONS.find((r) => r.value === reasonCategory)?.label
                          : "Select a reason"}
                      </Text>
                      <MaterialIcons name={showReasonPicker ? "expand-less" : "expand-more"} size={20} color="#64748b" />
                    </TouchableOpacity>
                    {showReasonPicker && (
                      <View style={styles.pickerList}>
                        {REASON_CATEGORY_OPTIONS.map((r) => (
                          <TouchableOpacity
                            key={r.value}
                            style={styles.pickerItem}
                            onPress={() => { setReasonCategory(r.value); setShowReasonPicker(false); }}
                          >
                            <Text style={styles.pickerItemText}>{r.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.label}>
                  Notes {reasonCategory === "OTHER" ? "*" : "(optional)"}
                </Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={reasonText}
                  onChangeText={setReasonText}
                  placeholder="e.g. Physical count after monthly audit"
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
  itemName: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginTop: 12 },
  currentStockLine: { fontSize: 13, color: "#64748b", marginTop: 2, marginBottom: 8 },
  currentStockValue: { fontWeight: "700", color: "#1e293b" },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 12, marginBottom: 6 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  typeChipActive: { backgroundColor: "#0369a1", borderColor: "#0369a1" },
  typeChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  typeChipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14, color: "#1e293b",
  },
  notesInput: { minHeight: 64, textAlignVertical: "top" },
  pickerButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pickerButtonText: { fontSize: 14, color: "#1e293b" },
  pickerList: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, backgroundColor: "#f8fafc", overflow: "hidden",
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