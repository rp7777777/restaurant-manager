// ============================================
// SERVORA ERP — Payroll Module
// Auto calculate + PDF salary slip
// Connected with schedule attendance
// ============================================

import React, { useEffect, useState, useCallback } from "react";
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
  serverTimestamp, where,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useApp } from "../../context/AppContext";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ── Types ────────────────────────────────────
type PaymentFrequency = "MONTHLY" | "WEEKLY" | "HOURLY";
type SlipFormat = "FORMAT_1" | "FORMAT_2";

interface AllowanceItem {
  name: string;
  amount: number;
  taxable: boolean;
}

interface PayrollRecord {
  id: string;
  employeeNo: string;
  employeeName: string;
  position: string;
  nif: string;
  address: string;
  month: string;
  paymentFrequency: PaymentFrequency;
  basicSalary: number;
  workingDays: number;
  totalDays: number;
  overtimeHours: number;
  overtimeRate: number;
  holidayDays: number;
  holidayRate: number;
  allowances: AllowanceItem[];
  grossSalary: number;
  taxRate: number;
  taxAmount: number;
  socialSecurityRate: number;
  socialSecurityAmount: number;
  otherDeductions: number;
  netSalary: number;
  restaurantId: string;
  userId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── Constants ─────────────────────────────────
const MONTHS_LIST = [
  "Jan-2026","Feb-2026","Mar-2026","Apr-2026","May-2026","Jun-2026",
  "Jul-2026","Aug-2026","Sep-2026","Oct-2026","Nov-2026","Dec-2026",
];

const DEFAULT_ALLOWANCES: AllowanceItem[] = [
  { name: "Food Allowance", amount: 0, taxable: false },
  { name: "Transport Allowance", amount: 0, taxable: false },
  { name: "Housing Allowance", amount: 0, taxable: true },
  { name: "Bonus", amount: 0, taxable: true },
  { name: "Other Allowance", amount: 0, taxable: true },
];

const POSITIONS = [
  "COZINHEIRO(A) 3ª","COZINHEIRO(A) 2ª","CHEFE DE COZINHA",
  "EMPREGADO(A) DE MESA","SUPERVISOR(A)","CAIXA","ARMAZÉM","GERENTE",
];

// ── Calculation engine ────────────────────────
function calculatePayroll(params: {
  basicSalary: number;
  workingDays: number;
  totalDays: number;
  overtimeHours: number;
  overtimeRate: number;
  holidayDays: number;
  holidayRate: number;
  allowances: AllowanceItem[];
  taxRate: number;
  socialSecurityRate: number;
  otherDeductions: number;
}) {
  const {
    basicSalary, workingDays, totalDays,
    overtimeHours, overtimeRate, holidayDays, holidayRate,
    allowances, taxRate, socialSecurityRate, otherDeductions,
  } = params;

  // Daily rate
  const dailyRate = totalDays > 0 ? basicSalary / totalDays : 0;

  // Actual earned (based on days worked)
  const earnedBasic = dailyRate * workingDays;

  // Overtime
  const hourlyRate = basicSalary / (totalDays * 8);
  const overtimePay = overtimeHours * hourlyRate * overtimeRate;

  // Holiday pay
  const holidayPay = holidayDays * dailyRate * holidayRate;

  // Taxable allowances
  const taxableAllowances = allowances
    .filter((a) => a.taxable)
    .reduce((s, a) => s + a.amount, 0);

  const nonTaxableAllowances = allowances
    .filter((a) => !a.taxable)
    .reduce((s, a) => s + a.amount, 0);

  // Gross = earned basic + overtime + holiday + all allowances
  const grossSalary = earnedBasic + overtimePay + holidayPay
    + taxableAllowances + nonTaxableAllowances;

  // Taxable base (gross - non-taxable)
  const taxableBase = earnedBasic + overtimePay + holidayPay + taxableAllowances;

  // Deductions
  const taxAmount = (taxableBase * taxRate) / 100;
  const socialSecurityAmount = (grossSalary * socialSecurityRate) / 100;

  // Net
  const netSalary = grossSalary - taxAmount - socialSecurityAmount - otherDeductions;

  return {
    earnedBasic: Math.round(earnedBasic * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    holidayPay: Math.round(holidayPay * 100) / 100,
    grossSalary: Math.round(grossSalary * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    socialSecurityAmount: Math.round(socialSecurityAmount * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
  };
}

// ── PDF Generator ─────────────────────────────
async function generateSalarySlipPDF(
  record: PayrollRecord,
  restaurant: any,
  format: SlipFormat
) {
  const calc = calculatePayroll({
    basicSalary: record.basicSalary,
    workingDays: record.workingDays,
    totalDays: record.totalDays,
    overtimeHours: record.overtimeHours,
    overtimeRate: record.overtimeRate,
    holidayDays: record.holidayDays,
    holidayRate: record.holidayRate,
    allowances: record.allowances,
    taxRate: record.taxRate,
    socialSecurityRate: record.socialSecurityRate,
    otherDeductions: record.otherDeductions,
  });

  const fmt = (n: number) => `€${n.toFixed(2)}`;
  const restName = restaurant?.name ?? "SERVORA ERP";
  const restAddress = restaurant?.address ?? "";
  const restNif = restaurant?.vatNumber ?? "";

  // Salary rows
  const rows = [
    { no: 1, head: "Basic Salary", amount: record.basicSalary, days: record.workingDays, tax: record.taxRate, deduction: record.taxAmount, afterTax: calc.earnedBasic },
    ...record.allowances.filter((a) => a.amount > 0).map((a, i) => ({
      no: i + 2,
      head: a.name,
      amount: a.amount,
      days: record.workingDays,
      tax: a.taxable ? record.taxRate : 0,
      deduction: a.taxable ? (a.amount * record.taxRate / 100) : 0,
      afterTax: a.taxable ? a.amount - (a.amount * record.taxRate / 100) : a.amount,
    })),
  ];

  if (record.overtimeHours > 0) {
    rows.push({
      no: rows.length + 1,
      head: `Overtime (${record.overtimeHours}h × ${record.overtimeRate}x)`,
      amount: calc.overtimePay,
      days: record.workingDays,
      tax: record.taxRate,
      deduction: calc.overtimePay * record.taxRate / 100,
      afterTax: calc.overtimePay - (calc.overtimePay * record.taxRate / 100),
    });
  }

  const rowsHtml = rows.map((r) => `
    <tr>
      <td>${r.no}</td>
      <td>${r.head}</td>
      <td style="text-align:right">€${r.amount.toFixed(2)}</td>
      <td style="text-align:center">${r.days} Days</td>
      <td style="text-align:center">${r.tax}%</td>
      <td style="text-align:right">€${r.deduction.toFixed(2)}</td>
      <td style="text-align:right">€${r.afterTax.toFixed(2)}</td>
    </tr>
  `).join("");

  // Format 1 or 2 (2 copies side by side like Excel)
  const slipHtml = `
    <div style="width:48%;display:inline-block;vertical-align:top;padding:10px;border:1px solid #ddd;font-size:11px">
      <table style="width:100%;margin-bottom:8px;font-size:10px">
        <tr>
          <td colspan="2" style="font-size:13px;font-weight:bold;color:#00154f">${restName}</td>
        </tr>
        <tr><td>${restAddress}</td></tr>
        <tr><td>N.I.F: ${restNif}</td></tr>
      </table>
      <table style="width:100%;margin-bottom:8px;font-size:10px">
        <tr>
          <td style="width:50%"><strong>MONTH</strong></td>
          <td>${record.month}</td>
        </tr>
        <tr>
          <td><strong>${record.employeeName}</strong></td>
          <td>N.I.F: ${record.nif}</td>
        </tr>
        <tr>
          <td colspan="2">${record.address}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <tr style="background:#00154f;color:#FFD700">
          <th>No</th><th>Salary Head</th><th>Amount</th><th>Qty</th><th>Tax%</th><th>Deduction</th><th>After Tax</th>
        </tr>
        ${rowsHtml}
        <tr style="background:#f0f0f0;font-weight:bold">
          <td colspan="2">TOTAL</td>
          <td style="text-align:right">${fmt(calc.grossSalary)}</td>
          <td></td>
          <td></td>
          <td style="text-align:right">${fmt(calc.taxAmount + calc.socialSecurityAmount + record.otherDeductions)}</td>
          <td style="text-align:right">${fmt(calc.netSalary)}</td>
        </tr>
      </table>
      <table style="width:100%;margin-top:8px;font-size:11px">
        <tr><td><strong>Gross:</strong></td><td style="text-align:right">${fmt(calc.grossSalary)}</td></tr>
        <tr><td><strong>Net:</strong></td><td style="text-align:right;color:green;font-size:13px;font-weight:bold">${fmt(calc.netSalary)}</td></tr>
        <tr><td>Tax ${record.taxRate}%:</td><td style="text-align:right">${fmt(calc.taxAmount)}</td></tr>
        ${record.socialSecurityRate > 0 ? `<tr><td>Social Security ${record.socialSecurityRate}%:</td><td style="text-align:right">${fmt(calc.socialSecurityAmount)}</td></tr>` : ""}
      </table>
      <div style="margin-top:20px">Signature: ___________________</div>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><style>
      body { font-family: Arial; margin: 15px; }
      table { border-collapse: collapse; }
      td, th { padding: 4px 6px; border: 1px solid #ddd; }
    </style></head>
    <body>
      <div style="display:flex;gap:2%">
        ${slipHtml}
        ${slipHtml}
      </div>
    </body>
    </html>
  `;

  if (Platform.OS === "web") {
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  } else {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Salary Slip — ${record.employeeName}`,
    });
  }
}

// ── Main Screen ───────────────────────────────
export default function PayrollScreen() {
  const { theme, fmt, restaurant, restaurantId, userProfile } = useApp();

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS_LIST[5]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  // Form state
  const [empNo, setEmpNo] = useState("");
  const [empName, setEmpName] = useState("");
  const [position, setPosition] = useState("COZINHEIRO(A) 3ª");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const [payFreq, setPayFreq] = useState<PaymentFrequency>("MONTHLY");
  const [basicSalary, setBasicSalary] = useState("");
  const [workingDays, setWorkingDays] = useState("22");
  const [totalDays, setTotalDays] = useState("30");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [overtimeRate, setOvertimeRate] = useState("1.5");
  const [holidayDays, setHolidayDays] = useState("0");
  const [holidayRate, setHolidayRate] = useState("2.0");
  const [allowances, setAllowances] = useState<AllowanceItem[]>(DEFAULT_ALLOWANCES);
  const [taxRate, setTaxRate] = useState("11");
  const [socialSecurityRate, setSocialSecurityRate] = useState("11");
  const [otherDeductions, setOtherDeductions] = useState("0");

  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  // ── Load payroll ──────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
     collection(db, "restaurants", restaurantId, "payroll"),
     where("month", "==", selectedMonth)
    );
    return onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    }, () => setLoading(false));
  }, [restaurantId, selectedMonth]);

  // ── Live calculation preview ──────────────
  const liveCalc = calculatePayroll({
    basicSalary: Number(basicSalary) || 0,
    workingDays: Number(workingDays) || 22,
    totalDays: Number(totalDays) || 30,
    overtimeHours: Number(overtimeHours) || 0,
    overtimeRate: Number(overtimeRate) || 1.5,
    holidayDays: Number(holidayDays) || 0,
    holidayRate: Number(holidayRate) || 2,
    allowances,
    taxRate: Number(taxRate) || 0,
    socialSecurityRate: Number(socialSecurityRate) || 0,
    otherDeductions: Number(otherDeductions) || 0,
  });

  // ── Update allowance ──────────────────────
  const updateAllowance = (idx: number, field: keyof AllowanceItem, value: string | boolean) => {
    const updated = [...allowances];
    if (field === "amount") {
      updated[idx] = { ...updated[idx], amount: Number(value) || 0 };
    } else if (field === "taxable") {
      updated[idx] = { ...updated[idx], taxable: value as boolean };
    } else {
      updated[idx] = { ...updated[idx], name: value as string };
    }
    setAllowances(updated);
  };

  // ── Save payroll ──────────────────────────
  const handleSave = async () => {
    if (!empName.trim() || !basicSalary) {
      Alert.alert("Error", "Employee name and basic salary required");
      return;
    }
    if (!restaurantId) return;

    // Check duplicate
    const duplicate = records.find(
      (r) => r.employeeNo === empNo.trim() && r.id !== editingId
    );
    if (duplicate) {
      Alert.alert("Duplicate", `${empName} already has a slip for ${selectedMonth}`);
      return;
    }

    setSaving(true);
    try {
      const data: Omit<PayrollRecord, "id"> = {
        employeeNo: empNo.trim(),
        employeeName: empName.trim(),
        position,
        nif: nif.trim(),
        address: address.trim(),
        month: selectedMonth,
        paymentFrequency: payFreq,
        basicSalary: Number(basicSalary),
        workingDays: Number(workingDays) || 22,
        totalDays: Number(totalDays) || 30,
        overtimeHours: Number(overtimeHours) || 0,
        overtimeRate: Number(overtimeRate) || 1.5,
        holidayDays: Number(holidayDays) || 0,
        holidayRate: Number(holidayRate) || 2,
        allowances,
        grossSalary: liveCalc.grossSalary,
        taxRate: Number(taxRate) || 0,
        taxAmount: liveCalc.taxAmount,
        socialSecurityRate: Number(socialSecurityRate) || 0,
        socialSecurityAmount: liveCalc.socialSecurityAmount,
        otherDeductions: Number(otherDeductions) || 0,
        netSalary: liveCalc.netSalary,
        restaurantId,
        userId: auth.currentUser?.uid ?? "",
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "restaurants", restaurantId, "payroll", editingId),
          data
        );
        Alert.alert("✅ Updated", `${empName} salary slip updated`);
        setEditingId(null);
      } else {
        await addDoc(
          collection(db, "restaurants", restaurantId, "payroll"),
          { ...data, createdAt: serverTimestamp() }
        );
        Alert.alert("✅ Saved", `Salary slip created for ${empName}`);
      }
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rec: PayrollRecord) => {
    setEditingId(rec.id);
    setEmpNo(rec.employeeNo);
    setEmpName(rec.employeeName);
    setPosition(rec.position);
    setNif(rec.nif);
    setAddress(rec.address);
    setPayFreq(rec.paymentFrequency);
    setBasicSalary(rec.basicSalary.toString());
    setWorkingDays(rec.workingDays.toString());
    setTotalDays(rec.totalDays.toString());
    setOvertimeHours(rec.overtimeHours.toString());
    setOvertimeRate(rec.overtimeRate.toString());
    setHolidayDays(rec.holidayDays.toString());
    setHolidayRate(rec.holidayRate.toString());
    setAllowances(rec.allowances ?? DEFAULT_ALLOWANCES);
    setTaxRate(rec.taxRate.toString());
    setSocialSecurityRate(rec.socialSecurityRate.toString());
    setOtherDeductions(rec.otherDeductions.toString());
    setShowForm(true);
  };

  const handleDelete = (rec: PayrollRecord) => {
    Alert.alert("Delete", `Delete ${rec.employeeName}'s salary slip?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "restaurants", restaurantId, "payroll", rec.id));
        },
      },
    ]);
  };

