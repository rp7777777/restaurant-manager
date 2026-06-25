// ============================================
// SERVORA ERP — EmployeeForm Component
// ✅ Selector — file level memo
// ✅ value prop removed from SelectorProps
// ✅ useEffect — existingEmployees.length dependency
// ✅ Unused imports removed
// ✅ Theme-aware salary preview
// ✅ Auto-generate employee number
// TODO: Split tabs into separate components (v2)
// FROZEN
// ============================================

import React, { useState, memo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmployeeDB } from "../types/employee-types";
import {
  EmployeeFormState,
  useEmployeeForm,
} from "../hooks/useEmployeeForm";
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
} from "../constants/employee-roles";
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_LABELS,
} from "../constants/employee-status";
import { STATUS_COLORS } from "../constants/employee-status-colors";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  MARITAL_STATUSES,
  MARITAL_STATUS_LABELS,
  GENDERS,
} from "../constants/contract-types";
import { generateEmployeeNumber } from "../services/employee-number-service";
import { EmployeePickerModal } from "./EmployeePickerModal";

// ── Tab definition ────────────────────────────
type FormTab =
  | "basic"
  | "employment"
  | "salary"
  | "address"
  | "allowances"
  | "emergency";

const FORM_TABS: { key: FormTab; label: string; icon: string }[] = [
  { key: "basic",      label: "Basic",      icon: "person"     },
  { key: "employment", label: "Employment", icon: "work"       },
  { key: "salary",     label: "Salary",     icon: "payments"   },
  { key: "address",    label: "Address",    icon: "home"       },
  { key: "allowances", label: "Allowances", icon: "add-circle" },
  { key: "emergency",  label: "Emergency",  icon: "emergency"  },
];

