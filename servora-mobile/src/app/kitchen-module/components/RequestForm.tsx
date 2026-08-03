// ============================================
// SERVORA ERP — RequestForm Component
// ✅ The "New Request" form — moved from the old
//    kitchen-module/index.tsx's inline JSX (~262 lines), now wired
//    to useKitchenForm() (which itself composes useItemSearch())
//    instead of the screen owning ~15 separate useState calls.
// ✅ Same field-by-field behavior as the original: Category picker
//    narrows item search; picking a linked Inventory item locks
//    Closing Stock/Min Level/Unit to read-only Inventory values and
//    shows a Below-Minimum-Stock warning when relevant; free-text
//    entry is an explicit opt-in row, not the default; items list
//    groups by category; Send is disabled while empty/saving.
// ✅ Changing Category clears the currently typed/linked item (see
//    useItemSearch.ts's handleSetSelectedCategoryId) — the old item
//    almost certainly doesn't belong to the newly-picked category.
// ✅ Closing Stock/Min Level/Unit read-only displays show the
//    REAL picked Inventory item's values (itemSearch.pickedItem.*)
//    directly, not a form-level state that only gets synced after
//    "Add to List" is pressed.
// ============================================

import React from "react";
import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useKitchenForm } from "../hooks/useKitchenForm";
import { Category } from "../../../modules/inventory-module/types/category";
import UnitPickerModal from "./UnitPickerModal";
import CategoryPickerModal from "./CategoryPickerModal";

const isWeb = Platform.OS === "web";

interface Theme {
  card:          string;
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
  sidebarActive: string;
}

interface RequestFormProps {
  form:  ReturnType<typeof useKitchenForm>;
  theme: Theme;
  onSent: () => void;  // called after a successful send — the screen decides what happens next (e.g. switch to History tab)
}

// ✅ Cross-platform alert — matches the established real pattern
// (e.g. InventoryScreen.tsx) rather than plain Alert.alert(), which
// silently fails to render on react-native-web.
function showAlert(message: string) {
  if (isWeb) window.alert(message);
  else Alert.alert("Error", message);
}

