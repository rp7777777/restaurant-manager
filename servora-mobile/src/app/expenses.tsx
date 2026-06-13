// ============================================
// SERVORA ERP — Expenses Screen
// Real-time Firebase + Theme + Validation
// ============================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Platform, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, addDoc, onSnapshot,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useApp } from "../context/AppContext";

// ── Types ────────────────────────────────────
interface Expense {
  id: string;
  expenseName: string;
  category: string;
  amount: number;
  note: string;
  createdAt: any;
  userId: string;
}

// ── Categories ───────────────────────────────
const CATEGORIES = [
  "Ingredients", "Utilities", "Staff", "Rent",
  "Equipment", "Cleaning", "Marketing", "Other",
];

export default function ExpensesScreen() {
  const { theme } = useApp();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [expenseName, setExpenseName] = useState("");
  const [category, setCategory] = useState("Ingredients");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // ── Load expenses real-time ──────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "expenses"), orderBy("createdAt", "desc")),
      (snap) => {
        const data: Expense[] = [];
        snap.forEach((d) => {
          data.push({ id: d.id, ...d.data() } as Expense);
        });
        setExpenses(data);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      }
    );
    return unsub;
  }, []);

  // ── Save expense ─────────────────────────
  const handleSave = async () => {
    if (!expenseName.trim()) {
      Alert.alert("Error", "Enter expense name");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert("Error", "Enter valid amount");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "expenses"), {
        userId: auth.currentUser?.uid ?? "",
        expenseName: expenseName.trim(),
        category,
        amount: Number(amount),
        note: note.trim(),
        createdAt: serverTimestamp(),
      });

      setExpenseName("");
      setCategory("Ingredients");
      setAmount("");
      setNote("");
      setShowForm(false);
      Alert.alert("✅ Success", `€${Number(amount).toFixed(2)} expense saved!`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = useCallback(() => setRefreshing(true), []);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const formatDate = (ts: any): string => {
    if (!ts) return "";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch { return ""; }
  };

  const getCategoryColor = (cat: string): string => {
    const colors: Record<string, string> = {
      Ingredients: "#10b981", Utilities: "#3b82f6",
      Staff: "#8b5cf6", Rent: "#f59e0b",
      Equipment: "#06b6d4", Cleaning: "#84cc16",
      Marketing: "#ec4899", Other: "#94a3b8",
    };
    return colors[cat] ?? "#94a3b8";
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>EXPENSES</Text>
            <Text style={styles.headerSub}>Restaurant Expense Management</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowForm(!showForm)}
          >
            <MaterialIcons name={showForm ? "close" : "add"} size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>

        {/* Total card */}
        <View style={[styles.totalCard, { backgroundColor: theme.card }]}>
          <View>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
              Total Expenses
            </Text>
            <Text style={styles.totalValue}>
              €{totalExpenses.toLocaleString("en-IE", { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.totalCount, { color: theme.textSecondary }]}>
              {expenses.length} records
            </Text>
          </View>
          <MaterialIcons name="receipt" size={44} color="#ef444430" />
        </View>

        {/* Add Form */}
        {showForm && (
          <View style={[styles.form, { backgroundColor: theme.card }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>
              Add New Expense
            </Text>

            {/* Expense Name */}
            <View style={[styles.inputWrapper, {
              backgroundColor: theme.bg, borderColor: theme.border,
            }]}>
              <MaterialIcons name="label" size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Expense Name"
                placeholderTextColor={theme.textSecondary}
                value={expenseName}
                onChangeText={setExpenseName}
              />
            </View>

            {/* Category */}
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              CATEGORY
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                const color = getCategoryColor(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: active ? color : theme.bg,
                        borderColor: color,
                      },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      { color: active ? "#fff" : color },
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Amount */}
            <View style={[styles.inputWrapper, {
              backgroundColor: theme.bg, borderColor: theme.border,
            }]}>
              <Text style={[styles.currencySign, { color: theme.textSecondary }]}>€</Text>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Amount"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {/* Note */}
            <TextInput
              style={[styles.noteInput, {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              }]}
              placeholder="Note (optional)"
              placeholderTextColor={theme.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: "#ef4444" }, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>SAVE EXPENSE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Expense List */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Expense History
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : expenses.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
            <MaterialIcons name="receipt-long" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No expenses yet
            </Text>
          </View>
        ) : (
          expenses.map((expense) => {
            const color = getCategoryColor(expense.category);
            return (
              <View
                key={expense.id}
                style={[styles.expenseCard, { backgroundColor: theme.card }]}
              >
                <View style={styles.expenseLeft}>
                  <View style={[styles.expenseIcon, { backgroundColor: color + "18" }]}>
                    <MaterialIcons name="receipt" size={18} color={color} />
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={[styles.expenseName, { color: theme.text }]}>
                      {expense.expenseName}
                    </Text>
                    <View style={styles.expenseMeta}>
                      <View style={[styles.categoryBadge, { backgroundColor: color + "18" }]}>
                        <Text style={[styles.categoryBadgeText, { color }]}>
                          {expense.category}
                        </Text>
                      </View>
                      <Text style={[styles.expenseDate, { color: theme.textSecondary }]}>
                        {formatDate(expense.createdAt)}
                      </Text>
                    </View>
                    {expense.note ? (
                      <Text style={[styles.expenseNote, { color: theme.textSecondary }]}>
                        {expense.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.expenseAmount}>
                  €{Number(expense.amount).toFixed(2)}
                </Text>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: "#00154f",
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFD700",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 3,
  },
  addBtn: {
    backgroundColor: "#ef4444",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 14 },
  totalCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: { fontSize: 12, fontWeight: "600" },
  totalValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ef4444",
    marginTop: 4,
  },
  totalCount: { fontSize: 12, marginTop: 2 },
  form: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },
  currencySign: { fontSize: 16, fontWeight: "700" },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  categoryScroll: { marginBottom: 12 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    marginRight: 8,
  },
  categoryChipText: { fontSize: 12, fontWeight: "600" },
  noteInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    height: 70,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  emptyBox: {
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 14 },
  expenseCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  expenseLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  expenseIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 14, fontWeight: "700" },
  expenseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryBadgeText: { fontSize: 10, fontWeight: "700" },
  expenseDate: { fontSize: 11 },
  expenseNote: { fontSize: 12, marginTop: 3 },
  expenseAmount: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ef4444",
  },
});
