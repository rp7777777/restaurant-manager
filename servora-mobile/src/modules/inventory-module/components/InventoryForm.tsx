// ============================================
// SERVORA ERP — InventoryForm Component
// ✅ Add/Edit form for InventoryItem.
// ✅ Pure presentation — ALL form state, validation, and submit
//    logic for the ITEM fields lives in useInventoryForm.ts.
// ✅ Edit mode shows a "Manual correction only" warning above
//    Current Stock.
// ✅ sku, barcode, notes, isActive fields wired into the UI.
// ✅ Save button shows the hook's `submitting` state.
// ✅ NEW — "Received Date" field, CREATE MODE ONLY. This is
//    deliberately NOT part of useInventoryForm.ts's state — it's
//    not an InventoryItem field at all (CreateInventoryItemInput
//    has no receivedDate), it's metadata for the INITIAL BATCH that
//    createInventoryItemWithInitialBatch() (inventory-service.ts)
//    creates when the user enters a starting quantity. Kept as a
//    local useState here, separate from the item-field hook, and
//    passed as a SECOND argument to onSubmit — the parent
//    (InventoryScreen.tsx) is what actually threads it through to
//    createInventoryItemWithInitialBatch(). Defaults to today; the
//    field itself defaults to blank display but the parent treats
//    blank as "use today" (matching
//    createInventoryItemWithInitialBatch()'s own default).
//    Not shown in edit mode — editing an existing item never
//    creates a new batch, so there's no "received date" concept to
//    collect there.
// FROZEN
// ============================================

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform, Switch,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  InventoryItem, InventoryUnit,
  CreateInventoryItemInput, UpdateInventoryItemInput,
} from "../types/inventory";
import { CategoryPickerGroup } from "../hooks/useCategoriesForPicker";
import { useInventoryForm } from "../hooks/useInventoryForm";
import { Supplier } from "../../supplier-module/types/supplier";

const UNITS: InventoryUnit[] = ["kg", "g", "L", "ml", "pcs", "box", "bag", "bottle", "pac"];

interface InventoryFormProps {
  mode:            "create" | "edit";
  initial?:        InventoryItem;
  categoryGroups:  CategoryPickerGroup[];
  suppliers:       Supplier[];
  onSubmit:        (input: CreateInventoryItemInput | UpdateInventoryItemInput, receivedDate?: string) => void | Promise<void>;
  onCancel:        () => void;
}

