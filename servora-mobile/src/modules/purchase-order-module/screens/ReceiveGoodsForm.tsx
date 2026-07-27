// ============================================
// SERVORA ERP — ReceiveGoodsForm
// ✅ Phase 8.2c — the APPROVED→RECEIVED step. Per PurchaseOrderItem:
//    Received Qty (defaults to the ordered quantity, editable —
//    real deliveries often differ, e.g. ordered 20kg/received
//    18.6kg), Lot Number, Expiry Date. Unit Cost is ALSO editable
//    here — the real price is often only known once the supplier's
//    invoice arrives (order-time unitCost may have been 0/estimate).
// ✅ Items with NO itemId (free-text, never linked to Inventory)
//    show an extra required Category picker — creating a brand-new
//    Inventory item needs a category (FROZEN requirement in
//    inventory-repository.ts), which doesn't exist for a line that
//    was just typed as text on the Create form.
// ✅ Validates (UI-side, defense-in-depth alongside the service):
//    positive received qty, a soft over-receipt warning (>3×
//    ordered), non-negative unit cost (0 is legitimate — price can
//    still be unknown even at receive time), and expiry date format
//    (YYYY-MM-DD) so a malformed date never reaches Inventory.
// ✅ Delegates all the actual writes to receivePurchaseOrder()
//    (purchase-order-service.ts) — this component only collects
//    input and validates presence/shape before calling it. Business
//    rules (price-before-movement ordering, sequential writes, the
//    new-item currentStock:0 double-count fix, etc) live in the
//    service, not here.
// PHASE 8.2c
// ============================================

import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { PurchaseOrder, PurchaseOrderItem } from "../types/purchase-order";
import { receivePurchaseOrder, ReceivePurchaseOrderLineOptions } from "../services/purchase-order-service";
import { useCategoriesForPicker } from "../../inventory-module/hooks/useCategoriesForPicker";

interface ReceiveGoodsFormProps {
  order:    PurchaseOrder;
  onDone:   () => void;
  onCancel: () => void;
}

interface DraftReceiveLine {
  receivedQty:       string;
  unitCost:          string;
  lotNumber:         string;
  expiryDate:        string;
  newItemCategoryId: string;  // only used/shown when item.itemId is unset
}