// ── Field — file level ────────────────────────
const Field = memo(({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => {
  const { theme } = useApp();
  return (
    <View style={styles.fieldWrapper}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      {children}
      {error && (
        <Text style={[styles.fieldError, { color: theme.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
});

// ── Input — file level ────────────────────────
const Input = memo(({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoCapitalize,
  error,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "decimal-pad" | "phone-pad";
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: boolean;
}) => {
  const { theme } = useApp();
  return (
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: theme.bg,
          borderColor:     error ? theme.error : theme.border,
          color:           theme.text,
          minHeight:       multiline ? 70 : undefined,
        },
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
    />
  );
});

// ── ✅ Selector — file level, value removed ───
interface SelectorProps {
  label:     string;
  onPress:   () => void;
  color?:    string;
  hasError?: boolean;
}

const Selector = memo(({
  label,
  onPress,
  color,
  hasError,
}: SelectorProps) => {
  const { theme } = useApp();
  return (
    <TouchableOpacity
      style={[
        styles.selector,
        {
          backgroundColor: theme.bg,
          borderColor:     hasError ? theme.error : theme.border,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.selectorText, { color: color ?? theme.text }]}>
        {label}
      </Text>
      <MaterialIcons name="arrow-drop-down" size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );
});

// ── Props ─────────────────────────────────────
interface EmployeeFormProps {
  restaurantId:      string;
  restaurantName:    string;
  existingEmployees: Pick<EmployeeDB, "id" | "employeeNumber">[];
  editEmployee?:     EmployeeDB | null;
  onSuccess:         (id: string) => void;
  onCancel:          () => void;
}

// ── Main Component ────────────────────────────
export const EmployeeForm = memo(({
  restaurantId,
  restaurantName,
  existingEmployees,
  editEmployee,
  onSuccess,
  onCancel,
}: EmployeeFormProps) => {
  const { theme } = useApp();
  const [activeTab, setActiveTab] = useState<FormTab>("basic");
  const [picker,    setPicker]    = useState<string | null>(null);

  const {
    form,
    setField,
    errors,
    saving,
    isEditing,
    previewGross,
    resetForm,
    loadEmployee,
    handleSubmit,
  } = useEmployeeForm({
    restaurantId,
    restaurantName,
    existingEmployees,
    onSuccess,
    onError: (err) => console.error("EmployeeForm error:", err),
  });

  // ✅ Fix #1 — existingEmployees.length in deps
 React.useEffect(() => {
  if (editEmployee) {
    loadEmployee(editEmployee);
    setActiveTab("basic");
    return;
  }

  // ✅ Only generate if not editing AND no number yet
  // Prevents form reset when existingEmployees refreshes
  if (!isEditing && !form.employeeNumber) {
    const generated = generateEmployeeNumber({ existingEmployees });
    setField("employeeNumber", generated);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [editEmployee?.id]);

  const handlePick = useCallback((field: keyof EmployeeFormState, value: string) => {
    setField(field, value as never);
    setPicker(null);
  }, [setField]);

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        {isEditing ? "✏️ Edit Employee" : "➕ New Employee"}
      </Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {FORM_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && { backgroundColor: theme.primary }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons
              name={tab.icon as never}
              size={14}
              color={activeTab === tab.key ? theme.accent : theme.textSecondary}
            />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? theme.accent : theme.textSecondary }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── TAB: BASIC ── */}
      {activeTab === "basic" && (
        <View style={styles.tabContent}>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="EMP NO. *" error={errors.employeeNumber}>
                <Input
                  value={form.employeeNumber}
                  onChangeText={(v) => setField("employeeNumber", v)}
                  placeholder="EMP001"
                  error={!!errors.employeeNumber}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CODE (QR)">
                <Input
                  value={form.employeeCode}
                  onChangeText={(v) => setField("employeeCode", v)}
                  placeholder="Optional"
                />
              </Field>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="FIRST NAME *" error={errors.firstName}>
                <Input
                  value={form.firstName}
                  onChangeText={(v) => setField("firstName", v)}
                  placeholder="First Name"
                  error={!!errors.firstName}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="LAST NAME *" error={errors.lastName}>
                <Input
                  value={form.lastName}
                  onChangeText={(v) => setField("lastName", v)}
                  placeholder="Last Name"
                  error={!!errors.lastName}
                />
              </Field>
            </View>
          </View>

          <Field label="EMAIL" error={errors.email}>
            <Input
              value={form.email}
              onChangeText={(v) => setField("email", v)}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={!!errors.email}
            />
          </Field>

          <Field label="PHONE" error={errors.phone}>
            <Input
              value={form.phone}
              onChangeText={(v) => setField("phone", v)}
              placeholder="+351 900 000 000"
              keyboardType="phone-pad"
              error={!!errors.phone}
            />
          </Field>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="BIRTH DATE" error={errors.birthDate}>
                <Input
                  value={form.birthDate}
                  onChangeText={(v) => setField("birthDate", v)}
                  placeholder="1990-05-15"
                  error={!!errors.birthDate}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="GENDER">
                <Selector
                  label={GENDERS.find((g) => g.value === form.gender)?.label ?? "Select..."}
                  onPress={() => setPicker("gender")}
                />
              </Field>
            </View>
          </View>

          <Field label="TAX ID">
            <Input
              value={form.taxId}
              onChangeText={(v) => setField("taxId", v)}
              placeholder="NIF / SSN / PAN / TFN"
            />
          </Field>

          <Field label="NATIONAL INSURANCE ID">
            <Input
              value={form.nationalInsuranceId}
              onChangeText={(v) => setField("nationalInsuranceId", v)}
              placeholder="NISS / NI Number / SSF"
            />
          </Field>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="MARITAL STATUS">
                <Selector
                  label={MARITAL_STATUS_LABELS[form.maritalStatus]}
                  onPress={() => setPicker("maritalStatus")}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="DEPENDENTS">
                <Input
                  value={form.dependents}
                  onChangeText={(v) => setField("dependents", v)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>
        </View>
      )}

      {/* ── TAB: EMPLOYMENT ── */}
      {activeTab === "employment" && (
        <View style={styles.tabContent}>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="ROLE" error={errors.role}>
                <Selector
                  label={EMPLOYEE_ROLE_LABELS[form.role]}
                  onPress={() => setPicker("role")}
                  hasError={!!errors.role}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="STATUS" error={errors.status}>
                <Selector
                  label={EMPLOYEE_STATUS_LABELS[form.status]}
                  onPress={() => setPicker("status")}
                  color={STATUS_COLORS[form.status]}
                />
              </Field>
            </View>
          </View>

          <Field label="POSITION (Free Text)">
            <Input
              value={form.position}
              onChangeText={(v) => setField("position", v)}
              placeholder="Head Chef, Barista, etc."
            />
          </Field>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="CONTRACT TYPE" error={errors.contractType}>
                <Selector
                  label={CONTRACT_TYPE_LABELS[form.contractType]}
                  onPress={() => setPicker("contractType")}
                  hasError={!!errors.contractType}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="PAYMENT MODE" error={errors.paymentMode}>
                <Selector
                  label={PAYMENT_MODE_LABELS[form.paymentMode]}
                  onPress={() => setPicker("paymentMode")}
                  hasError={!!errors.paymentMode}
                />
              </Field>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="HIRE DATE" error={errors.hireDate}>
                <Input
                  value={form.hireDate}
                  onChangeText={(v) => setField("hireDate", v)}
                  placeholder="2026-06-20"
                  error={!!errors.hireDate}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="PROBATION DAYS">
                <Input
                  value={form.probationDays}
                  onChangeText={(v) => setField("probationDays", v)}
                  placeholder="90"
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>

          <Field label="TERMINATION DATE" error={errors.terminationDate}>
            <Input
              value={form.terminationDate}
              onChangeText={(v) => setField("terminationDate", v)}
              placeholder="2026-12-31"
              error={!!errors.terminationDate}
            />
          </Field>

          <Field label="NOTES">
            <Input
              value={form.notes}
              onChangeText={(v) => setField("notes", v)}
              placeholder="Internal notes..."
              multiline
            />
          </Field>
        </View>
      )}

      {/* ── TAB: SALARY ── */}
      {activeTab === "salary" && (
        <View style={styles.tabContent}>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="MONTHLY SALARY" error={errors.monthlySalary}>
                <Input
                  value={form.monthlySalary}
                  onChangeText={(v) => setField("monthlySalary", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  error={!!errors.monthlySalary}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="HOURLY RATE" error={errors.hourlyRate}>
                <Input
                  value={form.hourlyRate}
                  onChangeText={(v) => setField("hourlyRate", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  error={!!errors.hourlyRate}
                />
              </Field>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="DAILY HOURS">
                <Input
                  value={form.dailyHours}
                  onChangeText={(v) => setField("dailyHours", v)}
                  placeholder="8"
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="WEEKLY HOURS">
                <Input
                  value={form.weeklyHours}
                  onChangeText={(v) => setField("weeklyHours", v)}
                  placeholder="40"
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="TAX RATE %" error={errors.taxRate}>
                <Input
                  value={form.taxRate}
                  onChangeText={(v) => setField("taxRate", v)}
                  placeholder="Settings default"
                  keyboardType="decimal-pad"
                  error={!!errors.taxRate}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="SS RATE %" error={errors.ssRate}>
                <Input
                  value={form.ssRate}
                  onChangeText={(v) => setField("ssRate", v)}
                  placeholder="Settings default"
                  keyboardType="decimal-pad"
                  error={!!errors.ssRate}
                />
              </Field>
            </View>
          </View>

          <Field label="IBAN" error={errors.iban}>
            <Input
              value={form.iban}
              onChangeText={(v) => setField("iban", v)}
              placeholder="Optional — cash employees leave blank"
              error={!!errors.iban}
            />
          </Field>

          <Field label="BANK NAME">
            <Input
              value={form.bankName}
              onChangeText={(v) => setField("bankName", v)}
              placeholder="Bank Name"
            />
          </Field>

          {/* ✅ Theme-aware preview */}
          <View style={[styles.preview, { backgroundColor: theme.primary }]}>
            <Text style={[styles.previewTitle, { color: theme.accent }]}>
              Monthly Preview
            </Text>
            <View style={styles.previewRow}>
              <Text style={[styles.previewLabel, { color: "rgba(255,255,255,0.7)" }]}>
                Monthly Salary
              </Text>
              <Text style={[styles.previewValue, { color: theme.accent }]}>
                {Number(form.monthlySalary).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.previewRow, styles.previewDivider]}>
              <Text style={[styles.previewLabel, { color: theme.accent, fontWeight: "800" }]}>
                GROSS
              </Text>
              <Text style={[styles.previewValue, { color: theme.accent, fontSize: 16 }]}>
                {previewGross.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── TAB: ADDRESS ── */}
      {activeTab === "address" && (
        <View style={styles.tabContent}>
          <Field label="STREET ADDRESS">
            <Input
              value={form.address}
              onChangeText={(v) => setField("address", v)}
              placeholder="Street Address"
            />
          </Field>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="POSTAL CODE">
                <Input
                  value={form.postalCode}
                  onChangeText={(v) => setField("postalCode", v)}
                  placeholder="1000-001"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CITY">
                <Input
                  value={form.city}
                  onChangeText={(v) => setField("city", v)}
                  placeholder="City"
                />
              </Field>
            </View>
          </View>
          <Field label="COUNTRY (ISO)">
            <Input
              value={form.country}
              onChangeText={(v) => setField("country", v)}
              placeholder="PT / GB / US / NP"
              autoCapitalize="characters"
            />
          </Field>
        </View>
      )}

      {/* ── TAB: ALLOWANCES ── */}
      {activeTab === "allowances" && (
        <View style={styles.tabContent}>
          <View style={[styles.allowanceHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.allowanceHeaderText, { flex: 2, color: theme.textSecondary }]}>Name</Text>
            <Text style={[styles.allowanceHeaderText, { flex: 1, color: theme.textSecondary }]}>Amount</Text>
            <Text style={[styles.allowanceHeaderText, { flex: 0.8, color: theme.textSecondary }]}>Taxable</Text>
            <Text style={[styles.allowanceHeaderText, { flex: 0.5, color: theme.textSecondary }]}></Text>
          </View>

          {form.allowances.map((a, idx) => (
            <View key={a.id} style={styles.allowanceRow}>
              <TextInput
                style={[styles.allowanceInput, { flex: 2, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={a.name}
                onChangeText={(v) => {
                  const updated = [...form.allowances];
                  updated[idx] = { ...updated[idx], name: v };
                  setField("allowances", updated);
                }}
                placeholder="Name"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.allowanceInput, { flex: 1, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={a.amount > 0 ? String(a.amount) : ""}
                onChangeText={(v) => {
                  const updated = [...form.allowances];
                  updated[idx] = { ...updated[idx], amount: Number(v) || 0 };
                  setField("allowances", updated);
                }}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={[styles.taxToggle, {
                  flex: 0.8,
                  backgroundColor: a.taxable ? "#ef444420" : "#10b98120",
                }]}
                onPress={() => {
                  const updated = [...form.allowances];
                  updated[idx] = { ...updated[idx], taxable: !a.taxable };
                  setField("allowances", updated);
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: "700", color: a.taxable ? "#ef4444" : "#10b981" }}>
                  {a.taxable ? "TAXED" : "NO TAX"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 0.5, alignItems: "center", justifyContent: "center" }}
                onPress={() => setField("allowances", form.allowances.filter((_, i) => i !== idx))}
              >
                <MaterialIcons name="remove-circle-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addAllowanceBtn, { borderColor: theme.primary }]}
            onPress={() => setField("allowances", [
              ...form.allowances,
              { id: `custom_${Date.now()}`, name: "", amount: 0, type: "MONTHLY", taxable: false },
            ])}
          >
            <MaterialIcons name="add" size={16} color={theme.primary} />
            <Text style={[styles.addAllowanceBtnText, { color: theme.primary }]}>
              Add Allowance
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TAB: EMERGENCY ── */}
      {activeTab === "emergency" && (
        <View style={styles.tabContent}>
          <Field label="CONTACT NAME">
            <Input
              value={form.emergencyName}
              onChangeText={(v) => setField("emergencyName", v)}
              placeholder="Full Name"
            />
          </Field>
          <Field label="PHONE">
            <Input
              value={form.emergencyPhone}
              onChangeText={(v) => setField("emergencyPhone", v)}
              placeholder="+351 900 000 000"
              keyboardType="phone-pad"
            />
          </Field>
          <Field label="RELATIONSHIP">
            <Input
              value={form.emergencyRelationship}
              onChangeText={(v) => setField("emergencyRelationship", v)}
              placeholder="Spouse, Parent, Sibling..."
            />
          </Field>
        </View>
      )}

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <MaterialIcons name="save" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {isEditing ? "UPDATE" : "SAVE EMPLOYEE"}
                </Text>
              </>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: theme.border }]}
          onPress={onCancel}
        >
          <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Picker Modals */}
      <EmployeePickerModal
        visible={picker === "role"}
        title="Select Role"
        options={EMPLOYEE_ROLES.map((r) => ({ value: r, label: EMPLOYEE_ROLE_LABELS[r] }))}
        selected={form.role}
        onSelect={(v) => handlePick("role", v)}
        onClose={() => setPicker(null)}
      />
      <EmployeePickerModal
        visible={picker === "status"}
        title="Select Status"
        options={EMPLOYEE_STATUSES.map((s) => ({
          value: s,
          label: EMPLOYEE_STATUS_LABELS[s],
          color: STATUS_COLORS[s],
        }))}
        selected={form.status}
        onSelect={(v) => handlePick("status", v)}
        onClose={() => setPicker(null)}
      />
      <EmployeePickerModal
        visible={picker === "contractType"}
        title="Select Contract Type"
        options={CONTRACT_TYPES.map((c) => ({ value: c, label: CONTRACT_TYPE_LABELS[c] }))}
        selected={form.contractType}
        onSelect={(v) => handlePick("contractType", v)}
        onClose={() => setPicker(null)}
      />
      <EmployeePickerModal
        visible={picker === "paymentMode"}
        title="Select Payment Mode"
        options={PAYMENT_MODES.map((p) => ({ value: p, label: PAYMENT_MODE_LABELS[p] }))}
        selected={form.paymentMode}
        onSelect={(v) => handlePick("paymentMode", v)}
        onClose={() => setPicker(null)}
      />
      <EmployeePickerModal
        visible={picker === "maritalStatus"}
        title="Select Marital Status"
        options={MARITAL_STATUSES.map((m) => ({ value: m, label: MARITAL_STATUS_LABELS[m] }))}
        selected={form.maritalStatus}
        onSelect={(v) => handlePick("maritalStatus", v)}
        onClose={() => setPicker(null)}
      />
      <EmployeePickerModal
        visible={picker === "gender"}
        title="Select Gender"
        options={GENDERS.map((g) => ({ value: g.value, label: g.label }))}
        selected={form.gender}
        onSelect={(v) => handlePick("gender", v)}
        onClose={() => setPicker(null)}
      />
    </View>
  );
});

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  container:           { borderRadius: 16, padding: 16 },
  title:               { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  tabBar:              { marginBottom: 14 },
  tabBtn:              { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8 },
  tabLabel:            { fontSize: 11, fontWeight: "700" },
  tabContent:          { gap: 2 },
  fieldWrapper:        { marginBottom: 8 },
  fieldLabel:          { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  fieldError:          { fontSize: 10, marginTop: 2 },
  input:               { borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  selector:            { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10 },
  selectorText:        { flex: 1, fontSize: 13 },
  row2:                { flexDirection: "row", gap: 8 },
  allowanceHeader:     { flexDirection: "row", gap: 6, paddingBottom: 4, borderBottomWidth: 1, marginBottom: 6 },
  allowanceHeaderText: { fontSize: 10, fontWeight: "700" },
  allowanceRow:        { flexDirection: "row", gap: 6, marginBottom: 6, alignItems: "center" },
  allowanceInput:      { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12 },
  taxToggle:           { borderRadius: 6, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  addAllowanceBtn:     { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 9, padding: 10, justifyContent: "center", marginTop: 8 },
  addAllowanceBtnText: { fontSize: 13, fontWeight: "700" },
  preview:             { borderRadius: 14, padding: 14, marginTop: 14 },
  previewTitle:        { fontSize: 12, fontWeight: "800", marginBottom: 8 },
  previewRow:          { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  previewDivider:      { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", marginTop: 6, paddingTop: 6 },
  previewLabel:        { fontSize: 12 },
  previewValue:        { fontSize: 12, fontWeight: "700" },
  buttons:             { flexDirection: "row", gap: 10, marginTop: 16 },
  saveBtn:             { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 13, borderRadius: 10 },
  saveBtnText:         { color: "#fff", fontSize: 14, fontWeight: "800" },
  cancelBtn:           { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  cancelBtnText:       { fontSize: 13, fontWeight: "600" },
});