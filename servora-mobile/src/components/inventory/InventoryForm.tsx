// ============================================
// SERVORA ERP — InventoryForm Component
// ✅ Add/Edit form for InventoryItem — categoryId dropdown
//    (grouped by Department), unit dropdown, expiry date (text
//    input, YYYY-MM-DD — no native date-picker dependency yet),
//    batch/storage/supplier optional fields.
// ✅ Pure presentation + local form state — validation happens at
//    the repository layer (inventory-repository.ts); this form
//    does light client-side checks for immediate feedback only.
// ✅ Edit mode shows a "Manual correction only" warning above
//    Current Stock.
// ✅ FIX: Category/Unit/Supplier dropdown lists are now ScrollView
//    (not plain View) with nestedScrollEnabled — a plain View
//    ignores maxHeight for scrolling purposes, so a long list (60+
//    categories) pushed the rest of the form off-screen instead of
//    scrolling internally within its own bounded box.
// FROZEN
// ============================================

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  InventoryItem, InventoryUnit,
  CreateInventoryItemInput, UpdateInventoryItemInput,
} from "../../modules/inventory-module/types/inventory";
import { CategoryPickerGroup } from "../../modules/inventory-module/hooks/useCategoriesForPicker";
import { Supplier } from "../../modules/supplier-module/types/supplier";

const UNITS: InventoryUnit[] = ["kg", "g", "L", "ml", "pcs", "box", "bag", "bottle", "pac"];

interface InventoryFormProps {
  mode:            "create" | "edit";
  initial?:        InventoryItem;
  categoryGroups:  CategoryPickerGroup[];
  suppliers:       Supplier[];
  saving:          boolean;
  onSubmit:        (input: CreateInventoryItemInput | UpdateInventoryItemInput) => void;
  onCancel:        () => void;
}

export function InventoryForm({
  mode, initial, categoryGroups, suppliers, saving, onSubmit, onCancel,
}: InventoryFormProps) {
  const [itemName,        setItemName]        = useState(initial?.itemName ?? "");
  const [categoryId,      setCategoryId]       = useState(initial?.categoryId ?? "");
  const [currentStock,    setCurrentStock]     = useState(String(initial?.currentStock ?? "0"));
  const [unit,            setUnit]             = useState<InventoryUnit>(initial?.unit ?? "kg");
  const [unitCost,        setUnitCost]         = useState(String(initial?.unitCost ?? "0"));
  const [minStock,        setMinStock]         = useState(String(initial?.minStock ?? "0"));
  const [expiryDate,      setExpiryDate]       = useState(initial?.expiryDate ?? "");
  const [batchNo,         setBatchNo]          = useState(initial?.batchNo ?? "");
  const [storageLocation, setStorageLocation]  = useState(initial?.storageLocation ?? "");
  const [supplierId,      setSupplierId]       = useState(initial?.supplierId ?? "");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showUnitPicker,     setShowUnitPicker]     = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categoryGroups
    .flatMap((g) => g.categories)
    .find((c) => c.id === categoryId);
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const handleSubmit = () => {
    setError(null);

    if (!itemName.trim()) return setError("Item name is required");
    if (!categoryId) return setError("Category is required");

    const stockNum   = Number(currentStock);
    const costNum    = Number(unitCost);
    const minNum     = Number(minStock);

    if (Number.isNaN(stockNum) || stockNum < 0) return setError("Current stock must be a valid number");
    if (Number.isNaN(costNum) || costNum < 0)   return setError("Unit cost must be a valid number");
    if (Number.isNaN(minNum) || minNum < 0)     return setError("Minimum stock must be a valid number");

    onSubmit({
      itemName:        itemName.trim(),
      categoryId,
      currentStock:    stockNum,
      unit,
      unitCost:        costNum,
      minStock:        minNum,
      expiryDate:      expiryDate.trim() || undefined,
      batchNo:         batchNo.trim() || undefined,
      storageLocation: storageLocation.trim() || undefined,
      supplierId:      supplierId || undefined,
    });
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {mode === "create" ? "Add Inventory Item" : "Edit Inventory Item"}
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Item Name *</Text>
      <TextInput
        style={styles.input}
        value={itemName}
        onChangeText={setItemName}
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
                  onPress={() => { setCategoryId(cat.id); setShowCategoryPicker(false); }}
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
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <TextInput
            style={styles.input}
            value={currentStock}
            onChangeText={setCurrentStock}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Unit *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowUnitPicker((v) => !v)}
          >
            <Text style={styles.pickerButtonText}>{unit}</Text>
            <MaterialIcons name={showUnitPicker ? "expand-less" : "expand-more"} size={18} color="#64748b" />
          </TouchableOpacity>
          {showUnitPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={styles.pickerItem}
                  onPress={() => { setUnit(u); setShowUnitPicker(false); }}
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
            value={unitCost}
            onChangeText={setUnitCost}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Minimum Stock *</Text>
          <TextInput
            style={styles.input}
            value={minStock}
            onChangeText={setMinStock}
            keyboardType="numeric"
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

      <Text style={styles.label}>Batch Number (optional)</Text>
      <TextInput
        style={styles.input}
        value={batchNo}
        onChangeText={setBatchNo}
        placeholder="e.g. B-2026-0714"
      />

      <Text style={styles.label}>Storage Location (optional)</Text>
      <TextInput
        style={styles.input}
        value={storageLocation}
        onChangeText={setStorageLocation}
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
        </ScrollView>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
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