export default function ReceiveGoodsForm({ order, onDone, onCancel }: ReceiveGoodsFormProps) {
  const { restaurantId, fmt } = useApp();
  const { categories, loading: categoriesLoading } = useCategoriesForPicker(restaurantId);

  const [lines, setLines] = useState<Record<string, DraftReceiveLine>>(() => {
    const initial: Record<string, DraftReceiveLine> = {};
    for (const item of order.items) {
      initial[item.lineId] = {
        receivedQty:       String(item.quantity),  // default to ordered qty — user edits if it differs
        unitCost:          item.unitCost > 0 ? String(item.unitCost) : "",
        lotNumber:         "",
        expiryDate:        "",
        newItemCategoryId: "",
      };
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = useCallback((lineId: string, patch: Partial<DraftReceiveLine>) => {
    setLines((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }, []);

  const handleSave = async () => {
    if (!restaurantId) return;
    setError(null);

    const receiveLines: ReceivePurchaseOrderLineOptions[] = [];
    for (const item of order.items) {
      const draft = lines[item.lineId];
      const qty = Number(draft.receivedQty);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`"${item.itemName}": received quantity must be a positive number`);
        return;
      }
      // ✅ UI-side over-receipt warning — receiving noticeably more
      // than ordered is usually a typo, so this catches it early
      // with immediate feedback. Not a hard block at 1× ordered,
      // since receiving somewhat more/less than ordered (e.g.
      // 18.6kg vs 20kg) is normal; this only flags a large gap.
      if (item.quantity > 0 && qty > item.quantity * 3) {
        setError(
          `"${item.itemName}": received qty (${qty}) is much higher than ordered (${item.quantity}) — please double-check`
        );
        return;
      }
      if (!item.itemId && !draft.newItemCategoryId) {
        setError(`"${item.itemName}": choose a category to add it to Inventory`);
        return;
      }

      // ✅ If the user entered a price here, it's passed through as
      // this line's unitCost — order-time price is often just an
      // estimate (or 0/unknown), and this is where the real price
      // from the supplier's bill gets recorded. 0 is a legitimate
      // value (price still not confirmed even at receive time), so
      // only negative numbers are rejected.
      const enteredCost = Number(draft.unitCost);
      if (draft.unitCost.trim() !== "" && (!Number.isFinite(enteredCost) || enteredCost < 0)) {
        setError(`"${item.itemName}": unit cost must be a valid number`);
        return;
      }

      // ✅ Expiry format check — catches "31/08/2026" or free text
      // before it reaches Inventory, where a malformed date would
      // silently break expiry-based sorting/alerts later.
      const expiry = draft.expiryDate.trim();
      if (expiry !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        setError(`"${item.itemName}": expiry date must be in YYYY-MM-DD format`);
        return;
      }

      receiveLines.push({
        lineId:            item.lineId,
        receivedQty:       qty,
        lotNumber:         draft.lotNumber.trim() || undefined,
        expiryDate:        expiry || undefined,
        unitCost:          draft.unitCost.trim() !== "" ? enteredCost : undefined,
        newItemCategoryId: draft.newItemCategoryId || undefined,
      });
    }

    setSaving(true);
    try {
      await receivePurchaseOrder(restaurantId, order.id, { lines: receiveLines });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive goods");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Receive Goods — {order.poNumber}</Text>

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {order.items.map((item) => (
        <ReceiveLineRow
          key={item.lineId}
          item={item}
          draft={lines[item.lineId]}
          categories={categories}
          categoriesLoading={categoriesLoading}
          onChange={(patch) => updateLine(item.lineId, patch)}
          fmt={fmt}
        />
      ))}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "Receiving..." : "Confirm Receive"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

interface ReceiveLineRowProps {
  item:              PurchaseOrderItem;
  draft:             DraftReceiveLine;
  categories:        { id: string; name: string }[];
  categoriesLoading: boolean;
  onChange:          (patch: Partial<DraftReceiveLine>) => void;
  fmt:               (n: number) => string;
}

function ReceiveLineRow({ item, draft, categories, categoriesLoading, onChange, fmt }: ReceiveLineRowProps) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === draft.newItemCategoryId),
    [categories, draft.newItemCategoryId]
  );

  const qtyDiffersFromOrdered = draft.receivedQty !== "" && Number(draft.receivedQty) !== item.quantity;

  return (
    <View style={styles.itemBox}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        {item.itemId ? (
          <View style={styles.linkedBadge}>
            <MaterialIcons name="link" size={12} color="#059669" />
            <Text style={styles.linkedBadgeText}>Linked</Text>
          </View>
        ) : (
          <View style={styles.newBadge}>
            <MaterialIcons name="new-releases" size={12} color="#d97706" />
            <Text style={styles.newBadgeText}>New item</Text>
          </View>
        )}
      </View>
      <Text style={styles.orderedText}>
        Ordered: {item.quantity} {item.unit}
        {item.unitCost > 0 ? ` @ ${fmt(item.unitCost)}` : ""}
      </Text>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.smallLabel}>Received Qty *</Text>
          <TextInput
            style={[styles.input, qtyDiffersFromOrdered && styles.inputDiffers]}
            value={draft.receivedQty}
            onChangeText={(text) => onChange({ receivedQty: text })}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.smallLabel}>Unit Cost</Text>
          <TextInput
            style={styles.input}
            value={draft.unitCost}
            onChangeText={(text) => onChange({ unitCost: text })}
            keyboardType="numeric"
            placeholder="Now known from the bill?"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.smallLabel}>Lot Number</Text>
          <TextInput
            style={styles.input}
            value={draft.lotNumber}
            onChangeText={(text) => onChange({ lotNumber: text })}
            placeholder="Optional"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.smallLabel}>Expiry Date</Text>
          <TextInput
            style={styles.input}
            value={draft.expiryDate}
            onChangeText={(text) => onChange({ expiryDate: text })}
            placeholder="YYYY-MM-DD"
          />
        </View>
      </View>

      {!item.itemId && (
        <>
          <Text style={styles.smallLabel}>Category * (new Inventory item)</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryPicker((v) => !v)}
          >
            <Text style={styles.pickerButtonText}>
              {categoriesLoading ? "Loading..." : selectedCategory ? selectedCategory.name : "Select a category"}
            </Text>
            <MaterialIcons
              name={showCategoryPicker ? "expand-less" : "expand-more"}
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>
          {showCategoryPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {categories.length === 0 && (
                <Text style={styles.pickerEmptyText}>No categories yet</Text>
              )}
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.pickerItem}
                  onPress={() => { onChange({ newItemCategoryId: c.id }); setShowCategoryPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      )}
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
  itemBox: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
    padding: 12, marginBottom: 12, backgroundColor: "#f8fafc",
  },
  itemHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  linkedBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  linkedBadgeText: { fontSize: 11, color: "#059669", fontWeight: "700" },
  newBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  newBadgeText: { fontSize: 11, color: "#d97706", fontWeight: "700" },
  orderedText: { fontSize: 12, color: "#64748b", marginTop: 4, marginBottom: 8 },
  row: { flexDirection: "row", gap: 12, marginTop: 4 },
  rowItem: { flex: 1 },
  smallLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", marginTop: 6, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14, color: "#1e293b", backgroundColor: "#fff",
  },
  inputDiffers: { borderColor: "#d97706" },
  pickerButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff",
  },
  pickerButtonText: { fontSize: 14, color: "#1e293b" },
  pickerList: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 160, backgroundColor: "#fff",
    overflow: "hidden",
  },
  pickerEmptyText: { padding: 12, fontSize: 13, color: "#94a3b8", fontStyle: "italic" },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 10 },
  pickerItemText: { fontSize: 14, color: "#1e293b" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 40 },
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