// ============================================
// SERVORA ERP — PurchaseOrderForm Screen
// ✅ Phase 8.2b — Create-only (order stage). Deliberately has NO
//    receivedQty/lotNumber/expiryDate inputs — those don't exist
//    yet at order time and belong to the separate Receive Goods
//    step (Phase 8.2c).
// ✅ Supplier picker + item-name search both reuse the confirmed-
//    working ScrollView + nestedScrollEnabled pattern from
//    InventoryForm.tsx (plain View silently ignores maxHeight for
//    scrolling, which previously pushed the rest of the form
//    off-screen — this fix is already verified in production).
// ✅ Item name field is BOTH a free-text input and a live search —
//    typing filters existing Inventory items into a dropdown below;
//    picking one sets itemId (auto-link for future stock-in),
//    but the user can also just keep typing and submit free-text
//    for a brand-new item not yet in Inventory.
// ✅ Per-row and grand total are LIVE PREVIEWS only, computed here
//    from the same inputs the repository will use — the saved
//    lineTotal/totalAmount always come from the server (FROZEN
//    contract in purchase-order-repository.ts), never from this
//    preview math.
// PHASE 8.2b
// ============================================

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { usePurchaseOrderForm, DraftPOItem } from "../hooks/usePurchaseOrderForm";
import { useSuppliers } from "../../supplier-module/hooks/useSuppliers";
import { useInventory } from "../../inventory-module/hooks/useInventory";
import { InventoryItem, InventoryUnit } from "../../inventory-module/types/inventory";
import { Supplier } from "../../supplier-module/types/supplier";

// ✅ Typed as InventoryUnit[] (not string[]) — these are exactly
// the values Inventory itself allows, so the two can never drift
// apart into "kg" vs "Kg" vs "KG" duplicates.
const UNITS: InventoryUnit[] = ["kg", "g", "L", "ml", "pcs", "box", "bag", "bottle", "pac"];

interface PurchaseOrderFormProps {
  onSaved:  () => void;
  onCancel: () => void;
}

