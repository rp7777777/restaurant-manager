// ============================================
// SERVORA ERP — Kitchen Module
// Ingredient Request → Store notification
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
  orderBy, doc, updateDoc, serverTimestamp, where,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useApp } from "../../context/AppContext";

// ── Types ────────────────────────────────────
type RequestStatus = "PENDING" | "APPROVED" | "ISSUED" | "REJECTED";

interface IngredientRequest {
  id: string;
  itemName: string;
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

  // Form
  const [itemName, setItemName] = useState("");
  const [closingStock, setClosingStock] = useState("");
  const [minimumLevel, setMinimumLevel] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [requiredDate, setRequiredDate] = useState(todayStr());
  const [note, setNote] = useState("");

  // Multi-item form
  const [requestItems, setRequestItems] = useState<{
    itemName: string;
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
      closingStock,
      minimumLevel,
      orderQuantity,
      unit,
    }]);
    setItemName(""); setClosingStock("");
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });

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

              <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <MaterialIcons name="restaurant" size={14} color={theme.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Item Name"
                  placeholderTextColor={theme.textSecondary}
                  value={itemName}
                  onChangeText={setItemName}
                />
              </View>

              <View style={styles.row3}>
                <View style={styles.thirdField}>
                  <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Closing Stock</Text>
                  <TextInput
                    style={[styles.miniInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={closingStock}
                    onChangeText={setClosingStock}
                  />
                </View>
                <View style={styles.thirdField}>
                  <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>Min Level</Text>
                  <TextInput
                    style={[styles.miniInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={minimumLevel}
                    onChangeText={setMinimumLevel}
                  />
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

              {/* Unit selector */}
              <TouchableOpacity
                style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowUnitPicker(true)}
              >
                <Text style={[styles.selectorText, { color: theme.text }]}>Unit: {unit}</Text>
                <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addItemBtn, { backgroundColor: theme.primary }]}
                onPress={addItemToList}
              >
                <MaterialIcons name="add" size={16} color="#fff" />
                <Text style={styles.addItemBtnText}>Add to List</Text>
              </TouchableOpacity>
            </View>

            {/* Items list */}
            {requestItems.length > 0 && (
              <View style={[styles.itemsTable, { backgroundColor: theme.bg }]}>
                <View style={[styles.itemsTableHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.itemsHeaderText, { flex: 2 }]}>ITEM</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>STOCK</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>ORDER</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: "center" }]}>UNIT</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 0.5, textAlign: "center" }]}>DEL</Text>
                </View>
                {requestItems.map((item, idx) => (
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

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : requests.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
            <MaterialIcons name="add-shopping-cart" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No requests yet</Text>
          </View>
        ) : (
          requests.map((req) => {
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
  selector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
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
