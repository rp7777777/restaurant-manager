// ============================================
// SERVORA ERP — StockAdjustmentModal Component
// ✅ UI-facing "Adjustment Type" maps directly onto the existing
//    StockMovementType/reasonCategory contract from
//    stock-movement-module/types — NO new movement types or backend
//    logic were added. See useStockAdjustment.ts for the write path.
// ✅ Field semantics per type (confirmed design decision — simple,
//    less error-prone UX over hidden delta arithmetic):
//    - Increase / Decrease / Correction → user enters the NEW
//      ABSOLUTE stock value (movementType: "ADJUSTMENT"). Avoids
//      stale-read bugs: if another user changed stock between page
//      load and submit, a "+5" delta would silently apply to the
//      wrong base. An absolute new-count entry (like a physical
//      audit recount) can't drift this way — this is the standard
//      SAP/Dynamics/Oracle pattern for manual stock corrections.
//    - Damage → movementType "WASTE", reasonCategory "BROKEN",
//      quantity is a DELTA (amount damaged).
//    - Waste → movementType "WASTE", reasonCategory "SPOILED",
//      quantity is a DELTA (amount wasted).
//    - Transfer In/Out → movementType "TRANSFER_IN"/"TRANSFER_OUT",
//      quantity is a DELTA.
// ✅ The reason-category picker is shown for Damage/Waste only in
//    THIS release — those are the two types where a structured
//    reason is expected every time. Increase/Decrease/Correction/
//    Transfer don't surface it here; a free-text Notes field is
//    always available for context on any type. Widening the picker
//    to those types (with an "advanced reason" toggle) is a
//    possible future enhancement, not implemented in this file.
// ✅ Current stock is always shown read-only for context — never
//    editable directly here (that's InventoryForm's "manual
//    correction only" field, a different, lower-frequency path).
// ✅ Success state shows a brief confirmation (before → after) then
//    the parent is responsible for closing the modal — this
//    component doesn't auto-close itself, so the user can see the
//    result of what they just did before it disappears.
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
import {
  StockMovementType,
  StockMovementReasonCategory,
} from "../../stock-movement-module/types/stock-movement";

type AdjustmentTypeOption =
  | "increase" | "decrease" | "correction" | "damage" | "waste" | "transferIn" | "transferOut";

const ADJUSTMENT_TYPE_OPTIONS: { value: AdjustmentTypeOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "increase",    label: "Increase",     icon: "add-circle-outline" },
  { value: "decrease",    label: "Decrease",     icon: "remove-circle-outline" },
  { value: "correction",  label: "Correction",   icon: "fact-check" },
  { value: "damage",      label: "Damage",       icon: "broken-image" },
  { value: "waste",       label: "Waste",        icon: "delete-outline" },
  { value: "transferIn",  label: "Transfer In",  icon: "call-received" },
  { value: "transferOut", label: "Transfer Out", icon: "call-made" },
];

// Types where the quantity field means "new absolute total" —
// everything else means "delta to add/subtract".
const ABSOLUTE_VALUE_TYPES: AdjustmentTypeOption[] = ["increase", "decrease", "correction"];

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
): { movementType: StockMovementType; quantity: number; reasonCategory?: StockMovementReasonCategory } {
  switch (type) {
    case "increase":
    case "decrease":
    case "correction":
      // Absolute new value — entered directly by the user.
      return { movementType: "ADJUSTMENT", quantity: quantityInput };
    case "damage":
      return { movementType: "WASTE", quantity: quantityInput, reasonCategory: "BROKEN" };
    case "waste":
      return { movementType: "WASTE", quantity: quantityInput, reasonCategory: "SPOILED" };
    case "transferIn":
      return { movementType: "TRANSFER_IN", quantity: quantityInput };
    case "transferOut":
      return { movementType: "TRANSFER_OUT", quantity: quantityInput };
  }
}

interface StockAdjustmentModalProps {
  visible:       boolean;
  item:          InventoryItem | undefined;
  restaurantId:  string;
  onClose:       () => void;
}

export function StockAdjustmentModal({ visible, item, restaurantId, onClose }: StockAdjustmentModalProps) {
  const { submitting, error, success, submit, reset } = useStockAdjustment();

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentTypeOption>("correction");
  const [quantity,       setQuantity]       = useState("");
  const [reasonCategory, setReasonCategory] = useState<StockMovementReasonCategory | undefined>(undefined);
  const [reasonText,     setReasonText]     = useState("");
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  const isAbsoluteType = ABSOLUTE_VALUE_TYPES.includes(adjustmentType);
  const showReasonCategoryPicker = adjustmentType === "damage" || adjustmentType === "waste";

  // ✅ Reset all local form state when the modal is (re)opened for a
  // (possibly different) item — prevents stale values from a
  // previous adjustment leaking into the next one.
  useEffect(() => {
    if (visible) {
      setAdjustmentType("correction");
      setQuantity(item ? String(item.currentStock) : "");
      setReasonCategory(undefined);
      setReasonText("");
      setShowReasonPicker(false);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id]);

  if (!item) return null;

  const handleTypeChange = (type: AdjustmentTypeOption) => {
    setAdjustmentType(type);
    // Pre-fill with current stock for absolute-value types (correction
    // starting point); clear for delta types (damage/waste/transfer
    // start from zero, not from current stock).
    setQuantity(ABSOLUTE_VALUE_TYPES.includes(type) ? String(item.currentStock) : "");
    setReasonCategory(type === "damage" ? "BROKEN" : type === "waste" ? "SPOILED" : undefined);
  };

  const handleSubmit = async () => {
    const quantityNum = Number(quantity);
    if (Number.isNaN(quantityNum) || quantityNum < 0) return;

    const mapped = mapToMovementInput(adjustmentType, quantityNum);

    await submit(
      restaurantId,
      item.id,
      mapped.movementType,
      mapped.quantity,
      {
        reasonCategory: mapped.reasonCategory ?? reasonCategory,
        reason: reasonText.trim() || undefined,
      }
    );
  };

  const quantityIsValid = quantity.trim() !== "" && !Number.isNaN(Number(quantity)) && Number(quantity) >= 0;
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