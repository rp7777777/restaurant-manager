// ============================================
// SERVORA ERP — Sales Entry
// Shift lock + Multi-tenant + History link
// ============================================

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Platform, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection, addDoc, onSnapshot, query,
  where, orderBy, deleteDoc, doc,
  serverTimestamp, updateDoc, Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useApp } from "../context/AppContext";

type Shift = "Morning" | "Afternoon" | "Night";
type PaymentMethod = "Cash" | "Card" | "MBWay" | "Uber Eats" | "Glovo" | "Bolt Food" | "Other";

interface SaleEntry {
  id?: string;
  date: string;
  shift: Shift;
  amount: number;
  paymentMethod: PaymentMethod;
  note: string;
  locked: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  userId: string;
  restaurantId: string;
}

const SHIFTS: Shift[] = ["Morning", "Afternoon", "Night"];

const SHIFT_ICONS: Record<Shift, string> = {
  Morning: "wb-sunny",
  Afternoon: "wb-twilight",
  Night: "nights-stay",
};

const SHIFT_COLORS: Record<Shift, string> = {
  Morning: "#f59e0b",
  Afternoon: "#f97316",
  Night: "#6366f1",
};

const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash", "Card", "MBWay", "Uber Eats", "Glovo", "Bolt Food", "Other",
];

const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#10b981",
  Card: "#3b82f6",
  MBWay: "#8b5cf6",
  "Uber Eats": "#f97316",
  Glovo: "#84cc16",
  "Bolt Food": "#06b6d4",
  Other: "#94a3b8",
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function salesCol(restaurantId: string) {
  return collection(db, "restaurants", restaurantId, "sales");
}

