// ============================================
// SERVORA ERP — InventoryForm Component
// ✅ MAJOR REDESIGN — Supplier → Category → Search Existing Item →
//    (Existing Item OR Create New Item) → Batch Details → Submit.
// ✅ isCreatingNew — explicit UI state, purely presentational. The
//    real submit-path decision (existingItem vs newItem) is made
//    entirely by useInventoryForm.ts based on selectedExistingItem's
//    presence/absence — this component never bypasses that.
// ✅ searchQuery (from useExistingItemSearch) is fully separate from
//    form.itemName — search input never conflated with the eventual
//    new-item name.
// ✅ FIX — "Change" (existing item) now clears searchQuery too, so a
//    fresh search always starts empty rather than carrying over
//    whatever was typed before the item was selected.
// ✅ FIX — "Create New Item" is disabled (and relabeled to prompt for
//    input) when searchQuery is empty — prevents accidentally
//    activating new-item mode with a blank name that would only
//    surface as a late "Item name is required" validation error.
// ✅ FIX — explicit "New Item:" label added next to the editable name
//    field in new-item mode, so it's visually unambiguous from the
//    search box (same field position, different mode).
// ✅ Category change resets ALL of: selectedExistingItem,
//    isCreatingNew, searchQuery, showItemSearch — no carry-over
//    between categories.
// ✅ Supplier at the TOP of the form — represents THIS BATCH's
//    supplier. "+ New Supplier" navigates to Supplier module's own
//    creation UI (onAddSupplier prop) — never duplicated here.
// ✅ Field label adapts by mode: "Current Stock" (newItem) vs
//    "Quantity" (existingItem) — same underlying form state.
// ✅ Received Date is a plain YYYY-MM-DD text field (calendar picker
//    deliberately DEFERRED to a separate DatePickerField.tsx task).
// ✅ Edit mode is COMPLETELY UNCHANGED.
// ✅ Minimum Stock field only shown for "newItem" mode.
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
} from "../types/inventory";
import { CategoryPickerGroup } from "../hooks/useCategoriesForPicker";
import { useInventoryForm, InventoryFormSubmitPayload } from "../hooks/useInventoryForm";
import { useExistingItemSearch } from "../hooks/useExistingItemSearch";
import { Supplier } from "../../supplier-module/types/supplier";

const UNITS: InventoryUnit[] = ["kg", "g", "L", "ml", "pcs", "box", "bag", "bottle", "pac"];

interface InventoryFormProps {
  mode:            "create" | "edit";
  initial?:        InventoryItem;
  categoryGroups:  CategoryPickerGroup[];
  suppliers:       Supplier[];
  allItems:        InventoryItem[];
  onSubmit:        (payload: InventoryFormSubmitPayload) => void | Promise<void>;
  onCancel:        () => void;
  onAddSupplier:   () => void;
}