export function InventoryForm({
  mode, initial, categoryGroups, suppliers, onSubmit, onCancel,
}: InventoryFormProps) {
  const form = useInventoryForm(initial);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showUnitPicker,     setShowUnitPicker]     = useState(false);
  // ✅ NEW — create-mode-only, see FROZEN header.
  const [receivedDate, setReceivedDate] = useState("");

  const selectedCategory = categoryGroups
    .flatMap((g) => g.categories)
    .find((c) => c.id === form.categoryId);
  const selectedSupplier = suppliers.find((s) => s.id === form.supplierId);

  const handleSave = () => {
    form.handleSubmit((input) => onSubmit(input, mode === "create" ? receivedDate.trim() || undefined : undefined));
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {mode === "create" ? "Add Inventory Item" : "Edit Inventory Item"}
      </Text>

      {form.error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{form.error}</Text>
        </View>
      )}

      <Text style={styles.label}>Item Name *</Text>
      <TextInput
        style={styles.input}
        value={form.itemName}
        onChangeText={form.setItemName}
        placeholder="e.g. Salmon Fillet"
      />

      <Text style={styles.label}>Category *</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowCategoryPicker((v) => !v)}
      >
        <Text style={styles.pickerButtonText}>
          {selectedCategory
            ? `${selectedCategory.icon ?? ""} ${selectedCategory.name}`
            : "Select a category"}
        </Text>
        <MaterialIcons name={showCategoryPicker ? "expand-less" : "expand-more"} size={20} color="#64748b" />
      </TouchableOpacity>
      {showCategoryPicker && (
        <ScrollView style={styles.pickerList} nestedScrollEnabled>
          {categoryGroups.map((group) => (
            <View key={group.department?.id ?? "none"}>
              {group.department && (
                <Text style={styles.pickerGroupLabel}>
                  {group.department.icon} {group.department.name}
                </Text>
              )}
              {group.categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.pickerItem}
                  onPress={() => { form.setCategoryId(cat.id); setShowCategoryPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>{cat.icon} {cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ✅ Current Stock — Manual correction warning in Edit mode */}
      <Text style={styles.label}>Current Stock *</Text>
      {mode === "edit" && (
        <View style={styles.warningBox}>
          <MaterialIcons name="warning" size={14} color="#d97706" />
          <Text style={styles.warningText}>
            Manual correction only — for receiving, issuing, or waste, use Stock Movement instead
          </Text>
        </View>
      )}
      {mode === "create" && (
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={14} color="#0369a1" />
          <Text style={styles.infoText}>
            Entering a starting quantity here creates the item's first batch automatically.
          </Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <TextInput
            style={styles.input}
            value={form.currentStock}
            onChangeText={form.setCurrentStock}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Unit *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowUnitPicker((v) => !v)}
          >
            <Text style={styles.pickerButtonText}>{form.unit}</Text>
            <MaterialIcons name={showUnitPicker ? "expand-less" : "expand-more"} size={18} color="#64748b" />
          </TouchableOpacity>
          {showUnitPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={styles.pickerItem}
                  onPress={() => { form.setUnit(u); setShowUnitPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Unit Cost *</Text>
          <TextInput
            style={styles.input}
            value={form.unitCost}
            onChangeText={form.setUnitCost}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Minimum Stock *</Text>
          <TextInput
            style={styles.input}
            value={form.minStock}
            onChangeText={form.setMinStock}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* ✅ NEW — Received Date, create mode only */}
      {mode === "create" && (
        <>
          <Text style={styles.label}>Received Date (optional, defaults to today)</Text>
          <TextInput
            style={styles.input}
            value={receivedDate}
            onChangeText={setReceivedDate}
            placeholder="YYYY-MM-DD"
          />
        </>
      )}

      <Text style={styles.label}>Expiry Date (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.expiryDate}
        onChangeText={form.setExpiryDate}
        placeholder="YYYY-MM-DD"
      />

      <Text style={styles.label}>Batch Number (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.batchNo}
        onChangeText={form.setBatchNo}
        placeholder="e.g. B-2026-0714"
      />

      <Text style={styles.label}>Storage Location (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.storageLocation}
        onChangeText={form.setStorageLocation}
        placeholder="e.g. Walk-in Freezer 1"
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
        <ScrollView style={styles.pickerList} nestedScrollEnabled>
          <TouchableOpacity
            style={styles.pickerItem}
            onPress={() => { form.setSupplierId(""); setShowSupplierPicker(false); }}
          >
            <Text style={styles.pickerItemText}>None</Text>
          </TouchableOpacity>
          {suppliers.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.pickerItem}
              onPress={() => { form.setSupplierId(s.id); setShowSupplierPicker(false); }}
            >
              <Text style={styles.pickerItemText}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.label}>SKU (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.sku}
        onChangeText={form.setSku}
        placeholder="e.g. SKU-00214"
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Barcode (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.barcode}
        onChangeText={form.setBarcode}
        placeholder="e.g. 8901030826501"
        keyboardType={Platform.OS === "web" ? "default" : "numbers-and-punctuation"}
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={form.notes}
        onChangeText={form.setNotes}
        placeholder="e.g. Keep refrigerated"
        multiline
        numberOfLines={3}
      />

      <View style={styles.switchRow}>
        <View style={styles.switchLabelGroup}>
          <Text style={styles.label}>Active</Text>
          <Text style={styles.switchHint}>
            Inactive items are hidden from pickers and forms but keep their history
          </Text>
        </View>
        <Switch value={form.isActive} onValueChange={form.setIsActive} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={form.submitting}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, form.submitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={form.submitting}
        >
          <Text style={styles.saveBtnText}>{form.submitting ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "800", color: "#1e293b", marginBottom: 12 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 8, marginBottom: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "600", flex: 1 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14, color: "#1e293b",
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
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
    marginTop: 4, maxHeight: 220, backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  pickerGroupLabel: {
    fontSize: 11, fontWeight: "800", color: "#94a3b8",
    paddingHorizontal: 12, paddingTop: 8, textTransform: "uppercase",
  },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 10 },
  pickerItemText: { fontSize: 14, color: "#1e293b" },
  warningBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#fffbeb", padding: 8, borderRadius: 6, marginBottom: 6,
  },
  warningText: { color: "#92400e", fontSize: 11, fontWeight: "600", flex: 1 },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#eff6ff", padding: 8, borderRadius: 6, marginBottom: 6,
  },
  infoText: { color: "#1e40af", fontSize: 11, fontWeight: "600", flex: 1 },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 16, paddingVertical: 8,
  },
  switchLabelGroup: { flex: 1, marginRight: 12 },
  switchHint: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 40 },
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
});