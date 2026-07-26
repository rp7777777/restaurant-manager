// ============================================
// SERVORA ERP — SupplierForm Screen
// ✅ Handles both Create (no `existing` prop) and Edit (`existing`
//    passed) — same screen, same hook (useSupplierForm).
// ✅ Only Name is required — matches the FROZEN repository's own
//    validation, so the form never rejects something the backend
//    would accept, or vice versa.
// ✅ supplierCode is intentionally NOT shown as an input at all —
//    server-generated and immutable, so there's nothing to edit;
//    displayed read-only in Edit mode so the user can still see it.
// ✅ taxId field labeled "VAT / Tax Number" — reads naturally for
//    both Europe-based (VAT) and non-Europe (GST/EIN/ABN) users
//    under one shared field.
// ✅ Status is a simple two-way toggle (Active/Inactive) rather
//    than a dropdown — only two values exist, so a toggle is one
//    tap instead of open-picker-then-select.
// PHASE 8.3
// ============================================

import React from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useSupplierForm } from "../hooks/useSupplierForm";
import { Supplier } from "../types/supplier";

interface SupplierFormProps {
  existing?: Supplier;  // pass to edit; omit to create
  onSaved:   () => void;
  onCancel:  () => void;
}

export default function SupplierForm({ existing, onSaved, onCancel }: SupplierFormProps) {
  const { restaurantId } = useApp();

  const {
    name, setName,
    companyName, setCompanyName,
    contactPerson, setContactPerson,
    phone, setPhone,
    email, setEmail,
    taxId, setTaxId,
    address, setAddress,
    country, setCountry,
    currency, setCurrency,
    paymentTerms, setPaymentTerms,
    status, setStatus,
    notes, setNotes,
    saving, error,
    submit,
  } = useSupplierForm(existing);

  const handleSave = async () => {
    if (!restaurantId) return;
    const ok = await submit(restaurantId);
    if (ok) onSaved();
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{existing ? "Edit Supplier" : "New Supplier"}</Text>

      {existing && (
        <View style={styles.codeBadge}>
          <MaterialIcons name="tag" size={13} color="#0369a1" />
          <Text style={styles.codeBadgeText}>{existing.supplierCode}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Recheio Masterchef"
      />

      <Text style={styles.label}>Company Name</Text>
      <TextInput
        style={styles.input}
        value={companyName}
        onChangeText={setCompanyName}
        placeholder="Optional — legal/registered name"
      />

      <Text style={styles.label}>Contact Person</Text>
      <TextInput
        style={styles.input}
        value={contactPerson}
        onChangeText={setContactPerson}
        placeholder="Optional"
      />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Optional"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>

      <Text style={styles.label}>VAT / Tax Number</Text>
      <TextInput
        style={styles.input}
        value={taxId}
        onChangeText={setTaxId}
        placeholder="Optional"
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Address</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Optional"
      />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Country</Text>
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={setCountry}
            placeholder="e.g. Portugal"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Currency</Text>
          <TextInput
            style={styles.input}
            value={currency}
            onChangeText={setCurrency}
            placeholder="e.g. EUR"
            autoCapitalize="characters"
            maxLength={3}
          />
        </View>
      </View>

      <Text style={styles.label}>Payment Terms</Text>
      <TextInput
        style={styles.input}
        value={paymentTerms}
        onChangeText={setPaymentTerms}
        placeholder="e.g. Net 30, COD, Advance"
      />

      <Text style={styles.label}>Status</Text>
      <View style={styles.statusToggleRow}>
        <TouchableOpacity
          style={[styles.statusOption, status === "ACTIVE" && styles.statusOptionActive]}
          onPress={() => setStatus("ACTIVE")}
        >
          <Text style={[styles.statusOptionText, status === "ACTIVE" && styles.statusOptionTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusOption, status === "INACTIVE" && styles.statusOptionInactive]}
          onPress={() => setStatus("INACTIVE")}
        >
          <Text style={[styles.statusOptionText, status === "INACTIVE" && styles.statusOptionTextActive]}>
            Inactive
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
        numberOfLines={3}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : existing ? "Save Changes" : "Add Supplier"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "800", color: "#1e293b", marginBottom: 8 },
  codeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#e0f2fe", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, marginBottom: 12,
  },
  codeBadgeText: { color: "#0369a1", fontSize: 12, fontWeight: "700" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 8, marginBottom: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "600", flex: 1 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14, color: "#1e293b",
  },
  notesInput: { minHeight: 70, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  statusToggleRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statusOption: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center",
  },
  statusOptionActive:   { backgroundColor: "#059669", borderColor: "#059669" },
  statusOptionInactive: { backgroundColor: "#94a3b8", borderColor: "#94a3b8" },
  statusOptionText:       { fontSize: 13, fontWeight: "700", color: "#475569" },
  statusOptionTextActive: { color: "#fff" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 40 },
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