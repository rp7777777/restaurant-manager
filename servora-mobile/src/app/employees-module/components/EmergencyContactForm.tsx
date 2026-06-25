// ============================================
// SERVORA ERP — EmergencyContactForm Component
// ✅ value ?? {} — crash safe spread
// ✅ Boolean(hasContact) — clean boolean
// ✅ memo sufficient — no useCallback needed
// ✅ Pure UI — no business logic
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, StyleSheet,
  TextInput,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmergencyContact } from "../types/employee-types";

interface EmergencyContactFormProps {
  value:     EmergencyContact;
  onChange:  (contact: EmergencyContact) => void;
  disabled?: boolean;
}

export const EmergencyContactForm = memo(({
  value,
  onChange,
  disabled = false,
}: EmergencyContactFormProps) => {
  const { theme } = useApp();

  // ✅ crash safe — value undefined bhaye pani spread safe
  const handleChange = (field: keyof EmergencyContact, text: string) => {
    onChange({
      ...(value ?? { name: "", phone: "", relationship: "" }),
      [field]: text,
    });
  };

  // ✅ clean boolean
  const hasContact = Boolean(
    value?.name?.trim()         ||
    value?.phone?.trim()        ||
    value?.relationship?.trim()
  );

  return (
    <View style={styles.container}>

      {/* Name */}
      <View style={styles.fieldWrapper}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          CONTACT NAME
        </Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.bg,
            borderColor:     theme.border,
            color:           theme.text,
          }]}
          value={value?.name ?? ""}
          onChangeText={(v) => handleChange("name", v)}
          placeholder="Full Name"
          placeholderTextColor={theme.textSecondary}
          editable={!disabled}
        />
      </View>

      {/* Phone */}
      <View style={styles.fieldWrapper}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          PHONE
        </Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.bg,
            borderColor:     theme.border,
            color:           theme.text,
          }]}
          value={value?.phone ?? ""}
          onChangeText={(v) => handleChange("phone", v)}
          placeholder="+351 900 000 000"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          editable={!disabled}
        />
      </View>

      {/* Relationship */}
      <View style={styles.fieldWrapper}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          RELATIONSHIP
        </Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.bg,
            borderColor:     theme.border,
            color:           theme.text,
          }]}
          value={value?.relationship ?? ""}
          onChangeText={(v) => handleChange("relationship", v)}
          placeholder="Spouse, Parent, Sibling..."
          placeholderTextColor={theme.textSecondary}
          editable={!disabled}
        />
      </View>

      {/* View mode summary */}
      {disabled && hasContact && (
        <View style={[styles.summary, { backgroundColor: "#ef444410", borderColor: "#ef444430" }]}>
          <MaterialIcons name="emergency" size={14} color="#ef4444" />
          <Text style={[styles.summaryText, { color: theme.textSecondary }]} numberOfLines={2}>
            {value?.name}
            {value?.relationship ? ` (${value.relationship})` : ""}
            {value?.phone ? ` · ${value.phone}` : ""}
          </Text>
        </View>
      )}

    </View>
  );
});

const styles = StyleSheet.create({
  container:    { gap: 8 },
  fieldWrapper: { gap: 4 },
  label:        { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  input:        { borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  summary:      { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 4 },
  summaryText:  { fontSize: 12, flex: 1 },
});