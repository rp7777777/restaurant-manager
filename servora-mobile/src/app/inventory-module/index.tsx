// ============================================
// SERVORA ERP — Inventory Module
// Stock management + Low stock alerts + PDF
// ============================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Platform, RefreshControl, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, doc, updateDoc, deleteDoc,
  serverTimestamp, where,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useApp } from "../../context/AppContext";

// ── Types ────────────────────────────────────
interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  minStock: number;
  isLowStock: boolean;
  restaurantId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const CATEGORIES = [
  "Meat", "Vegetables", "Dairy", "Dry Goods",
  "Beverages", "Sauces", "Spices", "Oils", "Other",
];

const UNITS = ["kg", "g", "L", "ml", "pcs", "box", "bag", "bottle", "pac"];

const CAT_COLORS: Record<string, string> = {
  Meat: "#ef4444", Vegetables: "#10b981", Dairy: "#3b82f6",
  "Dry Goods": "#f59e0b", Beverages: "#06b6d4", Sauces: "#8b5cf6",
  Spices: "#f97316", Oils: "#84cc16", Other: "#94a3b8",
};

function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function InventoryScreen() {
  const { theme, fmt, restaurantId } = useApp();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // Form state
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Vegetables");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [unitCost, setUnitCost] = useState("");
  const [minStock, setMinStock] = useState("");

  // ── Load inventory ─────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, "restaurants", restaurantId, "inventory"),
      orderBy("itemName", "asc")
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
      setRefreshing(false);
    }, () => setLoading(false));
  }, [restaurantId]);

  // ── Save item ──────────────────────────────
  const handleSave = async () => {
    if (!itemName.trim() || !quantity || !unit) {
      Alert.alert("Error", "Item name, quantity and unit are required");
      return;
    }
    if (!restaurantId) return;
    setSaving(true);
    try {
      const qty = safeNum(quantity);
      const cost = safeNum(unitCost);
      const min = safeNum(minStock);
      const data = {
        itemName: itemName.trim(),
        category,
        quantity: qty,
        unit,
        unitCost: cost,
        totalValue: qty * cost,
        minStock: min,
        isLowStock: qty <= min,
        restaurantId,
        userId: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      };

      if (editingItem) {
        await updateDoc(
          doc(db, "restaurants", restaurantId, "inventory", editingItem.id),
          data
        );
        Alert.alert("✅ Updated", `${itemName} updated`);
      } else {
        await addDoc(
          collection(db, "restaurants", restaurantId, "inventory"),
          { ...data, createdAt: serverTimestamp() }
        );
        Alert.alert("✅ Added", `${itemName} added to inventory`);
      }
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: InventoryItem) => {
    Alert.alert("Delete", `Delete ${item.itemName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "restaurants", restaurantId, "inventory", item.id));
        },
      },
    ]);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setItemName(item.itemName);
    setCategory(item.category);
    setQuantity(item.quantity.toString());
    setUnit(item.unit);
    setUnitCost(item.unitCost?.toString() ?? "");
    setMinStock(item.minStock?.toString() ?? "");
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setItemName(""); setCategory("Vegetables");
    setQuantity(""); setUnit("kg");
    setUnitCost(""); setMinStock("");
    setShowForm(false);
  };

  const onRefresh = useCallback(() => setRefreshing(true), []);

  // ── Filtered items ─────────────────────────
  const filtered = items.filter((item) => {
    const matchSearch = item.itemName.toLowerCase().includes(searchText.toLowerCase());
    const matchCat = filterCategory === "All" || item.category === filterCategory;
    return matchSearch && matchCat;
  });

  const lowStockItems = items.filter((i) => i.isLowStock);
  const totalValue = items.reduce((s, i) => s + (i.quantity * (i.unitCost ?? 0)), 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>INVENTORY</Text>
            <Text style={styles.headerSub}>Stock Management</Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: "#FFD700" }]}
            onPress={() => { resetForm(); setShowForm(!showForm); }}
          >
            <MaterialIcons name={showForm ? "close" : "add"} size={22} color="#00154f" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="inventory" size={24} color="#3b82f6" />
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Items</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="warning" size={24} color="#ef4444" />
            <Text style={[styles.statValue, { color: "#ef4444" }]}>{lowStockItems.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Low Stock</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="attach-money" size={24} color="#10b981" />
            <Text style={[styles.statValue, { color: "#10b981" }]}>{fmt(totalValue)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Value</Text>
          </View>
        </View>

        {/* Low stock alert */}
        {lowStockItems.length > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: "#ef444415", borderColor: "#ef4444" }]}>
            <MaterialIcons name="warning" size={16} color="#ef4444" />
            <Text style={styles.alertText}>
              {lowStockItems.length} item(s) low stock: {lowStockItems.map(i => i.itemName).join(", ")}
            </Text>
          </View>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <View style={[styles.form, { backgroundColor: theme.card }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>
              {editingItem ? "✏️ Edit Item" : "➕ Add Item"}
            </Text>

            {/* Item Name */}
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ITEM NAME</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <MaterialIcons name="inventory" size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="e.g. Chicken Breast"
                placeholderTextColor={theme.textSecondary}
                value={itemName}
                onChangeText={setItemName}
              />
            </View>

            {/* Category */}
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CATEGORY</Text>
            <TouchableOpacity
              style={[styles.selector, { backgroundColor: theme.bg, borderColor: theme.border }]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <View style={[styles.catDot, { backgroundColor: CAT_COLORS[category] ?? "#94a3b8" }]} />
              <Text style={[styles.selectorText, { color: theme.text }]}>{category}</Text>
              <MaterialIcons name="arrow-drop-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Quantity + Unit */}
            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>QUANTITY</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                </View>
              </View>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>UNIT</Text>
                <TouchableOpacity
                  style={[styles.selector, { backgroundColor: theme.bg, borderColor: theme.border }]}
                  onPress={() => setShowUnitPicker(true)}
                >
                  <Text style={[styles.selectorText, { color: theme.text }]}>{unit}</Text>
                  <MaterialIcons name="arrow-drop-down" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Unit Cost + Min Stock */}
            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>UNIT COST (€)</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={unitCost}
                    onChangeText={setUnitCost}
                  />
                </View>
              </View>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>MIN STOCK</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={minStock}
                    onChangeText={setMinStock}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="save" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>{editingItem ? "UPDATE" : "SAVE"}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.border }]}
                onPress={resetForm}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search + Filter */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialIcons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search inventory..."
              placeholderTextColor={theme.textSecondary}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {["All", ...CATEGORIES].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catChip,
                { borderColor: CAT_COLORS[cat] ?? theme.border },
                filterCategory === cat && { backgroundColor: CAT_COLORS[cat] ?? theme.primary },
              ]}
              onPress={() => setFilterCategory(cat)}
            >
              <Text style={[styles.catChipText, {
                color: filterCategory === cat ? "#fff" : (CAT_COLORS[cat] ?? theme.textSecondary),
              }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Inventory Table */}
        <View style={[styles.tableContainer, { backgroundColor: theme.card }]}>
          <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>ITEM</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}>QTY</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}>VALUE</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}>STATUS</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}>ACTIONS</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ padding: 20 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="inventory" size={36} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No items found</Text>
            </View>
          ) : (
            filtered.map((item, idx) => {
              const color = CAT_COLORS[item.category] ?? "#94a3b8";
              const pct = item.minStock > 0 ? Math.min((item.quantity / (item.minStock * 2)) * 100, 100) : 100;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: theme.border },
                    idx % 2 === 0 && { backgroundColor: theme.bg + "60" },
                    item.isLowStock && { backgroundColor: "#ef444408" },
                  ]}
                >
                  <View style={{ flex: 2 }}>
                    <View style={styles.itemNameRow}>
                      <View style={[styles.catDot, { backgroundColor: color }]} />
                      <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                        {item.itemName}
                      </Text>
                    </View>
                    <Text style={[styles.itemCat, { color: theme.textSecondary }]}>{item.category}</Text>
                    {/* Stock bar */}
                    <View style={[styles.stockBar, { backgroundColor: theme.border }]}>
                      <View style={[styles.stockBarFill, {
                        width: `${pct}%` as any,
                        backgroundColor: item.isLowStock ? "#ef4444" : color,
                      }]} />
                    </View>
                  </View>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "center", color: item.isLowStock ? "#ef4444" : theme.text }]}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "center", color: "#10b981" }]}>
                    {fmt(item.quantity * (item.unitCost ?? 0))}
                  </Text>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    {item.isLowStock ? (
                      <View style={styles.lowBadge}>
                        <Text style={styles.lowBadgeText}>LOW</Text>
                      </View>
                    ) : (
                      <View style={styles.okBadge}>
                        <Text style={styles.okBadgeText}>OK</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 8 }}>
                    <TouchableOpacity onPress={() => handleEdit(item)}>
                      <MaterialIcons name="edit" size={16} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)}>
                      <MaterialIcons name="delete" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </View>

      {/* Category Picker */}
      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCategoryPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Category</Text>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.pickerItem, { borderBottomColor: theme.border },
                  category === cat && { backgroundColor: theme.sidebarActive }]}
                onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
              >
                <View style={[styles.catDot, { backgroundColor: CAT_COLORS[cat] ?? "#94a3b8" }]} />
                <Text style={[styles.pickerItemText, { color: theme.text }]}>{cat}</Text>
                {category === cat && <MaterialIcons name="check" size={14} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Unit Picker */}
      <Modal visible={showUnitPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowUnitPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Unit</Text>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.pickerItem, { borderBottomColor: theme.border },
                  unit === u && { backgroundColor: theme.sidebarActive }]}
                onPress={() => { setUnit(u); setShowUnitPicker(false); }}
              >
                <Text style={[styles.pickerItemText, { color: theme.text }]}>{u}</Text>
                {unit === u && <MaterialIcons name="check" size={14} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24, paddingHorizontal: 20,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  body: { padding: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 16, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600" },
  alertBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12,
  },
  alertText: { color: "#ef4444", fontSize: 12, flex: 1 },
  form: { borderRadius: 16, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },
  selector: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12,
  },
  selectorText: { flex: 1, fontSize: 14, fontWeight: "600" },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  row2: { flexDirection: "row", gap: 10 },
  halfField: { flex: 1 },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  saveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, padding: 13, borderRadius: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  cancelBtn: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  cancelBtnText: { fontSize: 13, fontWeight: "600" },
  searchRow: { marginBottom: 10 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  catScroll: { marginBottom: 12 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1.5, marginRight: 6,
  },
  catChipText: { fontSize: 11, fontWeight: "600" },
  tableContainer: { borderRadius: 14, overflow: "hidden", marginBottom: 32 },
  tableHeader: {
    flexDirection: "row", paddingVertical: 10,
    paddingHorizontal: 12, borderBottomWidth: 1,
    backgroundColor: "#00154f",
  },
  tableHeaderText: { color: "#FFD700", fontSize: 10, fontWeight: "800" },
  tableRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemName: { fontSize: 12, fontWeight: "700" },
  itemCat: { fontSize: 10, marginTop: 1 },
  stockBar: { height: 3, borderRadius: 2, marginTop: 4, overflow: "hidden" },
  stockBarFill: { height: 3, borderRadius: 2 },
  tableCell: { fontSize: 12, fontWeight: "600" },
  lowBadge: {
    backgroundColor: "#ef444420", paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  lowBadgeText: { color: "#ef4444", fontSize: 9, fontWeight: "800" },
  okBadge: {
    backgroundColor: "#10b98120", paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  okBadgeText: { color: "#10b981", fontSize: 9, fontWeight: "800" },
  emptyBox: { padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  pickerCard: { width: "100%", maxWidth: 320, borderRadius: 16, overflow: "hidden" },
  pickerTitle: { fontSize: 15, fontWeight: "800", padding: 16, paddingBottom: 8 },
  pickerItem: {
    flexDirection: "row", alignItems: "center",
    gap: 10, padding: 13, borderBottomWidth: 1,
  },
  pickerItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
});
