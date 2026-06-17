// ============================================
// SERVORA ERP — PayrollDetailModal Component
// ✅ attItem flexBasis — wrap fix
// ✅ statusBarTranslucent added
// ✅ snapshot fallback — old records safe
// ============================================

import React from "react";
import {
  View, Text, Modal, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { PayrollDocument } from "../types/payroll-types";
import { PayrollStatusBadge } from "./PayrollStatusBadge";

interface Props {
  payroll: PayrollDocument | null;
  visible: boolean;
  isManager: boolean;
  markingPaid: boolean;
  onMarkPaid: (payroll: PayrollDocument) => void;
  onClose: () => void;
}

export function PayrollDetailModal({
  payroll,
  visible,
  isManager,
  markingPaid,
  onMarkPaid,
  onClose,
}: Props) {
  const { theme, fmt } = useApp();

  if (!payroll) return null;

  const calc = payroll.calculation;
  const att  = payroll.attendance;

  // ✅ Snapshot fallback — old records safe
  const snap = payroll.snapshot ?? {
    basicSalary:  0,
    hourlyRate:   0,
    overtimeRate: 0,
    holidayRate:  0,
    nightRate:    0,
    taxRate:      0,
    ssRate:       0,
  };

  return (
    // ✅ statusBarTranslucent
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <TouchableOpacity style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.modal, { backgroundColor: theme.surface }]}
          onStartShouldSetResponder={() => true}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.empName, { color: theme.text }]}>
                  {payroll.employeeName}
                </Text>
                <Text style={[styles.empSub, { color: theme.textSecondary }]}>
                  {payroll.employeeNo} · {payroll.position}
                </Text>
              </View>
              <PayrollStatusBadge status={payroll.payrollStatus} size="md" />
            </View>

            <Text style={[styles.monthLabel, { color: theme.textSecondary }]}>
              {payroll.month}
            </Text>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Earnings */}
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              EARNINGS
            </Text>
            {[
              { label: "Basic Salary",       val: calc?.earnedBasic          ?? 0, color: theme.text },
              { label: "Overtime Pay",        val: calc?.overtimePay          ?? 0, color: "#f59e0b" },
              { label: "Holiday Pay",         val: calc?.holidayPay           ?? 0, color: "#8b5cf6" },
              { label: "Night Pay",           val: calc?.nightPay             ?? 0, color: "#3b82f6" },
              { label: "Taxable Allowances",  val: calc?.taxableAllowances    ?? 0, color: "#10b981" },
              { label: "Non-taxable Allow.",  val: calc?.nonTaxableAllowances ?? 0, color: "#10b981" },
            ].map(({ label, val, color }) => (
              <View key={label} style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>
                  {label}
                </Text>
                <Text style={[styles.calcVal, { color }]}>{fmt(val)}</Text>
              </View>
            ))}

            <View style={[styles.calcRow, styles.grossRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.calcLabel, { color: theme.text, fontWeight: "700" }]}>
                Gross Salary
              </Text>
              <Text style={[styles.calcVal, { color: theme.text, fontWeight: "700" }]}>
                {fmt(calc?.grossSalary ?? 0)}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Deductions */}
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              DEDUCTIONS
            </Text>
            {[
              { label: `Tax (${snap.taxRate}%)`,           val: -(calc?.taxAmount              ?? 0) },
              { label: `Social Security (${snap.ssRate}%)`, val: -(calc?.socialSecurityAmount  ?? 0) },
            ].map(({ label, val }) => (
              <View key={label} style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>
                  {label}
                </Text>
                <Text style={[styles.calcVal, { color: "#ef4444" }]}>
                  {fmt(val)}
                </Text>
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Net */}
            <View style={styles.netRow}>
              <Text style={[styles.netLabel, { color: theme.text }]}>NET SALARY</Text>
              <Text style={styles.netVal}>{fmt(calc?.netSalary ?? 0)}</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Attendance */}
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              ATTENDANCE
            </Text>
            <View style={styles.attGrid}>
              {[
                { label: "Work Days",    val: att?.workingDays ?? 0 },
                { label: "OT Hours",     val: (att?.overtimeHours ?? 0).toFixed(1) },
                { label: "Night Hours",  val: (att?.nightHours    ?? 0).toFixed(1) },
                { label: "Holiday Days", val: att?.holidayDays    ?? 0 },
                { label: "Absent",       val: att?.absentDays     ?? 0 },
                { label: "Sick Days",    val: att?.sickDays       ?? 0 },
              ].map(({ label, val }) => (
                <View
                  key={label}
                  style={[styles.attItem, { backgroundColor: theme.bg }]}
                >
                  <Text style={[styles.attVal, { color: theme.text }]}>{val}</Text>
                  <Text style={[styles.attLabel, { color: theme.textSecondary }]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Rates snapshot */}
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              RATES AT TIME OF PAYROLL
            </Text>
            {[
              { label: "Hourly Rate",  val: fmt(snap.hourlyRate)   },
              { label: "OT Rate",      val: `×${snap.overtimeRate}` },
              { label: "Holiday Rate", val: `×${snap.holidayRate}`  },
              { label: "Night Rate",   val: `×${snap.nightRate}`    },
            ].map(({ label, val }) => (
              <View key={label} style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>
                  {label}
                </Text>
                <Text style={[styles.calcVal, { color: theme.text }]}>{val}</Text>
              </View>
            ))}

            <View style={{ height: 16 }} />

            {/* Mark Paid */}
            {isManager && payroll.payrollStatus === "GENERATED" && (
              <TouchableOpacity
                style={[styles.markPaidBtn, markingPaid && { opacity: 0.7 }]}
                onPress={() => onMarkPaid(payroll)}
                disabled={markingPaid}
              >
                {markingPaid
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialIcons name="check-circle" size={16} color="#fff" />
                }
                <Text style={styles.markPaidText}>Mark as Paid</Text>
              </TouchableOpacity>
            )}

            {/* Close */}
            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: theme.border }]}
              onPress={onClose}
            >
              <Text style={[styles.closeBtnText, { color: theme.text }]}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent:  "flex-end",
  },
  modal: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:   20,
    maxHeight: "92%",
  },
  modalHeader:  { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  empName:      { fontSize: 18, fontWeight: "800" },
  empSub:       { fontSize: 12, marginTop: 4 },
  monthLabel:   { fontSize: 12, marginBottom: 8 },
  divider:      { height: 1, marginVertical: 10 },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  calcRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  calcLabel:    { fontSize: 13 },
  calcVal:      { fontSize: 13, fontWeight: "700" },
  grossRow:     { borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  netRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingVertical: 4,
  },
  netLabel: { fontSize: 15, fontWeight: "800" },
  netVal:   { fontSize: 22, fontWeight: "900", color: "#10b981" },
  attGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           8,
    marginBottom:  4,
  },
  attItem: {
    // ✅ flexBasis — wrap fix
    flexBasis:  "31%",
    alignItems: "center",
    padding:    10,
    borderRadius: 8,
  },
  attVal:       { fontSize: 16, fontWeight: "800" },
  attLabel:     { fontSize: 9,  marginTop: 2 },
  markPaidBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    backgroundColor: "#10b981",
    padding:         14,
    borderRadius:    12,
    marginBottom:    10,
  },
  markPaidText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  closeBtn: {
    alignItems:   "center",
    padding:      12,
    borderRadius: 12,
    borderWidth:  1.5,
    marginBottom: 8,
  },
  closeBtnText: { fontSize: 14, fontWeight: "700" },
});