export default function RequestForm({ form, theme, onSent }: RequestFormProps) {
  const { itemSearch } = form;
  const linked = !!itemSearch.pickedItem;

  const handleAddItem = () => {
    try {
      form.addItemToList();
    } catch (err: any) {
      showAlert(err?.message ?? "Failed to add item");
    }
  };

  const handleSend = async () => {
    try {
      const success = await form.handleSendRequest();
      if (success) onSent();
    } catch (err: any) {
      showAlert(err?.message ?? "Failed to send request");
    }
  };

  return (
    <View style={[styles.form, { backgroundColor: theme.card }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>
        📋 Ingredient Request Paper
      </Text>

      {/* Required Date */}
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>REQUIRED DATE</Text>
      <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <MaterialIcons name="event" size={16} color={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={form.requiredDate}
          onChangeText={form.setRequiredDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      {/* Add item row */}
      <View style={[styles.addItemBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <Text style={[styles.addItemTitle, { color: theme.text }]}>Add Item</Text>

        <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Category (optional — narrows item search)</Text>
        <TouchableOpacity
          style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 10 }]}
          onPress={() => itemSearch.setShowCategoryPicker(true)}
        >
          <Text style={[styles.selectorText, { color: theme.text }]}>
            {itemSearch.selectedCategoryId
              ? itemSearch.categories.find((c: Category) => c.id === itemSearch.selectedCategoryId)?.name ?? "Unknown"
              : "All Categories"}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialIcons name="search" size={14} color={theme.textSecondary} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={itemSearch.selectedCategoryId ? "Search this category's items..." : "Search Inventory items..."}
            placeholderTextColor={theme.textSecondary}
            value={itemSearch.itemName}
            onChangeText={itemSearch.setItemName}
            onFocus={() => itemSearch.setShowItemPicker(true)}
          />
        </View>
        {linked && (
          <View style={styles.linkedBadge}>
            <MaterialIcons name="link" size={12} color="#059669" />
            <Text style={styles.linkedBadgeText}>Linked to Inventory</Text>
          </View>
        )}
        {itemSearch.showItemPicker && itemSearch.itemMatches.length > 0 && (
          <ScrollView style={[styles.itemPickerList, { backgroundColor: theme.surface, borderColor: theme.border }]} nestedScrollEnabled>
            {itemSearch.itemMatches.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={styles.itemPickerRow}
                onPress={() => itemSearch.selectItem(it)}
              >
                <Text style={[styles.itemPickerRowText, { color: theme.text }]}>{it.itemName}</Text>
                <Text style={[styles.itemPickerRowSub, { color: theme.textSecondary }]}>
                  {it.currentStock} {it.unit} in stock
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {itemSearch.showItemPicker && !linked && itemSearch.debouncedItemName.trim().length >= 2 && itemSearch.itemMatches.length === 0 && (
          <TouchableOpacity
            style={[styles.newItemRow, { borderColor: theme.border }]}
            onPress={() => itemSearch.setShowItemPicker(false)}
          >
            <MaterialIcons name="add-circle-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.newItemRowText, { color: theme.textSecondary }]}>
              No match — add "{itemSearch.itemName.trim()}" as a new item
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.row3}>
          <View style={styles.thirdField}>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Closing Stock</Text>
            {linked ? (
              <View style={[styles.miniInput, styles.miniInputReadOnly, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.readOnlyValueText, { color: theme.text }]}>{itemSearch.pickedItem?.currentStock}</Text>
              </View>
            ) : (
              <TextInput
                style={[styles.miniInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={form.closingStock}
                onChangeText={form.setClosingStock}
              />
            )}
          </View>
          <View style={styles.thirdField}>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Min Level</Text>
            {linked ? (
              <View style={[styles.miniInput, styles.miniInputReadOnly, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.readOnlyValueText, { color: theme.text }]}>{itemSearch.pickedItem?.minStock}</Text>
              </View>
            ) : (
              <TextInput
                style={[styles.miniInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={form.minimumLevel}
                onChangeText={form.setMinimumLevel}
              />
            )}
          </View>
          <View style={styles.thirdField}>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Order Qty</Text>
            <TextInput
              style={[styles.miniInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={form.orderQuantity}
              onChangeText={form.setOrderQuantity}
            />
          </View>
        </View>

        {linked && itemSearch.pickedItem && itemSearch.pickedItem.currentStock < itemSearch.pickedItem.minStock && (
          <View style={styles.belowMinWarning}>
            <MaterialIcons name="warning" size={13} color="#dc2626" />
            <Text style={styles.belowMinWarningText}>Below Minimum Stock</Text>
          </View>
        )}

        <Text style={[styles.miniLabel, { color: theme.textSecondary, marginTop: 4 }]}>Unit</Text>
        {linked ? (
          <View style={[styles.selector, styles.selectorReadOnly, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.selectorText, { color: theme.text }]}>{itemSearch.pickedItem?.unit}</Text>
            <Text style={[styles.readOnlyTag, { color: theme.textSecondary }]}>from Inventory</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => form.setShowUnitPicker(true)}
          >
            <Text style={[styles.selectorText, { color: theme.text }]}>{form.unit}</Text>
            <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.addItemBtn, { backgroundColor: theme.primary },
            (!itemSearch.itemName.trim() || !form.orderQuantity) && { opacity: 0.5 },
          ]}
          onPress={handleAddItem}
          disabled={!itemSearch.itemName.trim() || !form.orderQuantity}
        >
          <MaterialIcons name="add" size={16} color="#fff" />
          <Text style={styles.addItemBtnText}>Add to List</Text>
        </TouchableOpacity>
      </View>

      {/* Items list — grouped by category */}
      {form.requestItems.length > 0 && (
        <View style={[styles.itemsTable, { backgroundColor: theme.bg }]}>
          <View style={[styles.itemsTableHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.itemsHeaderText, { flex: 2 }]}>ITEM</Text>
            <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>STOCK</Text>
            <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>ORDER</Text>
            <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>UNIT</Text>
            <Text style={[styles.itemsHeaderText, { flex: 0.5, textAlign: "center" }]}>DEL</Text>
          </View>
          {(() => {
            const categoryMap = new Map(itemSearch.categories.map((c: Category) => [c.id, c.name]));
            const grouped = new Map<string, { name: string; entries: { item: typeof form.requestItems[number]; idx: number }[] }>();
            form.requestItems.forEach((item, idx) => {
              const key  = item.categoryId ?? "uncategorized";
              const name = item.categoryId ? (categoryMap.get(item.categoryId) ?? "Unknown") : "Uncategorized";
              if (!grouped.has(key)) grouped.set(key, { name, entries: [] });
              grouped.get(key)!.entries.push({ item, idx });
            });
            return Array.from(grouped.values()).map((group) => (
              <View key={group.name}>
                <View style={[styles.categoryGroupHeader, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                  <Text style={[styles.categoryGroupHeaderText, { color: theme.textSecondary }]}>
                    {group.name}
                  </Text>
                </View>
                {group.entries.map(({ item, idx }) => (
                  <View key={idx} style={[styles.itemsRow, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.itemsCell, { flex: 2, color: theme.text }]}>{item.itemName}</Text>
                    <Text style={[styles.itemsCell, { flex: 1, textAlign: "center", color: theme.textSecondary }]}>{item.closingStock || "-"}</Text>
                    <Text style={[styles.itemsCell, { flex: 1, textAlign: "center", color: "#10b981", fontWeight: "700" }]}>{item.orderQuantity}</Text>
                    <Text style={[styles.itemsCell, { flex: 1, textAlign: "center", color: theme.textSecondary }]}>{item.unit}</Text>
                    <TouchableOpacity style={{ flex: 0.5, alignItems: "center" }} onPress={() => form.removeItem(idx)}>
                      <MaterialIcons name="delete" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ));
          })()}
        </View>
      )}

      {/* Note */}
      <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 10 }]}>NOTE</Text>
      <TextInput
        style={[styles.noteInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
        placeholder="Additional notes..."
        placeholderTextColor={theme.textSecondary}
        value={form.note}
        onChangeText={form.setNote}
        multiline
      />

      {/* Send button */}
      <TouchableOpacity
        style={[styles.sendBtn, { backgroundColor: "#10b981" }, (form.saving || form.requestItems.length === 0) && { opacity: 0.5 }]}
        onPress={handleSend}
        disabled={form.saving || form.requestItems.length === 0}
      >
        {form.saving ? <ActivityIndicator color="#fff" size="small" /> : (
          <>
            <MaterialIcons name="send" size={18} color="#fff" />
            <Text style={styles.sendBtnText}>
              SEND REQUEST ({form.requestItems.length} items)
            </Text>
          </>
        )}
      </TouchableOpacity>

      <UnitPickerModal
        visible={form.showUnitPicker}
        unit={form.unit}
        onSelect={(u) => { form.setUnit(u); form.setShowUnitPicker(false); }}
        onClose={() => form.setShowUnitPicker(false)}
        theme={theme}
      />
      <CategoryPickerModal
        visible={itemSearch.showCategoryPicker}
        categories={itemSearch.categories}
        selectedCategoryId={itemSearch.selectedCategoryId}
        onSelect={(id) => { itemSearch.setSelectedCategoryId(id); itemSearch.setShowCategoryPicker(false); }}
        onClose={() => itemSearch.setShowCategoryPicker(false)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { borderRadius: 16, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },
  addItemBox: { borderRadius: 12, borderWidth: 1.5, padding: 12, marginBottom: 12 },
  addItemTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  linkedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 4, marginBottom: 4, alignSelf: "flex-start",
  },
  linkedBadgeText: { fontSize: 11, color: "#059669", fontWeight: "700" },
  itemPickerList: {
    borderWidth: 1, borderRadius: 8,
    marginBottom: 8, maxHeight: 220, overflow: "hidden",
  },
  itemPickerRow: { paddingHorizontal: 12, paddingVertical: 10 },
  itemPickerRowText: { fontSize: 14, fontWeight: "600" },
  itemPickerRowSub: { fontSize: 11, marginTop: 2 },
  newItemRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderStyle: "dashed", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
  },
  newItemRowText: { fontSize: 12, fontStyle: "italic", flex: 1 },
  row3: { flexDirection: "row", gap: 8, marginBottom: 8 },
  thirdField: { flex: 1 },
  miniLabel: { fontSize: 9, fontWeight: "700", marginBottom: 4 },
  miniInput: {
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 8,
    fontSize: 13,
  },
  miniInputReadOnly: { justifyContent: "center" },
  readOnlyValueText: { fontSize: 13, fontWeight: "700" },
  belowMinWarning: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginBottom: 8,
  },
  belowMinWarningText: { fontSize: 11, fontWeight: "700", color: "#dc2626" },
  selector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  selectorReadOnly: {},
  readOnlyTag: { fontSize: 10, fontStyle: "italic" },
  selectorText: { fontSize: 13, fontWeight: "600" },
  addItemBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 10, borderRadius: 8,
  },
  addItemBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  itemsTable: { borderRadius: 8, overflow: "hidden", marginBottom: 10 },
  itemsTableHeader: {
    flexDirection: "row", padding: 8, borderBottomWidth: 1,
    backgroundColor: "#00154f",
  },
  itemsHeaderText: { color: "#FFD700", fontSize: 9, fontWeight: "800" },
  categoryGroupHeader: {
    paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 0.5,
  },
  categoryGroupHeaderText: {
    fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5,
  },
  itemsRow: { flexDirection: "row", alignItems: "center", padding: 8, borderBottomWidth: 0.5 },
  itemsCell: { fontSize: 12 },
  noteInput: {
    borderWidth: 1.5, borderRadius: 10, padding: 10,
    fontSize: 13, height: 60, textAlignVertical: "top", marginBottom: 12,
  },
  sendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, borderRadius: 12,
  },
  sendBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});