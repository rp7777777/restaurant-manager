// ============================================
// SERVORA ERP — EmployeePickerModal Component
// ✅ Updated to use new EmployeeDB fields
// ✅ employeeNumber (not employeeNo)
// ✅ firstName + lastName (not fullName)
// ✅ monthlySalary (not basicSalary)
// ✅ status check (not active boolean)
// ✅ Search by name/number/position
// ✅ Already added filter
// ✅ Auto close + search reset
// ============================================

import React, { useState } from "react";
import {
  View, Text, Modal, TouchableOpacity,
  TextInput, ScrollView, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmployeeDB } from "../types/employee-types";

interface Props {
  visible:      boolean;
  employees:    EmployeeDB[];
  alreadyAdded: Set<string>;
  onSelect:     (employee: EmployeeDB) => void;
  onClose:      () => void;
}

export function EmployeePickerModal({
  visible,
  employees,
  alreadyAdded,
  onSelect,
  onClose,
}: Props) {
  const { theme, fmt } = useApp();
  const [search, setSearch] = useState("");

  // ✅ status check — not e.active boolean
  const available = employees.filter(
    (e) => !alreadyAdded.has(e.employeeNumber)
  );

  const filtered = available.filter((e) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    // ✅ firstName + lastName
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    return (
      fullName.includes(q)                                    ||
      (e.employeeNumber ?? "").toLowerCase().includes(q)      ||
      (e.position       ?? "").toLowerCase().includes(q)
    );
  });

  const handleSelect = (emp: EmployeeDB) => {
    onSelect(emp);
    onClose();
    setSearch("");
  };

  const handleClose = () => {
    onClose();
    setSearch("");
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} onPress={handleClose}>
        <View
          style={[styles.modal, { backgroundColor: theme.surface }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color: theme.text }]}>
            👥 Select Employee
          </Text>

          <View style={[styles.searchBox, {
            backgroundColor: theme.bg,
            borderColor:     theme.border,
          }]}>
            <MaterialIcons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search name, number, position..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <MaterialIcons name="close" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons
                  name="people-outline"
                  size={32}
                  color={theme.textSecondary}
                />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {available.length === 0
                    ? "No employees — add from Employees tab first"
                    : search.trim()
                    ? "No results found"
                    : "All employees already added this week"}
                </Text>
              </View>
            ) : (
              filtered.map((emp) => {
                // ✅ initials RB not just R
                const initials =
                  `${emp.firstName?.[0] ?? ""}${emp.lastName?.[0] ?? ""}`.toUpperCase();
                const fullName = `${emp.firstName} ${emp.lastName}`.trim();

                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.empRow, { borderBottomColor: theme.border }]}
                    onPress={() => handleSelect(emp)}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {initials || "?"}
                      </Text>
                    </View>

                    <View style={styles.empInfo}>
                      <Text style={[styles.empName, { color: theme.text }]}>
                        {fullName}
                      </Text>
                      <Text style={[styles.empSub, { color: theme.textSecondary }]}>
                        {emp.employeeNumber} · {emp.position || emp.role}
                      </Text>
                    </View>

                    {/* ✅ monthlySalary not basicSalary */}
                    <Text style={styles.empSalary}>
                      {fmt(emp.monthlySalary)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent:  "center",
    alignItems:      "center",
    padding:         16,
  },
  modal: {
    width:     "100%",
    maxWidth:  400,
    borderRadius: 18,
    padding:   16,
    maxHeight: "80%",
  },
  title:       { fontSize: 15, fontWeight: "800", marginBottom: 12 },
  searchBox: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    borderWidth:     1.5,
    borderRadius:    9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom:    10,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  list:        { maxHeight: 320 },
  emptyBox:    { padding: 30, alignItems: "center", gap: 10 },
  emptyText:   { fontSize: 13, textAlign: "center" },
  empRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: "#00154f",
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarText: { color: "#FFD700", fontSize: 16, fontWeight: "800" },
  empInfo:    { flex: 1 },
  empName:    { fontSize: 13, fontWeight: "700" },
  empSub:     { fontSize: 11, marginTop: 2 },
  empSalary:  { fontSize: 12, fontWeight: "700", color: "#10b981" },
});