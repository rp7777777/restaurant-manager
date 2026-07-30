// ============================================
// SERVORA ERP — Kitchen Module
// Ingredient Request → Store notification
// ============================================

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Platform, RefreshControl, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useApp } from "../../context/AppContext";
import { useInventory } from "../../modules/inventory-module/hooks/useInventory";
import { useCategoriesForPicker } from "../../modules/inventory-module/hooks/useCategoriesForPicker";
import { InventoryItem } from "../../modules/inventory-module/types/inventory";

// ── Types ────────────────────────────────────
type RequestStatus = "PENDING" | "APPROVED" | "ISSUED" | "REJECTED";

interface IngredientRequest {
  id: string;
  itemName: string;
  inventoryId?: string;  // ✅ links this request to a real Inventory item — lets Store's Issue step call recordStockMovement() directly instead of matching by name
  categoryId?: string | null;  // ✅ same category the item belongs to in Inventory, for grouping/reporting
  closingStock: number;
  minimumLevel: number;
  orderQuantity: number;
  unit: string;
  requiredDate: string;
  requestedBy: string;
  note: string;
  status: RequestStatus;
  restaurantId: string;
  createdAt?: unknown;
}

// ── Constants ─────────────────────────────────
const UNITS = ["kg", "g", "L", "ml", "pcs", "box", "bag", "bottle", "pac"];

const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#3b82f6",
  ISSUED: "#10b981",
  REJECTED: "#ef4444",
};

const STATUS_ICONS: Record<RequestStatus, string> = {
  PENDING: "schedule",
  APPROVED: "check-circle",
  ISSUED: "done-all",
  REJECTED: "cancel",
};

function todayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function KitchenScreen() {
  const { theme, restaurantId, userProfile } = useApp();

  const [requests, setRequests] = useState<IngredientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  // ✅ Day-by-day view for Request History — same pattern as Store
  // module's "All Requests" tab: defaults to today, filters by
  // requiredDate, prev/next-day navigation instead of one endless
  // mixed list of every request ever sent.
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Form
  const [itemName, setItemName] = useState("");
  const [inventoryId, setInventoryId] = useState<string | undefined>(undefined);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [closingStock, setClosingStock] = useState("");
  const [minimumLevel, setMinimumLevel] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [requiredDate, setRequiredDate] = useState(todayStr());
  const [note, setNote] = useState("");

  // ✅ Live Inventory list to search against — same debounced
  // search-or-freetext pattern as the Purchase Order Create form's
  // item picker, so a Kitchen request can link to a real
  // inventoryId when the item already exists, while still allowing
  // a free-text name for something not yet in Inventory.
  const { items: inventoryItems } = useInventory(restaurantId);
  const { categories } = useCategoriesForPicker(restaurantId);
  const [debouncedItemName, setDebouncedItemName] = useState("");
  // ✅ Selecting a category first narrows the item search to that
  // category's items only, and groups the added-items list below by
  // category — mirrors how Inventory itself is organized, so Chefs
  // pick from the same categories Store already uses.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedItemName(itemName), 300);
    return () => clearTimeout(timer);
  }, [itemName]);

  const itemMatches = useMemo(() => {
    const q = debouncedItemName.trim().toLowerCase();
    if (q.length < 2) return [];
    return inventoryItems
      .filter((it) => !selectedCategoryId || it.categoryId === selectedCategoryId)
      .filter((it) => it.itemName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [debouncedItemName, inventoryItems, selectedCategoryId]);

  const pickInventoryItem = (item: InventoryItem) => {
    setItemName(item.itemName);
    setInventoryId(item.id);
    setUnit(item.unit);
    // ✅ Auto-fill from Inventory's real numbers rather than making
    // the Chef re-type them — closingStock/minimumLevel are just a
    // snapshot of what Inventory already knows at request time.
    setClosingStock(String(item.currentStock));
    setMinimumLevel(String(item.minStock));
    setShowItemPicker(false);
    // ✅ Auto-select the item's own category if none was chosen yet,
    // so category-grouping below works even if the Chef searched by
    // name first instead of picking a category up front.
    if (!selectedCategoryId) setSelectedCategoryId(item.categoryId);
  };

  // Multi-item form
  const [requestItems, setRequestItems] = useState<{
    itemName: string;
    inventoryId?: string;
    categoryId?: string;
    closingStock: string;
    minimumLevel: string;
    orderQuantity: string;
    unit: string;
  }[]>([]);

  // ── Load requests ─────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, "restaurants", restaurantId, "kitchenRequests"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
      setRefreshing(false);
    }, () => setLoading(false));
  }, [restaurantId]);

  // ── Add item to request list ───────────────
  const addItemToList = () => {
    if (!itemName.trim() || !orderQuantity) {
      Alert.alert("Error", "Item name and order quantity required");
      return;
    }
    setRequestItems([...requestItems, {
      itemName: itemName.trim(),
      inventoryId,
      categoryId: selectedCategoryId,
      closingStock,
      minimumLevel,
      orderQuantity,
      unit,
    }]);
    // ✅ selectedCategoryId is intentionally KEPT (not cleared) —
    // Chefs commonly add several items from the same category in a
    // row (e.g. multiple Dairy items), so staying on the same
    // category saves re-selecting it each time.
    setItemName(""); setInventoryId(undefined); setClosingStock("");
    setMinimumLevel(""); setOrderQuantity("");
  };

  const removeItem = (idx: number) => {
    setRequestItems(requestItems.filter((_, i) => i !== idx));
  };

  // ── Send request ───────────────────────────
  const handleSendRequest = async () => {
    if (requestItems.length === 0) {
      Alert.alert("Error", "Add at least one item");
      return;
    }
    if (!restaurantId) return;

    setSaving(true);
    try {
      // Send each item as separate request
      for (const item of requestItems) {
        await addDoc(
          collection(db, "restaurants", restaurantId, "kitchenRequests"),
          {
            itemName: item.itemName,
            inventoryId: item.inventoryId ?? null,  // ✅ null (not undefined) — Firestore rejects undefined
            categoryId: item.categoryId ?? null,
            closingStock: Number(item.closingStock || 0),
            minimumLevel: Number(item.minimumLevel || 0),
            orderQuantity: Number(item.orderQuantity),
            unit: item.unit,
            requiredDate,
            requestedBy: userProfile?.name ?? auth.currentUser?.email ?? "Chef",
            note: note.trim(),
            status: "PENDING",
            restaurantId,
            userId: auth.currentUser?.uid ?? "",
            createdAt: serverTimestamp(),
          }
        );
      }

      setRequestItems([]);
      setNote("");
      setRequiredDate(todayStr());
      setShowForm(false);
      setActiveTab("history");
      Alert.alert("✅ Sent", `${requestItems.length} item(s) requested — Store notified!`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to send");
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = useCallback(() => setRefreshing(true), []);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED" || r.status === "ISSUED").length;

  // ✅ Request History is day-scoped by requiredDate, same as Store
  // module's "All Requests" tab.
  const historyRequests = requests.filter((r) => r.requiredDate === selectedDate);
  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });

  const formatSelectedDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      });
    } catch { return dateStr; }
  };

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
            <Text style={styles.headerTitle}>KITCHEN</Text>
            <Text style={styles.headerSub}>Ingredient Request</Text>
          </View>
          <TouchableOpacity
            style={styles.newRequestBtn}
            onPress={() => { setShowForm(!showForm); setActiveTab("new"); }}
          >
            <MaterialIcons name={showForm ? "close" : "add-shopping-cart"} size={20} color="#00154f" />
            <Text style={styles.newRequestBtnText}>
              {showForm ? "Cancel" : "New Request"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="schedule" size={22} color="#f59e0b" />
            <Text style={[styles.statValue, { color: "#f59e0b" }]}>{pendingCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="done-all" size={22} color="#10b981" />
            <Text style={[styles.statValue, { color: "#10b981" }]}>{approvedCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Approved</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="list-alt" size={22} color="#3b82f6" />
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>{requests.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
          </View>
        </View>

        {/* New Request Form */}
        {showForm && (
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
                value={requiredDate}
                onChangeText={setRequiredDate}
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
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={[styles.selectorText, { color: theme.text }]}>
                  {selectedCategoryId
                    ? categories.find((c) => c.id === selectedCategoryId)?.name ?? "Unknown"
                    : "All Categories"}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <MaterialIcons name="search" size={14} color={theme.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={selectedCategoryId ? "Search this category's items..." : "Search Inventory items..."}
                  placeholderTextColor={theme.textSecondary}
                  value={itemName}
                  onChangeText={(text) => {
                    // ✅ Typing after a previous pick clears inventoryId —
                    // the user is now describing something else, so the
                    // old link would silently mismatch the new name.
                    setItemName(text);
                    setInventoryId(undefined);
                    setClosingStock(""); setMinimumLevel("");
                    setShowItemPicker(true);
                  }}
                  onFocus={() => setShowItemPicker(true)}
                />
              </View>
              {inventoryId && (
                <View style={styles.linkedBadge}>
                  <MaterialIcons name="link" size={12} color="#059669" />
                  <Text style={styles.linkedBadgeText}>Linked to Inventory</Text>
                </View>
              )}
              {showItemPicker && itemMatches.length > 0 && (
                <ScrollView style={[styles.itemPickerList, { backgroundColor: theme.surface, borderColor: theme.border }]} nestedScrollEnabled>
                  {itemMatches.map((it) => (
                    <TouchableOpacity
                      key={it.id}
                      style={styles.itemPickerRow}
                      onPress={() => pickInventoryItem(it)}
                    >
                      <Text style={[styles.itemPickerRowText, { color: theme.text }]}>{it.itemName}</Text>
                      <Text style={[styles.itemPickerRowSub, { color: theme.textSecondary }]}>
                        {it.currentStock} {it.unit} in stock
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {/* ✅ Free-text/new-item is now an explicit opt-in row —
                  shown only once the Chef has typed something (2+
                  chars) with no matching Inventory item found and no
                  item currently linked. Default flow stays
                  Category → Search → Select; typing alone no longer
                  silently creates an unlinked free-text item. */}
              {showItemPicker && !inventoryId && debouncedItemName.trim().length >= 2 && itemMatches.length === 0 && (
                <TouchableOpacity
                  style={[styles.newItemRow, { borderColor: theme.border }]}
                  onPress={() => setShowItemPicker(false)}
                >
                  <MaterialIcons name="add-circle-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.newItemRowText, { color: theme.textSecondary }]}>
                    No match — add "{itemName.trim()}" as a new item
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.row3}>
                <View style={styles.thirdField}>
                  <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Closing Stock</Text>
                  {inventoryId ? (
                    // ✅ Read-only display — Inventory IS the source of
                    // truth for this number, so once linked it's shown,
                    // never re-typed.
                    <View style={[styles.miniInput, styles.miniInputReadOnly, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={[styles.readOnlyValueText, { color: theme.text }]}>{closingStock}</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={[styles.miniInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={closingStock}
                      onChangeText={setClosingStock}
                    />
                  )}
                </View>
                <View style={styles.thirdField}>
                  <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Min Level</Text>
                  {inventoryId ? (
                    <View style={[styles.miniInput, styles.miniInputReadOnly, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={[styles.readOnlyValueText, { color: theme.text }]}>{minimumLevel}</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={[styles.miniInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={minimumLevel}
                      onChangeText={setMinimumLevel}
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
                    value={orderQuantity}
                    onChangeText={setOrderQuantity}
                  />
                </View>
              </View>

              {/* ✅ Below-minimum warning — right above Order Qty,
                  since that's the field the Chef is about to fill in
                  and this context helps them decide how much to
                  request. Only shown for linked items, where both
                  numbers are real Inventory data. */}
              {inventoryId && Number(closingStock) < Number(minimumLevel) && (
                <View style={styles.belowMinWarning}>
                  <MaterialIcons name="warning" size={13} color="#dc2626" />
                  <Text style={styles.belowMinWarningText}>Below Minimum Stock</Text>
                </View>
              )}

              {/* Unit — read-only display once linked to Inventory
                  (per review: a Chef shouldn't be able to turn a
                  linked item's "kg" into "pcs"); the picker only
                  exists at all for a free-text/unlinked item. */}
              <Text style={[styles.miniLabel, { color: theme.textSecondary, marginTop: 4 }]}>Unit</Text>
              {inventoryId ? (
                <View style={[styles.selector, styles.selectorReadOnly, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.selectorText, { color: theme.text }]}>{unit}</Text>
                  <Text style={[styles.readOnlyTag, { color: theme.textSecondary }]}>from Inventory</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setShowUnitPicker(true)}
                >
                  <Text style={[styles.selectorText, { color: theme.text }]}>{unit}</Text>
                  <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.addItemBtn, { backgroundColor: theme.primary }]}
                onPress={addItemToList}
              >
                <MaterialIcons name="add" size={16} color="#fff" />
                <Text style={styles.addItemBtnText}>Add to List</Text>
              </TouchableOpacity>
            </View>

            {/* Items list — grouped by category, same organization
                as Inventory itself, so a long request is easy to
                scan (e.g. all Dairy together, all Meat together). */}
            {requestItems.length > 0 && (
              <View style={[styles.itemsTable, { backgroundColor: theme.bg }]}>
                <View style={[styles.itemsTableHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.itemsHeaderText, { flex: 2 }]}>ITEM</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>STOCK</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>ORDER</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>UNIT</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 0.5, textAlign: "center" }]}>DEL</Text>
                </View>
                {(() => {
                  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
                  const grouped = new Map<string, { name: string; entries: { item: typeof requestItems[number]; idx: number }[] }>();
                  requestItems.forEach((item, idx) => {
                    const key  = item.categoryId ?? "uncategorized";
                    const name = item.categoryId ? (categoryMap.get(item.categoryId) ?? "Unknown") : "Uncategorized";
                    if (!grouped.has(key)) grouped.set(key, { name, entries: [] });
                    grouped.get(key)!.entries.push({ item, idx });
                  });
                  return Array.from(grouped.values()).map((group) => (
                    <View key={group.name}>
                      <View style={[styles.categoryGroupHeader, { borderBottomColor: theme.border }]}>
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
                          <TouchableOpacity style={{ flex: 0.5, alignItems: "center" }} onPress={() => removeItem(idx)}>
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
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* Send button */}
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: "#10b981" }, (saving || requestItems.length === 0) && { opacity: 0.5 }]}
              onPress={handleSendRequest}
              disabled={saving || requestItems.length === 0}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <MaterialIcons name="send" size={18} color="#fff" />
                  <Text style={styles.sendBtnText}>
                    SEND REQUEST ({requestItems.length} items)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Request History */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Request History</Text>

        <View style={[styles.dateNav, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={goToPrevDay} style={styles.dateNavArrow}>
            <MaterialIcons name="chevron-left" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.dateNavLabel, { color: theme.text }]}>
            {isToday ? "Today — " : ""}{formatSelectedDate(selectedDate)}
          </Text>
          <TouchableOpacity onPress={goToNextDay} style={styles.dateNavArrow}>
            <MaterialIcons name="chevron-right" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : historyRequests.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
            <MaterialIcons name="add-shopping-cart" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No requests for {formatSelectedDate(selectedDate)}
            </Text>
          </View>
        ) : (
          historyRequests.map((req) => {
            const statusColor = STATUS_COLORS[req.status] ?? "#94a3b8";
            const statusIcon = STATUS_ICONS[req.status] ?? "help";
            return (
              <View key={req.id} style={[styles.requestCard, { backgroundColor: theme.card }]}>
                <View style={styles.requestCardHeader}>
                  <View style={styles.requestCardLeft}>
                    <Text style={[styles.requestItemName, { color: theme.text }]}>{req.itemName}</Text>
                    <Text style={[styles.requestDate, { color: theme.textSecondary }]}>
                      Required: {req.requiredDate} · By: {req.requestedBy}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <MaterialIcons name={statusIcon as any} size={12} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{req.status}</Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <View style={styles.requestDetailItem}>
                    <Text style={[styles.requestDetailLabel, { color: theme.textSecondary }]}>Closing Stock</Text>
                    <Text style={[styles.requestDetailValue, { color: theme.text }]}>{req.closingStock} {req.unit}</Text>
                  </View>
                  <View style={styles.requestDetailItem}>
                    <Text style={[styles.requestDetailLabel, { color: theme.textSecondary }]}>Min Level</Text>
                    <Text style={[styles.requestDetailValue, { color: theme.text }]}>{req.minimumLevel} {req.unit}</Text>
                  </View>
                  <View style={styles.requestDetailItem}>
                    <Text style={[styles.requestDetailLabel, { color: theme.textSecondary }]}>Order Qty</Text>
                    <Text style={[styles.requestDetailValue, { color: "#10b981", fontWeight: "800" }]}>{req.orderQuantity} {req.unit}</Text>
                  </View>
                </View>

                {req.note ? (
                  <Text style={[styles.requestNote, { color: theme.textSecondary }]}>
                    Note: {req.note}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* Unit Picker */}
      <Modal visible={showUnitPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowUnitPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Unit</Text>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.pickerItem, { borderBottomColor: theme.border }, unit === u && { backgroundColor: theme.sidebarActive }]}
                onPress={() => { setUnit(u); setShowUnitPicker(false); }}
              >
                <Text style={[styles.pickerItemText, { color: theme.text }]}>{u}</Text>
                {unit === u && <MaterialIcons name="check" size={14} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Picker */}
      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCategoryPicker(false)}>
          <ScrollView style={[styles.pickerCard, { backgroundColor: theme.surface, maxHeight: 400 }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Category</Text>
            <TouchableOpacity
              style={[styles.pickerItem, { borderBottomColor: theme.border }, !selectedCategoryId && { backgroundColor: theme.sidebarActive }]}
              onPress={() => { setSelectedCategoryId(undefined); setShowCategoryPicker(false); }}
            >
              <Text style={[styles.pickerItemText, { color: theme.text }]}>All Categories</Text>
              {!selectedCategoryId && <MaterialIcons name="check" size={14} color={theme.primary} />}
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pickerItem, { borderBottomColor: theme.border }, selectedCategoryId === c.id && { backgroundColor: theme.sidebarActive }]}
                onPress={() => { setSelectedCategoryId(c.id); setShowCategoryPicker(false); }}
              >
                <Text style={[styles.pickerItemText, { color: theme.text }]}>{c.name}</Text>
                {selectedCategoryId === c.id && <MaterialIcons name="check" size={14} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // ✅ New styles for the Inventory search/link UI
  linkedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 4, marginBottom: 4, alignSelf: "flex-start",
  },
  linkedBadgeText: { fontSize: 11, color: "#059669", fontWeight: "700" },
  newItemRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderStyle: "dashed", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
  },
  newItemRowText: { fontSize: 12, fontStyle: "italic", flex: 1 },
  itemPickerList: {
    borderWidth: 1, borderRadius: 8,
    marginBottom: 8, maxHeight: 160, overflow: "hidden",
  },
  itemPickerRow: { paddingHorizontal: 12, paddingVertical: 10 },
  itemPickerRowText: { fontSize: 14, fontWeight: "600" },
  itemPickerRowSub: { fontSize: 11, marginTop: 2 },
  header: {
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24, paddingHorizontal: 20,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  newRequestBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFD700", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  newRequestBtnText: { color: "#00154f", fontSize: 12, fontWeight: "800" },
  body: { padding: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 10, paddingVertical: 8, marginBottom: 12,
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 13, fontWeight: "700" },
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
    backgroundColor: "rgba(0,0,0,0.04)",
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
  requestCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  requestCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  requestCardLeft: { flex: 1 },
  requestItemName: { fontSize: 14, fontWeight: "700" },
  requestDate: { fontSize: 11, marginTop: 2 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: "800" },
  requestDetails: { flexDirection: "row", gap: 8 },
  requestDetailItem: { flex: 1, alignItems: "center" },
  requestDetailLabel: { fontSize: 9, fontWeight: "600", marginBottom: 2 },
  requestDetailValue: { fontSize: 12, fontWeight: "700" },
  requestNote: { fontSize: 11, marginTop: 8, fontStyle: "italic" },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  pickerCard: { width: "100%", maxWidth: 300, borderRadius: 16, overflow: "hidden" },
  pickerTitle: { fontSize: 15, fontWeight: "800", padding: 16, paddingBottom: 8 },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
});