  const handleGeneratePDF = async (rec: PayrollRecord) => {
    setGeneratingPdfId(rec.id);
    try {
      await generateSalarySlipPDF(rec, restaurant, "FORMAT_1");
    } catch (err) {
      Alert.alert("Error", "Failed to generate PDF");
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setEmpNo(""); setEmpName(""); setPosition("COZINHEIRO(A) 3ª");
    setNif(""); setAddress(""); setPayFreq("MONTHLY");
    setBasicSalary(""); setWorkingDays("22"); setTotalDays("30");
    setOvertimeHours("0"); setOvertimeRate("1.5");
    setHolidayDays("0"); setHolidayRate("2.0");
    setAllowances(DEFAULT_ALLOWANCES);
    setTaxRate("11"); setSocialSecurityRate("11"); setOtherDeductions("0");
    setShowForm(false);
  };

  const totalPayroll = records.reduce((s, r) => s + r.netSalary, 0);
  const totalGross = records.reduce((s, r) => s + r.grossSalary, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ── */}
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>PAYROLL</Text>
            <Text style={styles.headerSub}>Salary Management</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Month selector */}
            <TouchableOpacity
              style={styles.monthBtn}
              onPress={() => setShowMonthPicker(true)}
            >
              <MaterialIcons name="calendar-today" size={14} color="#00154f" />
              <Text style={styles.monthBtnText}>{selectedMonth}</Text>
              <MaterialIcons name="arrow-drop-down" size={16} color="#00154f" />
            </TouchableOpacity>
            {isManager && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { resetForm(); setShowForm(!showForm); }}
              >
                <MaterialIcons name={showForm ? "close" : "add"} size={20} color="#00154f" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="people" size={22} color="#3b82f6" />
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>{records.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Employees</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="payments" size={22} color="#f59e0b" />
            <Text style={[styles.statValue, { color: "#f59e0b" }]}>{fmt(totalGross)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Gross Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <MaterialIcons name="account-balance-wallet" size={22} color="#10b981" />
            <Text style={[styles.statValue, { color: "#10b981" }]}>{fmt(totalPayroll)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Net Total</Text>
          </View>
        </View>

        {/* ── Add/Edit Form ── */}
        {showForm && isManager && (
          <View style={[styles.form, { backgroundColor: theme.card }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>
              {editingId ? "✏️ Edit Salary Slip" : "➕ New Salary Slip"}
            </Text>

            {/* Employee info */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>EMPLOYEE INFO</Text>
            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>EMP NO.</Text>
                <View style={[styles.inputWrap, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput style={[styles.input, { color: theme.text }]} placeholder="e.g. 24020"
                    placeholderTextColor={theme.textSecondary} value={empNo} onChangeText={setEmpNo} />
                </View>
              </View>
              <View style={[styles.halfField, { flex: 2 }]}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>FULL NAME *</Text>
                <View style={[styles.inputWrap, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput style={[styles.input, { color: theme.text }]} placeholder="Employee Name"
                    placeholderTextColor={theme.textSecondary} value={empName} onChangeText={setEmpName} />
                </View>
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
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>NIF</Text>
                <View style={[styles.inputWrap, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput style={[styles.input, { color: theme.text }]} placeholder="Tax ID"
                    placeholderTextColor={theme.textSecondary} value={nif} onChangeText={setNif} />
                </View>
              </View>
              <View style={[styles.halfField, { flex: 2 }]}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ADDRESS</Text>
                <View style={[styles.inputWrap, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput style={[styles.input, { color: theme.text }]} placeholder="Address"
                    placeholderTextColor={theme.textSecondary} value={address} onChangeText={setAddress} />
                </View>
              </View>
            </View>

            {/* Salary basis */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>SALARY BASIS</Text>
            <View style={styles.row3}>
              {[
                { key: "basicSalary", label: "Basic Salary (€) *", val: basicSalary, set: setBasicSalary },
                { key: "workingDays", label: "Working Days", val: workingDays, set: setWorkingDays },
                { key: "totalDays", label: "Total Days/Month", val: totalDays, set: setTotalDays },
              ].map(({ key, label, val, set }) => (
                <View key={key} style={styles.thirdField}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <View style={[styles.inputWrap, {
                    backgroundColor: theme.bg,
                    borderColor: key === "basicSalary" ? theme.primary : theme.border,
                  }]}>
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={val}
                      onChangeText={set}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Overtime + Holiday */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>OVERTIME & HOLIDAY</Text>
            <View style={styles.row2}>
              {[
                { label: "OT Hours", val: overtimeHours, set: setOvertimeHours },
                { label: "OT Rate (×)", val: overtimeRate, set: setOvertimeRate },
                { label: "Holiday Days", val: holidayDays, set: setHolidayDays },
                { label: "Holiday Rate (×)", val: holidayRate, set: setHolidayRate },
              ].map(({ label, val, set }) => (
                <View key={label} style={styles.quarterField}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <View style={[styles.inputWrap, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <TextInput style={[styles.input, { color: theme.text }]}
                      placeholder="0" placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad" value={val} onChangeText={set} />
                  </View>
                </View>
              ))}
            </View>

            {/* Allowances */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>ALLOWANCES</Text>
            {allowances.map((a, idx) => (
              <View key={idx} style={styles.allowanceRow}>
                <View style={[styles.inputWrap, { flex: 2, backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <TextInput style={[styles.input, { color: theme.text, fontSize: 12 }]}
                    placeholder="Allowance name" placeholderTextColor={theme.textSecondary}
                    value={a.name} onChangeText={(v) => updateAllowance(idx, "name", v)} />
                </View>
                <View style={[styles.inputWrap, { flex: 1, backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={[{ color: theme.textSecondary, fontSize: 12 }]}>€</Text>
                  <TextInput style={[styles.input, { color: theme.text }]}
                    placeholder="0" placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={a.amount > 0 ? a.amount.toString() : ""}
                    onChangeText={(v) => updateAllowance(idx, "amount", v)} />
                </View>
                <TouchableOpacity
                  style={[styles.taxToggle, { backgroundColor: a.taxable ? "#ef444420" : "#10b98120" }]}
                  onPress={() => updateAllowance(idx, "taxable", !a.taxable)}
                >
                  <Text style={{ fontSize: 9, fontWeight: "700", color: a.taxable ? "#ef4444" : "#10b981" }}>
                    {a.taxable ? "TAX" : "NO TAX"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Deductions */}
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>DEDUCTIONS</Text>
            <View style={styles.row3}>
              {[
                { label: `Tax Rate (%)`, val: taxRate, set: setTaxRate },
                { label: "Social Security (%)", val: socialSecurityRate, set: setSocialSecurityRate },
                { label: "Other Deductions (€)", val: otherDeductions, set: setOtherDeductions },
              ].map(({ label, val, set }) => (
                <View key={label} style={styles.thirdField}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <View style={[styles.inputWrap, { backgroundColor: theme.bg, borderColor: "#ef444440" }]}>
                    <TextInput style={[styles.input, { color: theme.text }]}
                      placeholder="0" placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad" value={val} onChangeText={set} />
                  </View>
                </View>
              ))}
            </View>

            {/* Live calculation */}
            <View style={[styles.calcPreview, { backgroundColor: "#00154f" }]}>
              <Text style={styles.calcTitle}>Live Calculation</Text>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Gross Salary</Text>
                <Text style={[styles.calcValue, { color: "#FFD700" }]}>{fmt(liveCalc.grossSalary)}</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Tax ({taxRate}%)</Text>
                <Text style={[styles.calcValue, { color: "#ef4444" }]}>-{fmt(liveCalc.taxAmount)}</Text>
              </View>
              {Number(socialSecurityRate) > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Social Security ({socialSecurityRate}%)</Text>
                  <Text style={[styles.calcValue, { color: "#ef4444" }]}>-{fmt(liveCalc.socialSecurityAmount)}</Text>
                </View>
              )}
              <View style={[styles.calcRow, styles.calcNetRow]}>
                <Text style={styles.calcNetLabel}>NET SALARY</Text>
                <Text style={styles.calcNetValue}>{fmt(liveCalc.netSalary)}</Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.formBtns}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
                onPress={handleSave} disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="save" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>{editingId ? "UPDATE" : "SAVE SLIP"}</Text>
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

        {/* ── Salary Slips List ── */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Salary Slips — {selectedMonth}
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : records.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
            <MaterialIcons name="payments" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No salary slips for {selectedMonth}
            </Text>
          </View>
        ) : (
          records.map((rec) => (
            <View key={rec.id} style={[styles.slipCard, { backgroundColor: theme.card }]}>
              {/* Header */}
              <View style={styles.slipHeader}>
                <View style={styles.slipHeaderLeft}>
                  <Text style={[styles.slipName, { color: theme.text }]}>{rec.employeeName}</Text>
                  <Text style={[styles.slipPosition, { color: theme.textSecondary }]}>
                    {rec.position} · No. {rec.employeeNo}
                  </Text>
                </View>
                <View style={styles.slipHeaderRight}>
                  <Text style={[styles.slipNet, { color: "#10b981" }]}>
                    {fmt(rec.netSalary)}
                  </Text>
                  <Text style={[styles.slipNetLabel, { color: theme.textSecondary }]}>Net</Text>
                </View>
              </View>

              {/* Details */}
              <View style={[styles.slipDetails, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
                {[
                  { label: "Basic", value: fmt(rec.basicSalary), color: theme.text },
                  { label: "Gross", value: fmt(rec.grossSalary), color: "#f59e0b" },
                  { label: "Tax", value: fmt(rec.taxAmount), color: "#ef4444" },
                  { label: "Net", value: fmt(rec.netSalary), color: "#10b981" },
                ].map(({ label, value, color }) => (
                  <View key={label} style={styles.slipDetailItem}>
                    <Text style={[styles.slipDetailLabel, { color: theme.textSecondary }]}>{label}</Text>
                    <Text style={[styles.slipDetailValue, { color }]}>{value}</Text>
                  </View>
                ))}
              </View>

              {/* OT row */}
              {rec.overtimeHours > 0 && (
                <Text style={[styles.slipOT, { color: "#3b82f6" }]}>
                  OT: {rec.overtimeHours}h × {rec.overtimeRate}× = {fmt(rec.grossSalary - rec.basicSalary * (rec.workingDays / rec.totalDays))}
                </Text>
              )}

              {/* Actions */}
              <View style={styles.slipActions}>
                <TouchableOpacity
                  style={[styles.pdfBtn, { backgroundColor: "#10b981" }]}
                  onPress={() => handleGeneratePDF(rec)}
                  disabled={generatingPdfId === rec.id}
                >
                  {generatingPdfId === rec.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <MaterialIcons name="picture-as-pdf" size={15} color="#fff" />}
                  <Text style={styles.pdfBtnText}>PDF Slip</Text>
                </TouchableOpacity>
                {isManager && (
                  <>
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: theme.primary }]}
                      onPress={() => handleEdit(rec)}
                    >
                      <MaterialIcons name="edit" size={14} color={theme.primary} />
                      <Text style={[styles.editBtnText, { color: theme.primary }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteBtn, { borderColor: "#ef4444" }]}
                      onPress={() => handleDelete(rec)}
                    >
                      <MaterialIcons name="delete" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Month Picker ── */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Month</Text>
            <ScrollView>
              {MONTHS_LIST.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerItem, { borderBottomColor: theme.border },
                    selectedMonth === m && { backgroundColor: theme.sidebarActive }]}
                  onPress={() => { setSelectedMonth(m); setShowMonthPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: theme.text }]}>{m}</Text>
                  {selectedMonth === m && <MaterialIcons name="check" size={14} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Position Picker ── */}
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
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  monthBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFD700", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  monthBtnText: { color: "#00154f", fontSize: 12, fontWeight: "800" },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  body: { padding: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 14, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  form: { borderRadius: 16, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 5 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 9, marginBottom: 10,
  },
  input: { flex: 1, fontSize: 13, padding: 0 },
  selector: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 9, marginBottom: 10,
  },
  selectorText: { flex: 1, fontSize: 13 },
  row2: { flexDirection: "row", gap: 8 },
  row3: { flexDirection: "row", gap: 8 },
  halfField: { flex: 1 },
  thirdField: { flex: 1 },
  quarterField: { flex: 1 },
  allowanceRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  taxToggle: {
    paddingHorizontal: 6, paddingVertical: 9, borderRadius: 6,
    alignItems: "center", justifyContent: "center", minWidth: 50,
  },
  calcPreview: { borderRadius: 14, padding: 14, marginBottom: 14 },
  calcTitle: { color: "#FFD700", fontSize: 12, fontWeight: "800", marginBottom: 8 },
  calcRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  calcLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  calcValue: { fontSize: 13, fontWeight: "700" },
  calcNetRow: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", marginTop: 6, paddingTop: 8 },
  calcNetLabel: { color: "#FFD700", fontSize: 14, fontWeight: "800" },
  calcNetValue: { color: "#10b981", fontSize: 18, fontWeight: "900" },
  formBtns: { flexDirection: "row", gap: 10 },
  saveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, padding: 13, borderRadius: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  cancelBtn: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  cancelBtnText: { fontSize: 13, fontWeight: "600" },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
  slipCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  slipHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  slipHeaderLeft: { flex: 1 },
  slipName: { fontSize: 15, fontWeight: "800" },
  slipPosition: { fontSize: 11, marginTop: 2 },
  slipHeaderRight: { alignItems: "flex-end" },
  slipNet: { fontSize: 20, fontWeight: "900" },
  slipNetLabel: { fontSize: 10 },
  slipDetails: {
    flexDirection: "row", paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 8,
  },
  slipDetailItem: { flex: 1, alignItems: "center" },
  slipDetailLabel: { fontSize: 9, fontWeight: "600", marginBottom: 2 },
  slipDetailValue: { fontSize: 12, fontWeight: "800" },
  slipOT: { fontSize: 11, marginBottom: 8, fontStyle: "italic" },
  slipActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  pdfBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  pdfBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5,
  },
  editBtnText: { fontSize: 12, fontWeight: "700" },
  deleteBtn: {
    paddingHorizontal: 8, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5,
  },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  pickerCard: { width: "100%", maxWidth: 340, borderRadius: 16, overflow: "hidden", maxHeight: 400 },
  pickerTitle: { fontSize: 15, fontWeight: "800", padding: 16, paddingBottom: 8 },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
});