export function InventoryForm({
  mode, initial, categoryGroups, suppliers, allItems, onSubmit, onCancel, onAddSupplier,
}: InventoryFormProps) {
  const form = useInventoryForm(mode, initial);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showUnitPicker,     setShowUnitPicker]     = useState(false);
  const [showItemSearch,     setShowItemSearch]     = useState(false);
  const [isCreatingNew,      setIsCreatingNew]      = useState(false);

  const isCreateMode = mode === "create";
  const isExistingItemMode = isCreateMode && !!form.selectedExistingItem;

  const { searchQuery, setSearchQuery, matches } = useExistingItemSearch(allItems, form.categoryId || null);

  const selectedCategory = categoryGroups
    .flatMap((g) => g.categories)
    .find((c) => c.id === form.categoryId);
  const selectedSupplier = suppliers.find((s) => s.id === form.supplierId);

  const handleSave = () => {
    form.handleSubmit((payload) => onSubmit(payload));
  };

  const resetItemSelection = () => {
    form.setSelectedExistingItem(undefined);
    setIsCreatingNew(false);
    setSearchQuery("");
    setShowItemSearch(false);
  };

  if (mode === "edit") {
    return (
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit Inventory Item</Text>

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
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker((v) => !v)}>
          <Text style={styles.pickerButtonText}>
            {selectedCategory ? `${selectedCategory.icon ?? ""} ${selectedCategory.name}` : "Select a category"}
          </Text>
          <MaterialIcons name={showCategoryPicker ? "expand-less" : "expand-more"} size={20} color="#64748b" />
        </TouchableOpacity>
        {showCategoryPicker && (
          <ScrollView style={styles.pickerList} nestedScrollEnabled>
            {categoryGroups.map((group) => (
              <View key={group.department?.id ?? "none"}>
                {group.department && (
                  <Text style={styles.pickerGroupLabel}>{group.department.icon} {group.department.name}</Text>
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

        <Text style={styles.label}>Current Stock *</Text>
        <View style={styles.warningBox}>
          <MaterialIcons name="warning" size={14} color="#d97706" />
          <Text style={styles.warningText}>
            Manual correction only — for receiving, issuing, or waste, use Stock Movement instead
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextInput style={styles.input} value={form.currentStock} onChangeText={form.setCurrentStock} keyboardType="numeric" />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Unit *</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowUnitPicker((v) => !v)}>
              <Text style={styles.pickerButtonText}>{form.unit}</Text>
              <MaterialIcons name={showUnitPicker ? "expand-less" : "expand-more"} size={18} color="#64748b" />
            </TouchableOpacity>
            {showUnitPicker && (
              <ScrollView style={styles.pickerList} nestedScrollEnabled>
                {UNITS.map((u) => (
                  <TouchableOpacity key={u} style={styles.pickerItem} onPress={() => { form.setUnit(u); setShowUnitPicker(false); }}>
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
            <TextInput style={styles.input} value={form.unitCost} onChangeText={form.setUnitCost} keyboardType="numeric" />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Minimum Stock *</Text>
            <TextInput style={styles.input} value={form.minStock} onChangeText={form.setMinStock} keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>Storage Location (optional)</Text>
        <TextInput style={styles.input} value={form.storageLocation} onChangeText={form.setStorageLocation} placeholder="e.g. Walk-in Freezer 1" />

        <Text style={styles.label}>Supplier (optional)</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowSupplierPicker((v) => !v)}>
          <Text style={styles.pickerButtonText}>{selectedSupplier ? selectedSupplier.name : "None"}</Text>
          <MaterialIcons name={showSupplierPicker ? "expand-less" : "expand-more"} size={20} color="#64748b" />
        </TouchableOpacity>
        {showSupplierPicker && (
          <ScrollView style={styles.pickerList} nestedScrollEnabled>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { form.setSupplierId(""); setShowSupplierPicker(false); }}>
              <Text style={styles.pickerItemText}>None</Text>
            </TouchableOpacity>
            {suppliers.map((s) => (
              <TouchableOpacity key={s.id} style={styles.pickerItem} onPress={() => { form.setSupplierId(s.id); setShowSupplierPicker(false); }}>
                <Text style={styles.pickerItemText}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={styles.label}>SKU (optional)</Text>
        <TextInput style={styles.input} value={form.sku} onChangeText={form.setSku} placeholder="e.g. SKU-00214" autoCapitalize="characters" />

        <Text style={styles.label}>Barcode (optional)</Text>
        <TextInput
          style={styles.input} value={form.barcode} onChangeText={form.setBarcode} placeholder="e.g. 8901030826501"
          keyboardType={Platform.OS === "web" ? "default" : "numbers-and-punctuation"}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput style={[styles.input, styles.notesInput]} value={form.notes} onChangeText={form.setNotes} placeholder="e.g. Keep refrigerated" multiline numberOfLines={3} />

        <View style={styles.switchRow}>
          <View style={styles.switchLabelGroup}>
            <Text style={styles.label}>Active</Text>
            <Text style={styles.switchHint}>Inactive items are hidden from pickers and forms but keep their history</Text>
          </View>
          <Switch value={form.isActive} onValueChange={form.setIsActive} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={form.submitting}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, form.submitting && { opacity: 0.6 }]} onPress={handleSave} disabled={form.submitting}>
            <Text style={styles.saveBtnText}>{form.submitting ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add Inventory Item</Text>

      {form.error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{form.error}</Text>
        </View>
      )}

      <Text style={styles.label}>Supplier</Text>
      <View style={styles.row}>
        <View style={[styles.rowItem, { flex: 2 }]}>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowSupplierPicker((v) => !v)}>
            <Text style={styles.pickerButtonText}>{selectedSupplier ? selectedSupplier.name : "Select a supplier"}</Text>
            <MaterialIcons name={showSupplierPicker ? "expand-less" : "expand-more"} size={20} color="#64748b" />
          </TouchableOpacity>
          {showSupplierPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              <TouchableOpacity style={styles.pickerItem} onPress={() => { form.setSupplierId(""); setShowSupplierPicker(false); }}>
                <Text style={styles.pickerItemText}>None</Text>
              </TouchableOpacity>
              {suppliers.map((s) => (
                <TouchableOpacity key={s.id} style={styles.pickerItem} onPress={() => { form.setSupplierId(s.id); setShowSupplierPicker(false); }}>
                  <Text style={styles.pickerItemText}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        <TouchableOpacity style={styles.newSupplierBtn} onPress={onAddSupplier}>
          <MaterialIcons name="add" size={16} color="#0369a1" />
          <Text style={styles.newSupplierBtnText}>New Supplier</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Category *</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowCategoryPicker((v) => !v)}
      >
        <Text style={styles.pickerButtonText}>
          {selectedCategory ? `${selectedCategory.icon ?? ""} ${selectedCategory.name}` : "Select a category"}
        </Text>
        <MaterialIcons name={showCategoryPicker ? "expand-less" : "expand-more"} size={20} color="#64748b" />
      </TouchableOpacity>
      {showCategoryPicker && (
        <ScrollView style={styles.pickerList} nestedScrollEnabled>
          {categoryGroups.map((group) => (
            <View key={group.department?.id ?? "none"}>
              {group.department && (
                <Text style={styles.pickerGroupLabel}>{group.department.icon} {group.department.name}</Text>
              )}
              {group.categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.pickerItem}
                  onPress={() => {
                    form.setCategoryId(cat.id);
                    setShowCategoryPicker(false);
                    resetItemSelection();
                  }}
                >
                  <Text style={styles.pickerItemText}>{cat.icon} {cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {form.categoryId && (
        <>
          <Text style={styles.label}>Item *</Text>
          {form.selectedExistingItem ? (
            <View style={styles.selectedItemRow}>
              <View style={styles.selectedItemBadge}>
                <MaterialIcons name="check-circle" size={16} color="#059669" />
                <Text style={styles.selectedItemText}>{form.selectedExistingItem.itemName}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                form.setSelectedExistingItem(undefined);
                setIsCreatingNew(false);
                setSearchQuery("");
                setShowItemSearch(true);
              }}>
                <Text style={styles.changeItemText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : isCreatingNew ? (
            <View style={styles.newItemRow}>
              <View style={styles.newItemBadge}>
                <MaterialIcons name="add-circle" size={16} color="#0369a1" />
                <Text style={styles.newItemLabel}>New Item:</Text>
                <TextInput
                  style={[styles.input, styles.newItemInput]}
                  value={form.itemName}
                  onChangeText={form.setItemName}
                  placeholder="Item name..."
                  autoFocus
                />
              </View>
              <TouchableOpacity onPress={() => {
                setIsCreatingNew(false);
                form.setItemName("");
                setSearchQuery("");
                setShowItemSearch(true);
              }}>
                <Text style={styles.changeItemText}>Search Instead</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.pickerButton}>
                <MaterialIcons name="search" size={16} color="#64748b" />
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingVertical: 0 }]}
                  value={searchQuery}
                  onChangeText={(v) => { setSearchQuery(v); setShowItemSearch(true); }}
                  placeholder="Search existing item..."
                  onFocus={() => setShowItemSearch(true)}
                />
              </View>
              {showItemSearch && (
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {matches.map((it) => (
                    <TouchableOpacity
                      key={it.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        form.setSelectedExistingItem(it);
                        setIsCreatingNew(false);
                        setShowItemSearch(false);
                        setSearchQuery("");
                      }}
                    >
                      <Text style={styles.pickerItemText}>{it.itemName}</Text>
                      <Text style={styles.pickerItemSub}>{it.currentStock} {it.unit} in stock</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.pickerItem, styles.createNewItem, !searchQuery.trim() && { opacity: 0.4 }]}
                    disabled={!searchQuery.trim()}
                    onPress={() => {
                      form.setSelectedExistingItem(undefined);
                      form.setItemName(searchQuery.trim());
                      setIsCreatingNew(true);
                      setShowItemSearch(false);
                    }}
                  >
                    <MaterialIcons name="add-circle-outline" size={16} color="#0369a1" />
                    <Text style={styles.createNewItemText}>
                      {searchQuery.trim() ? `+ Create New Item "${searchQuery.trim()}"` : "Type a name to create new item"}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </>
          )}
        </>
      )}

      <Text style={styles.label}>{isExistingItemMode ? "Quantity *" : "Current Stock *"}</Text>
      {!isExistingItemMode && (
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={14} color="#0369a1" />
          <Text style={styles.infoText}>Entering a starting quantity here creates the item's first batch automatically.</Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <TextInput style={styles.input} value={form.currentStock} onChangeText={form.setCurrentStock} keyboardType="numeric" />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Unit *</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => !isExistingItemMode && setShowUnitPicker((v) => !v)}>
            <Text style={styles.pickerButtonText}>{form.unit}</Text>
            {!isExistingItemMode && (
              <MaterialIcons name={showUnitPicker ? "expand-less" : "expand-more"} size={18} color="#64748b" />
            )}
          </TouchableOpacity>
          {!isExistingItemMode && showUnitPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {UNITS.map((u) => (
                <TouchableOpacity key={u} style={styles.pickerItem} onPress={() => { form.setUnit(u); setShowUnitPicker(false); }}>
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
          <TextInput style={styles.input} value={form.unitCost} onChangeText={form.setUnitCost} keyboardType="numeric" />
        </View>
        {!isExistingItemMode && (
          <View style={styles.rowItem}>
            <Text style={styles.label}>Minimum Stock *</Text>
            <TextInput style={styles.input} value={form.minStock} onChangeText={form.setMinStock} keyboardType="numeric" />
          </View>
        )}
      </View>

      <Text style={styles.label}>Received Date (optional, defaults to today)</Text>
      <TextInput style={styles.input} value={form.receivedDate} onChangeText={form.setReceivedDate} placeholder="YYYY-MM-DD" />

      <Text style={styles.label}>Expiry Date (optional)</Text>
      <TextInput style={styles.input} value={form.expiryDate} onChangeText={form.setExpiryDate} placeholder="YYYY-MM-DD" />

      <Text style={styles.label}>Batch Number *</Text>
      <TextInput style={styles.input} value={form.batchNo} onChangeText={form.setBatchNo} placeholder="e.g. B-2026-0714" />

      {!isExistingItemMode && (
        <>
          <Text style={styles.label}>Storage Location (optional)</Text>
          <TextInput style={styles.input} value={form.storageLocation} onChangeText={form.setStorageLocation} placeholder="e.g. Walk-in Freezer 1" />

          <Text style={styles.label}>SKU (optional)</Text>
          <TextInput style={styles.input} value={form.sku} onChangeText={form.setSku} placeholder="e.g. SKU-00214" autoCapitalize="characters" />

          <Text style={styles.label}>Barcode (optional)</Text>
          <TextInput
            style={styles.input} value={form.barcode} onChangeText={form.setBarcode} placeholder="e.g. 8901030826501"
            keyboardType={Platform.OS === "web" ? "default" : "numbers-and-punctuation"}
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput style={[styles.input, styles.notesInput]} value={form.notes} onChangeText={form.setNotes} placeholder="e.g. Keep refrigerated" multiline numberOfLines={3} />
        </>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={form.submitting}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, form.submitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={form.submitting}
        >
          <Text style={styles.saveBtnText}>{form.submitting ? "Saving..." : isExistingItemMode ? "Receive Batch" : "Save"}</Text>
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
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  rowItem: { flex: 1 },
  pickerButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, gap: 6,
  },
  pickerButtonText: { fontSize: 14, color: "#1e293b", flex: 1 },
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
  pickerItemSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  createNewItem: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  createNewItemText: { fontSize: 13, color: "#0369a1", fontWeight: "700" },
  selectedItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectedItemBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ecfdf5", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, flex: 1,
  },
  selectedItemText: { fontSize: 14, fontWeight: "700", color: "#065f46" },
  changeItemText: { color: "#0369a1", fontSize: 13, fontWeight: "700", marginLeft: 10 },
  newItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  newItemBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#eff6ff", paddingHorizontal: 10, borderRadius: 8, flex: 1,
  },
  newItemLabel: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
  newItemInput: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 10 },
  newSupplierBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#0369a1", borderRadius: 8,
    paddingHorizontal: 10, justifyContent: "center",
  },
  newSupplierBtnText: { color: "#0369a1", fontSize: 12, fontWeight: "700" },
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