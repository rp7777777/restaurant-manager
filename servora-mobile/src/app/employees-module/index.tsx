// ============================================
// SERVORA ERP — Employees Module
// Master DB — salary, allowances, tax stored here
// Schedule + Payroll le yahi bata data linya
// ============================================

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Platform, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, doc, updateDoc, deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useApp } from "../../context/AppContext";

// ── Types ────────────────────────────────────
interface Allowance {
  name: string;
  amount: number;
  taxable: boolean;
}

interface Employee {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  joinDate: string;
  basicSalary: number;
  taxRate: number;
  ssRate: number;
  nif: string;
  address: string;
  bankAccount: string;
  allowances: Allowance[];
  active: boolean;
  restaurantId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── Constants ─────────────────────────────────
const POSITIONS = [
  "Chef 3rd", "Chef 2nd", "Head Chef",
  "Waiter/Waitress", "Supervisor", "Cashier",
  "Store Keeper", "Manager",
];

const DEFAULT_ALLOWANCES: Allowance[] = [
  { name: "Food Allowance", amount: 0, taxable: false },
  { name: "Transport Allowance", amount: 0, taxable: false },
  { name: "Housing Allowance", amount: 0, taxable: true },
  { name: "Bonus", amount: 0, taxable: true },
  { name: "Other", amount: 0, taxable: false },
];

// ── Main Screen ───────────────────────────────
export default function EmployeesScreen() {
  const { theme, fmt, restaurantId, userProfile } = useApp();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [empNo, setEmpNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("Waiter/Waitress");
  const [joinDate, setJoinDate] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [taxRate, setTaxRate] = useState("11");
  const [ssRate, setSsRate] = useState("11");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [allowances, setAllowances] = useState<Allowance[]>(DEFAULT_ALLOWANCES);

  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  // ── Load employees ─────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, "restaurants", restaurantId, "employees"),
      orderBy("employeeNo", "asc")
    );
    return onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<Employee, "id">),
      })));
      setLoading(false);
    }, () => setLoading(false));
  }, [restaurantId]);

  // ── Save employee ──────────────────────────
  const handleSave = async () => {
    if (!empNo.trim() || !fullName.trim() || !basicSalary) {
      Alert.alert("Error", "Employee No, Name and Salary required");
      return;
    }
    if (!restaurantId) return;

    // Duplicate check
    const dup = employees.find(
      (e) => e.employeeNo === empNo.trim() && e.id !== editingId
    );
    if (dup) {
      Alert.alert("Duplicate", `Employee No. ${empNo} already exists`);
      return;
    }

    setSaving(true);
    try {
      const data = {
        employeeNo: empNo.trim(),
        fullName: fullName.trim(),
        position,
        joinDate: joinDate.trim(),
        basicSalary: Number(basicSalary),
        taxRate: Number(taxRate) || 11,
        ssRate: Number(ssRate) || 11,
        nif: nif.trim(),
        address: address.trim(),
        bankAccount: bankAccount.trim(),
        allowances,
        active: true,
        restaurantId,
        userId: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "restaurants", restaurantId, "employees", editingId),
          data
        );
        Alert.alert("✅ Updated", `${fullName} updated`);
        setEditingId(null);
      } else {
        await addDoc(
          collection(db, "restaurants", restaurantId, "employees"),
          { ...data, createdAt: serverTimestamp() }
        );
        Alert.alert("✅ Added", `${fullName} added`);
      }
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEmpNo(emp.employeeNo);
    setFullName(emp.fullName);
    setPosition(emp.position);
    setJoinDate(emp.joinDate ?? "");
    setBasicSalary(emp.basicSalary.toString());
    setTaxRate(emp.taxRate.toString());
    setSsRate(emp.ssRate.toString());
    setNif(emp.nif ?? "");
    setAddress(emp.address ?? "");
    setBankAccount(emp.bankAccount ?? "");
    setAllowances(emp.allowances?.length ? emp.allowances : DEFAULT_ALLOWANCES);
    setShowForm(true);
  };

  const handleDelete = (emp: Employee) => {
    Alert.alert("Delete", `Delete ${emp.fullName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "restaurants", restaurantId, "employees", emp.id));
        },
      },
    ]);
  };

  const handleToggleActive = async (emp: Employee) => {
    await updateDoc(
      doc(db, "restaurants", restaurantId, "employees", emp.id),
      { active: !emp.active, updatedAt: serverTimestamp() }
    );
  };

  const updateAllowance = (idx: number, field: keyof Allowance, value: string | boolean) => {
    const updated = [...allowances];
    if (field === "amount") updated[idx] = { ...updated[idx], amount: Number(value) || 0 };
    else if (field === "taxable") updated[idx] = { ...updated[idx], taxable: value as boolean };
    else updated[idx] = { ...updated[idx], name: value as string };
    setAllowances(updated);
  };

  const resetForm = () => {
    setEditingId(null);
    setEmpNo(""); setFullName(""); setPosition("Waiter/Waitress");
    setJoinDate(""); setBasicSalary(""); setTaxRate("11");
    setSsRate("11"); setNif(""); setAddress(""); setBankAccount("");
    setAllowances(DEFAULT_ALLOWANCES);
    setShowForm(false);
  };

  const filtered = employees.filter((e) =>
    e.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
    e.employeeNo?.includes(searchText) ||
    e.position?.toLowerCase().includes(searchText.toLowerCase())
  );

  const activeCount = employees.filter((e) => e.active !== false).length;
  const totalPayroll = employees
    .filter((e) => e.active !== false)
    .reduce((s, e) => s + e.basicSalary, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>EMPLOYEES</Text>
            <Text style={styles.headerSub}>Master Database</Text>
          </View>
          {isManager && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { resetForm(); setShowForm(!showForm); }}
            >
              <MaterialIcons name={showForm ? "close" : "person-add"} size={20} color="#00154f" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="people" size={22} color="#3b82f6" />
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>{activeCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="people-outline" size={22} color="#94a3b8" />
            <Text style={[styles.statValue, { color: "#94a3b8" }]}>{employees.length - activeCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Inactive</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="payments" size={22} color="#10b981" />
            <Text style={[styles.statValue, { color: "#10b981" }]}>{fmt(totalPayroll)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Basic</Text>
          </View>
        </View>

        {/* Add/Edit Form */}
        {showForm && isManager && (
          <View style={[styles.form, { backgroundColor: theme.card }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>
              {editingId ? "✏️ Edit Employee" : "➕ New Employee"}
            </Text>

            {/* Basic Info */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>BASIC INFO</Text>
            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>EMP NO. *</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.bg, borderColor: theme.primary, color: theme.text }]}
                  placeholder="e.g. 001"
                  placeholderTextColor={theme.textSecondary}
                  value={empNo}
                  onChangeText={setEmpNo}
                />
              </View>
              <View style={[styles.halfField, { flex: 2 }]}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>FULL NAME *</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  placeholder="Employee Full Name"
                  placeholderTextColor={theme.textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>POSITION</Text>
            <TouchableOpacity
              style={[styles.selector, { backgroundColor: theme.bg, borderColor: theme.border }]}
              onPress={() => setShowPositionPicker(true)}
            >
              <Text style={[styles.selectorText, { color: theme.text }]}>{position}</Text>
              <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>JOIN DATE</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={theme.textSecondary}
                  value={joinDate}
                  onChangeText={setJoinDate}
                />
              </View>
              <View style={[styles.halfField, { flex: 1.5 }]}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>NIF (Tax ID)</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  placeholder="Tax Number"
                  placeholderTextColor={theme.textSecondary}
                  value={nif}
                  onChangeText={setNif}
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ADDRESS</Text>
            <TextInput
              style={[styles.inputField, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              placeholder="Employee Address"
              placeholderTextColor={theme.textSecondary}
              value={address}
              onChangeText={setAddress}
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BANK ACCOUNT (IBAN)</Text>
            <TextInput
              style={[styles.inputField, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              placeholder="PT50..."
              placeholderTextColor={theme.textSecondary}
              value={bankAccount}
              onChangeText={setBankAccount}
            />

            {/* Salary */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>SALARY & TAX</Text>
            <View style={styles.row3}>
              <View style={styles.thirdField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BASIC SALARY (€) *</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.bg, borderColor: theme.primary, color: theme.text }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={basicSalary}
                  onChangeText={setBasicSalary}
                />
              </View>
              <View style={styles.thirdField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>IRS TAX (%)</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.bg, borderColor: "#ef444440", color: theme.text }]}
                  placeholder="11"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={taxRate}
                  onChangeText={setTaxRate}
                />
              </View>
              <View style={styles.thirdField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SOCIAL SEC. (%)</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.bg, borderColor: "#ef444440", color: theme.text }]}
                  placeholder="11"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={ssRate}
                  onChangeText={setSsRate}
                />
              </View>
            </View>

            {/* Allowances */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>ALLOWANCES</Text>
            <View style={[styles.allowanceHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.allowanceHeaderText, { flex: 2, color: theme.textSecondary }]}>Name</Text>
              <Text style={[styles.allowanceHeaderText, { flex: 1, color: theme.textSecondary }]}>Amount (€)</Text>
              <Text style={[styles.allowanceHeaderText, { flex: 0.7, color: theme.textSecondary }]}>Taxable</Text>
            </View>
            {allowances.map((a, idx) => (
              <View key={idx} style={styles.allowanceRow}>
                <TextInput
                  style={[styles.allowanceInput, { flex: 2, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  value={a.name}
                  onChangeText={(v) => updateAllowance(idx, "name", v)}
                  placeholder="Allowance name"
                  placeholderTextColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.allowanceInput, { flex: 1, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  value={a.amount > 0 ? a.amount.toString() : ""}
                  onChangeText={(v) => updateAllowance(idx, "amount", v)}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.taxToggle, {
                    flex: 0.7,
                    backgroundColor: a.taxable ? "#ef444420" : "#10b98120",
                  }]}
                  onPress={() => updateAllowance(idx, "taxable", !a.taxable)}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: a.taxable ? "#ef4444" : "#10b981" }}>
                    {a.taxable ? "TAXED" : "NO TAX"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Salary preview */}
            <View style={[styles.salaryPreview, { backgroundColor: "#00154f" }]}>
              <Text style={styles.previewTitle}>Monthly Salary Preview</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Basic Salary</Text>
                <Text style={[styles.previewValue, { color: "#FFD700" }]}>{fmt(Number(basicSalary) || 0)}</Text>
              </View>
              {allowances.filter((a) => a.amount > 0).map((a, idx) => (
                <View key={idx} style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{a.name}</Text>
                  <Text style={[styles.previewValue, { color: "#10b981" }]}>{fmt(a.amount)}</Text>
                </View>
              ))}
              <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", marginTop: 6, paddingTop: 6 }]}>
                <Text style={[styles.previewLabel, { color: "#FFD700", fontWeight: "800" }]}>GROSS TOTAL</Text>
                <Text style={[styles.previewValue, { color: "#FFD700", fontSize: 16, fontWeight: "900" }]}>
                  {fmt((Number(basicSalary) || 0) + allowances.reduce((s, a) => s + a.amount, 0))}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Tax ({taxRate}%) + SS ({ssRate}%)</Text>
                <Text style={[styles.previewValue, { color: "#ef4444" }]}>
                  -{fmt(((Number(basicSalary) || 0) * (Number(taxRate) + Number(ssRate))) / 100)}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: "#10b981", fontWeight: "800" }]}>EST. NET</Text>
                <Text style={[styles.previewValue, { color: "#10b981", fontSize: 15, fontWeight: "900" }]}>
                  {fmt(
                    (Number(basicSalary) || 0) +
                    allowances.reduce((s, a) => s + a.amount, 0) -
                    ((Number(basicSalary) || 0) * (Number(taxRate) + Number(ssRate))) / 100
                  )}
                </Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.formBtns}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="save" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>{editingId ? "UPDATE" : "SAVE EMPLOYEE"}</Text>
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

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <MaterialIcons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search employees..."
            placeholderTextColor={theme.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Employee List */}
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : filtered.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
            <MaterialIcons name="people-outline" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {employees.length === 0 ? "No employees yet" : "No results found"}
            </Text>
            {employees.length === 0 && isManager && (
              <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>
                Add employees to use in Schedule & Payroll
              </Text>
            )}
          </View>
        ) : (
          filtered.map((emp) => {
            const isExpanded = expandedId === emp.id;
            const totalAllowances = emp.allowances?.reduce((s, a) => s + a.amount, 0) ?? 0;
            const grossTotal = emp.basicSalary + totalAllowances;

            return (
              <View key={emp.id} style={[styles.empCard, { backgroundColor: theme.card },
                !emp.active && { opacity: 0.6 }]}>

                {/* Card header */}
                <TouchableOpacity
                  style={styles.empCardHeader}
                  onPress={() => setExpandedId(isExpanded ? null : emp.id)}
                >
                  <View style={styles.empAvatarBox}>
                    <Text style={styles.empAvatarText}>
                      {emp.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <View style={styles.empInfo}>
                    <View style={styles.empNameRow}>
                      <Text style={[styles.empName, { color: theme.text }]}>{emp.fullName}</Text>
                      {!emp.active && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.empPosition, { color: theme.textSecondary }]}>
                      No. {emp.employeeNo} · {emp.position}
                    </Text>
                  </View>
                  <View style={styles.empRight}>
                    <Text style={[styles.empSalary, { color: "#10b981" }]}>
                      {fmt(emp.basicSalary)}
                    </Text>
                    <Text style={[styles.empSalaryLabel, { color: theme.textSecondary }]}>basic</Text>
                    <MaterialIcons
                      name={isExpanded ? "expand-less" : "expand-more"}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded details */}
                {isExpanded && (
                  <View style={[styles.empDetails, { borderTopColor: theme.border }]}>
                    {/* Summary */}
                    <View style={styles.empSummaryRow}>
                      {[
                        { label: "Basic", value: fmt(emp.basicSalary), color: theme.text },
                        { label: "Allowances", value: fmt(totalAllowances), color: "#3b82f6" },
                        { label: "Gross", value: fmt(grossTotal), color: "#f59e0b" },
                        { label: "Tax+SS", value: `${emp.taxRate + emp.ssRate}%`, color: "#ef4444" },
                      ].map(({ label, value, color }) => (
                        <View key={label} style={styles.empSummaryItem}>
                          <Text style={[styles.empSummaryLabel, { color: theme.textSecondary }]}>{label}</Text>
                          <Text style={[styles.empSummaryValue, { color }]}>{value}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Contact info */}
                    {(emp.nif || emp.address || emp.bankAccount) && (
                      <View style={[styles.contactBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        {emp.nif ? <Text style={[styles.contactText, { color: theme.textSecondary }]}>NIF: {emp.nif}</Text> : null}
                        {emp.address ? <Text style={[styles.contactText, { color: theme.textSecondary }]}>📍 {emp.address}</Text> : null}
                        {emp.bankAccount ? <Text style={[styles.contactText, { color: theme.textSecondary }]}>🏦 {emp.bankAccount}</Text> : null}
                        {emp.joinDate ? <Text style={[styles.contactText, { color: theme.textSecondary }]}>📅 Joined: {emp.joinDate}</Text> : null}
                      </View>
                    )}

                    {/* Allowances list */}
                    {emp.allowances?.filter((a) => a.amount > 0).length > 0 && (
                      <View style={styles.allowancesList}>
                        {emp.allowances.filter((a) => a.amount > 0).map((a, idx) => (
                          <View key={idx} style={styles.allowanceListItem}>
                            <Text style={[styles.allowanceListName, { color: theme.text }]}>{a.name}</Text>
                            <Text style={[styles.allowanceListAmount, { color: "#3b82f6" }]}>{fmt(a.amount)}</Text>
                            <View style={[styles.taxBadge, { backgroundColor: a.taxable ? "#ef444420" : "#10b98120" }]}>
                              <Text style={{ fontSize: 9, color: a.taxable ? "#ef4444" : "#10b981", fontWeight: "700" }}>
                                {a.taxable ? "TAXED" : "NO TAX"}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Actions */}
                    {isManager && (
                      <View style={styles.empActions}>
                        <TouchableOpacity
                          style={[styles.empActionBtn, { borderColor: theme.primary }]}
                          onPress={() => handleEdit(emp)}
                        >
                          <MaterialIcons name="edit" size={14} color={theme.primary} />
                          <Text style={[styles.empActionText, { color: theme.primary }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.empActionBtn, { borderColor: emp.active !== false ? "#f59e0b" : "#10b981" }]}
                          onPress={() => handleToggleActive(emp)}
                        >
                          <MaterialIcons
                            name={emp.active !== false ? "pause-circle-outline" : "play-circle-outline"}
                            size={14}
                            color={emp.active !== false ? "#f59e0b" : "#10b981"}
                          />
                          <Text style={[styles.empActionText, { color: emp.active !== false ? "#f59e0b" : "#10b981" }]}>
                            {emp.active !== false ? "Deactivate" : "Activate"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.empActionBtn, { borderColor: "#ef4444" }]}
                          onPress={() => handleDelete(emp)}
                        >
                          <MaterialIcons name="delete" size={14} color="#ef4444" />
                          <Text style={[styles.empActionText, { color: "#ef4444" }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Position Picker */}
      <Modal visible={showPositionPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPositionPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Position</Text>
            <ScrollView>
              {POSITIONS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pickerItem, { borderBottomColor: theme.border },
                    position === p && { backgroundColor: theme.sidebarActive }]}
                  onPress={() => { setPosition(p); setShowPositionPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: theme.text }]}>{p}</Text>
                  {position === p && <MaterialIcons name="check" size={14} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  body: { padding: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 16, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600" },
  form: { borderRadius: 16, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 5 },
  inputField: {
    borderWidth: 1.5, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, marginBottom: 10,
  },
  selector: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  selectorText: { flex: 1, fontSize: 13 },
  row2: { flexDirection: "row", gap: 8 },
  row3: { flexDirection: "row", gap: 8 },
  halfField: { flex: 1 },
  thirdField: { flex: 1 },
  allowanceHeader: {
    flexDirection: "row", gap: 6,
    paddingBottom: 4, borderBottomWidth: 1, marginBottom: 6,
  },
  allowanceHeaderText: { fontSize: 10, fontWeight: "700" },
  allowanceRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  allowanceInput: {
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 8, fontSize: 12,
  },
  taxToggle: {
    borderRadius: 6, alignItems: "center",
    justifyContent: "center", paddingVertical: 8,
  },
  salaryPreview: { borderRadius: 14, padding: 14, marginBottom: 14 },
  previewTitle: { color: "#FFD700", fontSize: 12, fontWeight: "800", marginBottom: 8 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  previewLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  previewValue: { fontSize: 12, fontWeight: "700" },
  formBtns: { flexDirection: "row", gap: 10 },
  saveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, padding: 13, borderRadius: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  cancelBtn: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  cancelBtnText: { fontSize: 13, fontWeight: "600" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontWeight: "700" },
  emptySubText: { fontSize: 12, textAlign: "center" },
  empCard: { borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  empCardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  empAvatarBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#00154f", alignItems: "center", justifyContent: "center",
  },
  empAvatarText: { color: "#FFD700", fontSize: 18, fontWeight: "900" },
  empInfo: { flex: 1 },
  empNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  empName: { fontSize: 14, fontWeight: "700" },
  inactiveBadge: {
    backgroundColor: "#94a3b820", paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  inactiveBadgeText: { color: "#94a3b8", fontSize: 9, fontWeight: "700" },
  empPosition: { fontSize: 11, marginTop: 2 },
  empRight: { alignItems: "flex-end", gap: 2 },
  empSalary: { fontSize: 15, fontWeight: "800" },
  empSalaryLabel: { fontSize: 10 },
  empDetails: { padding: 14, paddingTop: 10, borderTopWidth: 1, gap: 10 },
  empSummaryRow: { flexDirection: "row" },
  empSummaryItem: { flex: 1, alignItems: "center" },
  empSummaryLabel: { fontSize: 9, fontWeight: "600", marginBottom: 2 },
  empSummaryValue: { fontSize: 12, fontWeight: "800" },
  contactBox: {
    borderRadius: 8, padding: 10, borderWidth: 1, gap: 4,
  },
  contactText: { fontSize: 11 },
  allowancesList: { gap: 6 },
  allowanceListItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  allowanceListName: { flex: 2, fontSize: 12 },
  allowanceListAmount: { flex: 1, fontSize: 12, fontWeight: "700", textAlign: "right" },
  taxBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  empActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  empActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  empActionText: { fontSize: 12, fontWeight: "600" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  pickerCard: { width: "100%", maxWidth: 340, borderRadius: 16, overflow: "hidden", maxHeight: 380 },
  pickerTitle: { fontSize: 15, fontWeight: "800", padding: 16, paddingBottom: 8 },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
});