export default function AddSaleScreen() {
  const { theme, fmt, restaurantId, userProfile } = useApp();

  const today = todayStr();
  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  const [todaySales, setTodaySales] = useState<SaleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedShift, setSelectedShift] = useState<Shift>("Morning");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [showShiftPicker, setShowShiftPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      salesCol(restaurantId),
      where("date", "==", today),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: SaleEntry[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SaleEntry, "id">),
      }));
      setTodaySales(data);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [restaurantId, today]);

  const isShiftLocked = useCallback(
    (shift: Shift) => todaySales.some((s) => s.shift === shift && s.locked),
    [todaySales]
  );

  const getShiftTotal = useCallback(
    (shift: Shift) => todaySales.filter((s) => s.shift === shift)
      .reduce((sum, s) => sum + Number(s.amount), 0),
    [todaySales]
  );

  const getShiftPaymentBreakdown = useCallback((shift: Shift) => {
    const shiftSales = todaySales.filter((s) => s.shift === shift);
    const breakdown: Record<string, number> = {};
    shiftSales.forEach((s) => {
      breakdown[s.paymentMethod] = (breakdown[s.paymentMethod] ?? 0) + Number(s.amount);
    });
    return breakdown;
  }, [todaySales]);

  const totalToday = todaySales.reduce((sum, s) => sum + Number(s.amount), 0);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert("Error", "Enter a valid amount");
      return;
    }
    if (isShiftLocked(selectedShift) && !editingId) {
      Alert.alert("Locked", `${selectedShift} shift is already locked.`);
      return;
    }
    if (!restaurantId) {
      Alert.alert("Error", "Restaurant not configured");
      return;
    }
    setSaving(true);
    try {
      const saleData = {
        date: today,
        shift: selectedShift,
        amount: Number(amount),
        paymentMethod,
        note: note.trim(),
        locked: false,
        userId: auth.currentUser?.uid ?? "",
        restaurantId,
      };
      if (editingId) {
        await updateDoc(
          doc(db, "restaurants", restaurantId, "sales", editingId),
          { ...saleData, updatedAt: serverTimestamp() }
        );
        setEditingId(null);
        Alert.alert("✅ Updated", "Sale updated successfully");
      } else {
        await addDoc(salesCol(restaurantId), {
          ...saleData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        Alert.alert("✅ Saved", `${fmt(Number(amount))} ${selectedShift} sale saved!`);
      }
      setAmount("");
      setNote("");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const lockShift = (shift: Shift) => {
    if (!restaurantId) return;
    Alert.alert(
      "Lock Shift",
      `Lock ${shift} shift? No more entries after locking.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Lock", style: "destructive",
          onPress: async () => {
            const shiftSales = todaySales.filter((s) => s.shift === shift && s.id);
            for (const sale of shiftSales) {
              await updateDoc(
                doc(db, "restaurants", restaurantId, "sales", sale.id!),
                { locked: true }
              );
            }
          },
        },
      ]
    );
  };

  const handleDelete = (sale: SaleEntry) => {
    if (!isManager) {
      Alert.alert("Access Denied", "Only managers can delete sales");
      return;
    }
    if (sale.locked) {
      Alert.alert("Locked", "Cannot delete a locked entry");
      return;
    }
    Alert.alert("Delete", "Delete this sale?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "restaurants", restaurantId, "sales", sale.id!));
        },
      },
    ]);
  };

  const handleEdit = (sale: SaleEntry) => {
    if (sale.locked) { Alert.alert("Locked", "Cannot edit a locked entry"); return; }
    setEditingId(sale.id!);
    setSelectedShift(sale.shift);
    setAmount(sale.amount.toString());
    setPaymentMethod(sale.paymentMethod);
    setNote(sale.note);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>DAILY SALES</Text>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric",
                month: "long", year: "numeric",
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push("/sales-list" as any)}
          >
            <MaterialIcons name="history" size={16} color="#FFD700" />
            <Text style={styles.historyBtnText}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>

        {/* Shift Status Cards */}
        <View style={styles.shiftRow}>
          {SHIFTS.map((shift) => {
            const locked = isShiftLocked(shift);
            const total = getShiftTotal(shift);
            const color = SHIFT_COLORS[shift];
            const breakdown = getShiftPaymentBreakdown(shift);
            return (
              <View
                key={shift}
                style={[
                  styles.shiftCard,
                  { backgroundColor: theme.card, borderColor: locked ? color : theme.border },
                ]}
              >
                <View style={[styles.shiftIconBox, { backgroundColor: color + "22" }]}>
                  <MaterialIcons name={SHIFT_ICONS[shift] as any} size={18} color={color} />
                </View>
                <Text style={[styles.shiftName, { color: theme.text }]}>{shift}</Text>
                <Text style={[styles.shiftTotal, { color }]}>
                  {total > 0 ? fmt(total) : "-"}
                </Text>
                {/* Payment breakdown per shift */}
                {Object.entries(breakdown).map(([method, amt]) => (
                  <Text key={method} style={{ fontSize: 9, color: PAYMENT_COLORS[method] ?? "#94a3b8" }}>
                    {method}: {fmt(amt)}
                  </Text>
                ))}
                {locked ? (
                  <View style={[styles.lockBadge, { backgroundColor: color + "22" }]}>
                    <MaterialIcons name="lock" size={10} color={color} />
                    <Text style={[styles.lockText, { color }]}>Locked</Text>
                  </View>
                ) : total > 0 && isManager ? (
                  <TouchableOpacity
                    onPress={() => lockShift(shift)}
                    style={[styles.lockBtn, { borderColor: color }]}
                  >
                    <Text style={[styles.lockBtnText, { color }]}>Lock</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Entry Form */}
        <View style={[styles.form, { backgroundColor: theme.card }]}>
          <Text style={[styles.formTitle, { color: theme.text }]}>
            {editingId ? "✏️ Edit Sale" : "➕ New Entry"}
          </Text>

          {/* Shift Selector */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SHIFT</Text>
          <TouchableOpacity
            style={[styles.selector, { backgroundColor: theme.bg, borderColor: theme.border }]}
            onPress={() => setShowShiftPicker(true)}
          >
            <MaterialIcons name={SHIFT_ICONS[selectedShift] as any} size={18} color={SHIFT_COLORS[selectedShift]} />
            <Text style={[styles.selectorText, { color: theme.text }]}>{selectedShift}</Text>
            <MaterialIcons name="arrow-drop-down" size={20} color={theme.textSecondary} />
            {isShiftLocked(selectedShift) && (
              <View style={styles.lockedWarning}>
                <MaterialIcons name="lock" size={12} color="#ef4444" />
                <Text style={styles.lockedWarningText}>Locked</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Amount */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>AMOUNT</Text>
          <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.currencySign, { color: theme.textSecondary }]}>€</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            {amount.length > 0 && (
              <Text style={[styles.preview, { color: "#10b981" }]}>{fmt(Number(amount))}</Text>
            )}
          </View>

          {/* Payment Method */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PAYMENT METHOD</Text>
          <TouchableOpacity
            style={[styles.selector, {
              backgroundColor: theme.bg,
              borderColor: PAYMENT_COLORS[paymentMethod] ?? theme.border,
            }]}
            onPress={() => setShowPaymentPicker(true)}
          >
            <View style={[styles.paymentDot, { backgroundColor: PAYMENT_COLORS[paymentMethod] ?? "#94a3b8" }]} />
            <Text style={[styles.selectorText, { color: theme.text }]}>{paymentMethod}</Text>
            <MaterialIcons name="arrow-drop-down" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Note */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>NOTE (OPTIONAL)</Text>
          <TextInput
            style={[styles.noteInput, {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.text,
            }]}
            placeholder="Add note..."
            placeholderTextColor={theme.textSecondary}
            value={note}
            onChangeText={setNote}
            multiline
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: theme.primary },
              (saving || (isShiftLocked(selectedShift) && !editingId)) && { opacity: 0.5 },
            ]}
            onPress={handleSave}
            disabled={saving || (isShiftLocked(selectedShift) && !editingId)}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name={editingId ? "check" : "save"} size={18} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {editingId ? "UPDATE SALE" : "SAVE SALE"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {editingId && (
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.border }]}
              onPress={() => { setEditingId(null); setAmount(""); setNote(""); }}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Today's Total */}
        <View style={[styles.totalCard, {
          backgroundColor: totalToday > 0 ? "#10b98118" : theme.card,
          borderColor: totalToday > 0 ? "#10b981" : theme.border,
        }]}>
          <View>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Today's Total</Text>
            <Text style={[styles.totalValue, { color: "#10b981" }]}>{fmt(totalToday)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/sales-list" as any)}
            style={styles.viewHistoryBtn}
          >
            <MaterialIcons name="arrow-forward" size={16} color={theme.primary} />
            <Text style={[styles.viewHistoryText, { color: theme.primary }]}>Full History</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Entries */}
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : todaySales.length > 0 ? (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Entries</Text>
            {SHIFTS.map((shift) => {
              const shiftSales = todaySales.filter((s) => s.shift === shift);
              if (shiftSales.length === 0) return null;
              const total = getShiftTotal(shift);
              const locked = isShiftLocked(shift);
              const color = SHIFT_COLORS[shift];
              return (
                <View key={shift} style={[styles.shiftGroup, { backgroundColor: theme.card }]}>
                  <View style={[styles.shiftGroupHeader, { borderBottomColor: theme.border }]}>
                    <View style={styles.shiftGroupLeft}>
                      <MaterialIcons name={SHIFT_ICONS[shift] as any} size={16} color={color} />
                      <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>{shift}</Text>
                      {locked && <MaterialIcons name="lock" size={13} color={color} />}
                    </View>
                    <Text style={[styles.shiftGroupTotal, { color }]}>{fmt(total)}</Text>
                  </View>
                  {shiftSales.map((sale) => {
                    const payColor = PAYMENT_COLORS[sale.paymentMethod] ?? "#94a3b8";
                    return (
                      <View
                        key={sale.id}
                        style={[styles.entryRow, { borderBottomColor: theme.border }]}
                      >
                        <View style={styles.entryLeft}>
                          <View style={[styles.paymentChip, { backgroundColor: payColor + "18" }]}>
                            <Text style={[styles.paymentChipText, { color: payColor }]}>
                              {sale.paymentMethod}
                            </Text>
                          </View>
                          {sale.note ? (
                            <Text style={[styles.entryNote, { color: theme.textSecondary }]}>
                              {sale.note}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.entryRight}>
                          <Text style={[styles.entryAmount, { color: payColor }]}>
                            {fmt(sale.amount)}
                          </Text>
                          {!sale.locked && (
                            <View style={styles.entryActions}>
                              <TouchableOpacity onPress={() => handleEdit(sale)}>
                                <MaterialIcons name="edit" size={15} color={theme.primary} />
                              </TouchableOpacity>
                              {isManager && (
                                <TouchableOpacity onPress={() => handleDelete(sale)}>
                                  <MaterialIcons name="delete" size={15} color="#ef4444" />
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                          {sale.locked && <MaterialIcons name="lock" size={13} color={color} />}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
            <MaterialIcons name="point-of-sale" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No sales recorded today
            </Text>
          </View>
        )}
      </View>

      {/* Shift Picker */}
      <Modal visible={showShiftPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowShiftPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Shift</Text>
            {SHIFTS.map((shift) => {
              const locked = isShiftLocked(shift);
              const color = SHIFT_COLORS[shift];
              return (
                <TouchableOpacity
                  key={shift}
                  style={[styles.pickerItem, { borderBottomColor: theme.border }, locked && { opacity: 0.5 }]}
                  onPress={() => { setSelectedShift(shift); setShowShiftPicker(false); }}
                  disabled={locked}
                >
                  <MaterialIcons name={SHIFT_ICONS[shift] as any} size={20} color={color} />
                  <Text style={[styles.pickerItemText, { color: theme.text }]}>{shift}</Text>
                  {locked && <MaterialIcons name="lock" size={14} color="#ef4444" />}
                  {selectedShift === shift && !locked && (
                    <MaterialIcons name="check" size={16} color={theme.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Picker */}
      <Modal visible={showPaymentPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPaymentPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Payment Method</Text>
            {PAYMENT_METHODS.map((method) => {
              const color = PAYMENT_COLORS[method] ?? "#94a3b8";
              return (
                <TouchableOpacity
                  key={method}
                  style={[styles.pickerItem, { borderBottomColor: theme.border }]}
                  onPress={() => { setPaymentMethod(method); setShowPaymentPicker(false); }}
                >
                  <View style={[styles.paymentDot, { backgroundColor: color }]} />
                  <Text style={[styles.pickerItemText, { color: theme.text }]}>{method}</Text>
                  {paymentMethod === method && (
                    <MaterialIcons name="check" size={16} color={theme.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: "#00154f",
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: { color: "#FFD700", fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 4 },
  historyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  historyBtnText: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
  body: { padding: 14 },
  shiftRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  shiftCard: {
    flex: 1, borderRadius: 12, padding: 10,
    alignItems: "center", gap: 3, borderWidth: 1.5,
  },
  shiftIconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  shiftName: { fontSize: 11, fontWeight: "700" },
  shiftTotal: { fontSize: 12, fontWeight: "800" },
  lockBadge: {
    flexDirection: "row", alignItems: "center",
    gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  lockText: { fontSize: 9, fontWeight: "700" },
  lockBtn: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  lockBtnText: { fontSize: 10, fontWeight: "700" },
  form: { borderRadius: 16, padding: 16, marginBottom: 12 },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  fieldLabel: {
    fontSize: 10, fontWeight: "700",
    letterSpacing: 1, marginBottom: 6,
  },
  selector: {
    flexDirection: "row", alignItems: "center",
    gap: 10, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  selectorText: { flex: 1, fontSize: 14, fontWeight: "600" },
  paymentDot: { width: 10, height: 10, borderRadius: 5 },
  lockedWarning: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#ef444418",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  lockedWarningText: { color: "#ef4444", fontSize: 10, fontWeight: "700" },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    gap: 8, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16, padding: 0, fontWeight: "700" },
  currencySign: { fontSize: 16, fontWeight: "700" },
  preview: { fontSize: 13, fontWeight: "700" },
  noteInput: {
    borderWidth: 1.5, borderRadius: 12, padding: 12,
    fontSize: 13, height: 70, textAlignVertical: "top", marginBottom: 14,
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    padding: 15, borderRadius: 12, marginBottom: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    padding: 12, borderRadius: 12,
    borderWidth: 1.5, alignItems: "center",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "600" },
  totalCard: {
    borderRadius: 14, padding: 16,
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", borderWidth: 1.5, marginBottom: 16,
  },
  totalLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  totalValue: { fontSize: 28, fontWeight: "900" },
  viewHistoryBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewHistoryText: { fontSize: 12, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  shiftGroup: { borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  shiftGroupHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 12, borderBottomWidth: 1,
  },
  shiftGroupLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  shiftGroupTitle: { fontSize: 13, fontWeight: "700" },
  shiftGroupTotal: { fontSize: 14, fontWeight: "800" },
  entryRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  entryLeft: { flex: 1, gap: 3 },
  paymentChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  paymentChipText: { fontSize: 11, fontWeight: "700" },
  entryNote: { fontSize: 11 },
  entryRight: { alignItems: "flex-end", gap: 5 },
  entryAmount: { fontSize: 14, fontWeight: "800" },
  entryActions: { flexDirection: "row", gap: 10 },
  emptyBox: { borderRadius: 16, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  pickerCard: { width: "100%", maxWidth: 340, borderRadius: 16, overflow: "hidden" },
  pickerTitle: { fontSize: 15, fontWeight: "800", padding: 16, paddingBottom: 12 },
  pickerItem: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14, borderBottomWidth: 1,
  },
  pickerItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
});