export default function PurchaseOrderForm({ onSaved, onCancel }: PurchaseOrderFormProps) {
  const { restaurantId, fmt } = useApp();
  const { suppliers, loading: suppliersLoading } = useSuppliers(restaurantId);
  const { items: inventoryItems, loading: inventoryLoading } = useInventory(restaurantId);

  const {
    supplierId, setSupplierId,
    expectedDeliveryDate, setExpectedDeliveryDate,
    items, addItemRow, removeItemRow, updateItemRow,
    previewTotal,
    saving, error,
    submit,
  } = usePurchaseOrderForm();

  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [openItemPickerRowId, setOpenItemPickerRowId] = useState<string | null>(null);

  const selectedSupplier = suppliers.find((s: Supplier) => s.id === supplierId);

  const handleSave = async () => {
    if (!restaurantId) return;
    const ok = await submit(restaurantId);
    if (ok) onSaved();
  };

  const loading = suppliersLoading || inventoryLoading;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New Purchase Order</Text>

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0369a1" style={{ marginTop: 30 }} />
      ) : (
        <>
          {/* ── Supplier ── */}
          <Text style={styles.label}>Supplier *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowSupplierPicker((v: boolean) => !v)}
          >
            <Text style={styles.pickerButtonText}>
              {selectedSupplier ? selectedSupplier.name : "Select a supplier"}
            </Text>
            <MaterialIcons
              name={showSupplierPicker ? "expand-less" : "expand-more"}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
          {showSupplierPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {suppliers.length === 0 && (
                <Text style={styles.pickerEmptyText}>No suppliers yet</Text>
              )}
              {suppliers.map((s: Supplier) => (
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

          {/* ── Expected Delivery Date ── */}
          <Text style={styles.label}>Expected Delivery Date (optional)</Text>
          <TextInput
            style={styles.input}
            value={expectedDeliveryDate}
            onChangeText={setExpectedDeliveryDate}
            placeholder="YYYY-MM-DD"
          />

          {/* ── Items ── */}
          <View style={styles.itemsHeader}>
            <Text style={styles.label}>Items *</Text>
            <TouchableOpacity style={styles.addRowBtn} onPress={addItemRow}>
              <MaterialIcons name="add" size={16} color="#0369a1" />
              <Text style={styles.addRowBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((row: DraftPOItem, idx: number) => (
            <ItemRow
              key={row.rowId}
              row={row}
              index={idx}
              canRemove={items.length > 1}
              inventoryItems={inventoryItems}
              isPickerOpen={openItemPickerRowId === row.rowId}
              onTogglePicker={() =>
                setOpenItemPickerRowId((cur: string | null) =>
                  cur === row.rowId ? null : row.rowId
                )
              }
              onChange={(patch: Partial<DraftPOItem>) => updateItemRow(row.rowId, patch)}
              onRemove={() => removeItemRow(row.rowId)}
              fmt={fmt}
            />
          ))}

          {/* ── Total Preview ── */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>{fmt(previewTotal)}</Text>
          </View>

          {/* ── Actions ── */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save as Draft"}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── Single item row — its own component so the Inventory-search
// filtering (recomputed on every keystroke) only re-renders this
// row, not the whole form. NOTE: "key" is intentionally NOT part
// of this props interface — React reserves "key" and strips it
// before props reach the component, so declaring it here would be
// misleading (it would never actually be readable as props.key). ──
interface ItemRowProps {
  row:            DraftPOItem;
  index:          number;
  canRemove:      boolean;
  inventoryItems: InventoryItem[];
  isPickerOpen:   boolean;
  onTogglePicker: () => void;
  onChange:       (patch: Partial<DraftPOItem>) => void;
  onRemove:       () => void;
  fmt:            (n: number) => string;
}

function ItemRow({
  row, index, canRemove, inventoryItems,
  isPickerOpen, onTogglePicker, onChange, onRemove, fmt,
}: ItemRowProps) {
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // ✅ Debounced search (300ms, same pattern as EmployeeSearch.tsx)
  // — the text INPUT stays instant (row.itemName updates on every
  // keystroke via onChange), only the Inventory filter itself waits
  // for a pause in typing. Matters once Inventory has thousands of
  // items — filtering on every keystroke would lag; filtering only
  // after the user pauses does not.
  const [debouncedQuery, setDebouncedQuery] = useState(row.itemName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(row.itemName);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [row.itemName]);

  const matches = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    // ✅ 2-character minimum — a single letter ("s") can match
    // hundreds of items in a large Inventory; waiting for 2
    // characters cuts the match set down before the list even
    // renders, on top of the debounce above.
    if (q.length < 2) return [];
    return inventoryItems
      .filter((it) => it.itemName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [debouncedQuery, inventoryItems]);

  const lineTotal = useMemo(() => {
    const qty  = Number(row.quantity);
    const cost = Number(row.unitCost);
    if (!Number.isFinite(qty) || !Number.isFinite(cost)) return 0;
    return qty * cost;
  }, [row.quantity, row.unitCost]);

  const pickMatch = useCallback((item: InventoryItem) => {
    onChange({ itemId: item.id, itemName: item.itemName, unit: item.unit });
    onTogglePicker();
  }, [onChange, onTogglePicker]);

  return (
    <View style={styles.itemRowBox}>
      <View style={styles.itemRowHeader}>
        <Text style={styles.itemRowIndex}>#{index + 1}</Text>
        {canRemove && (
          <TouchableOpacity onPress={onRemove}>
            <MaterialIcons name="close" size={18} color="#dc2626" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.smallLabel}>Item Name *</Text>
      <TextInput
        style={styles.input}
        value={row.itemName}
        onChangeText={(text) => {
          // ✅ Typing after a previous pick clears itemId — the
          // user is now describing something else, so the old
          // link would silently mismatch the new name.
          onChange({ itemName: text, itemId: undefined });
          if (!isPickerOpen) onTogglePicker();
        }}
        onFocus={() => { if (!isPickerOpen) onTogglePicker(); }}
        placeholder="e.g. Salmon, or search existing item..."
      />
      {row.itemId && (
        <View style={styles.linkedBadge}>
          <MaterialIcons name="link" size={12} color="#059669" />
          <Text style={styles.linkedBadgeText}>Linked to Inventory</Text>
        </View>
      )}
      {isPickerOpen && matches.length > 0 && (
        <ScrollView style={styles.pickerList} nestedScrollEnabled>
          {matches.map((it) => (
            <TouchableOpacity
              key={it.id}
              style={styles.pickerItem}
              onPress={() => pickMatch(it)}
            >
              <Text style={styles.pickerItemText}>{it.itemName}</Text>
              <Text style={styles.pickerItemSubtext}>
                {it.currentStock} {it.unit} in stock
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.smallLabel}>Quantity *</Text>
          <TextInput
            style={styles.input}
            value={row.quantity}
            onChangeText={(text) => onChange({ quantity: text })}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.smallLabel}>Unit</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowUnitPicker((v) => !v)}
          >
            <Text style={styles.pickerButtonText}>{row.unit}</Text>
            <MaterialIcons
              name={showUnitPicker ? "expand-less" : "expand-more"}
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>
          {showUnitPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={styles.pickerItem}
                  onPress={() => { onChange({ unit: u }); setShowUnitPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <Text style={styles.smallLabel}>Unit Cost *</Text>
      <TextInput
        style={styles.input}
        value={row.unitCost}
        onChangeText={(text) => onChange({ unitCost: text })}
        keyboardType="numeric"
        placeholder="0.00"
      />

      <View style={styles.lineTotalRow}>
        <Text style={styles.lineTotalLabel}>Line Total</Text>
        <Text style={styles.lineTotalValue}>{fmt(lineTotal)}</Text>
      </View>
    </View>
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
  smallLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", marginTop: 8, marginBottom: 4 },
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
    marginTop: 4, maxHeight: 180, backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  pickerEmptyText: { padding: 12, fontSize: 13, color: "#94a3b8", fontStyle: "italic" },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 10 },
  pickerItemText: { fontSize: 14, color: "#1e293b" },
  pickerItemSubtext: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  linkedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 4, alignSelf: "flex-start",
  },
  linkedBadgeText: { fontSize: 11, color: "#059669", fontWeight: "700" },
  itemsHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 16,
  },
  addRowBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#e0f2fe",
  },
  addRowBtnText: { color: "#0369a1", fontWeight: "700", fontSize: 12 },
  itemRowBox: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
    padding: 12, marginTop: 10, backgroundColor: "#f8fafc",
  },
  itemRowHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  itemRowIndex: { fontSize: 12, fontWeight: "800", color: "#94a3b8" },
  lineTotalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0",
  },
  lineTotalLabel: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  lineTotalValue: { fontSize: 14, fontWeight: "800", color: "#059669" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 20, padding: 14, borderRadius: 10, backgroundColor: "#0369a1",
  },
  totalLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#fff" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 40 },
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