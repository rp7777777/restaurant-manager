// ============================================
// SERVORA ERP — Employees Screen v2
// ✅ FlatList — performance 500+ employees
// ✅ canManageEmployees — permission system
// ✅ archivingId/restoringId — loading state
// ✅ Multi-restaurant ready
// ✅ Schedule + Payroll master source
// ============================================

import React, { useState, useCallback, useMemo } from "react";
import {
  View, StyleSheet, FlatList,
  Alert, Platform, ActivityIndicator, Text,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useApp } from "../../../context/AppContext";
import { EmployeeDB } from "../types/employee-types";
import { useAllEmployees } from "../hooks/useEmployees";
import { useEmployeeStats } from "../hooks/useEmployeeStats";
import { archiveEmployee, restoreEmployee } from "../services/employee-service";
import { EmployeeStatsBar } from "../components/EmployeeStats";
import { EmployeeSearch, EmployeeFilter, filterEmployees } from "../components/EmployeeSearch";
import { EmployeeCard } from "../components/EmployeeCard";
import { EmployeeForm } from "../components/EmployeeForm";

// ── Permission helper ─────────────────────────
// ✅ v2 — role-based permission
function useEmployeePermissions() {
  const { userProfile } = useApp();
  const role = userProfile?.role ?? "";
  return {
    canManageEmployees: ["MANAGER", "OWNER"].includes(role),
    canViewSalary:      ["MANAGER", "OWNER"].includes(role),
    canArchive:         ["MANAGER", "OWNER"].includes(role),
  };
}

export default function EmployeesScreen() {
  const {
    theme,
    restaurantId,
    restaurant,
  } = useApp();

  const { canManageEmployees, canArchive } = useEmployeePermissions();

  // ── State ──────────────────────────────────
  const [showForm,        setShowForm]        = useState(false);
  const [editEmployee,    setEditEmployee]    = useState<EmployeeDB | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filter,          setFilter]          = useState<EmployeeFilter>({
    search: "",
    status: "ALL",
    role:   "ALL",
  });

  // ✅ v2 — archive/restore loading states
  const [archivingId,  setArchivingId]  = useState<string | null>(null);
  const [restoringId,  setRestoringId]  = useState<string | null>(null);

  // ── Data ───────────────────────────────────
  const { employees, loading } = useAllEmployees(restaurantId, includeArchived);
  const stats = useEmployeeStats(employees);

  // ── Filtered list ──────────────────────────
  const filtered = useMemo(
    () => filterEmployees(employees, filter),
    [employees, filter]
  );

  // ── Existing employees for form ────────────
  const existingEmployees = useMemo(
    () => employees.map((e) => ({ id: e.id, employeeNumber: e.employeeNumber })),
    [employees]
  );

  // ── Handlers ──────────────────────────────
  const handleAddNew = useCallback(() => {
    setEditEmployee(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((emp: EmployeeDB) => {
    setEditEmployee(emp);
    setShowForm(true);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    setEditEmployee(null);
  }, []);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditEmployee(null);
  }, []);

  // ✅ v2 — archive with loading state
  const handleArchive = useCallback((emp: EmployeeDB) => {
    Alert.alert(
      "Archive Employee",
      `Archive ${emp.firstName} ${emp.lastName}? They will be hidden from Schedule and Payroll.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text:  "Archive",
          style: "destructive",
          onPress: async () => {
            setArchivingId(emp.id);
            try {
              const result = await archiveEmployee(restaurantId, emp.id);
              if (!result.success) {
                Alert.alert("Error", result.error ?? "Failed to archive");
              }
            } finally {
              setArchivingId(null);
            }
          },
        },
      ]
    );
  }, [restaurantId]);

  // ✅ v2 — restore with loading state
  const handleRestore = useCallback((emp: EmployeeDB) => {
    Alert.alert(
      "Restore Employee",
      `Restore ${emp.firstName} ${emp.lastName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text:    "Restore",
          onPress: async () => {
            setRestoringId(emp.id);
            try {
              const result = await restoreEmployee(restaurantId, emp.id);
              if (!result.success) {
                Alert.alert("Error", result.error ?? "Failed to restore");
              }
            } finally {
              setRestoringId(null);
            }
          },
        },
      ]
    );
  }, [restaurantId]);

  // ── FlatList render ───────────────────────
  // ✅ v2 — FlatList for 500+ employees
  const renderEmployee = useCallback(({ item }: { item: EmployeeDB }) => (
    <EmployeeCard
      key={item.id}
      employee={item}
      onEdit={canManageEmployees ? handleEdit : undefined}
      onArchive={canArchive ? handleArchive : undefined}
      onRestore={canArchive ? handleRestore : undefined}
      isManager={canManageEmployees}
      isArchiving={archivingId === item.id}
      isRestoring={restoringId === item.id}
    />
  ), [canManageEmployees, canArchive, handleEdit, handleArchive, handleRestore, archivingId, restoringId]);

  const keyExtractor = useCallback((item: EmployeeDB) => item.id, []);

  // ── List header ───────────────────────────
  const ListHeader = useMemo(() => (
    <View>
      {/* Stats */}
      <EmployeeStatsBar stats={stats} />

      {/* Form */}
      {showForm && canManageEmployees && (
        <View style={{ marginBottom: 14 }}>
          <EmployeeForm
            restaurantId={restaurantId}
            restaurantName={restaurant?.name ?? ""}
            existingEmployees={existingEmployees}
            editEmployee={editEmployee}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </View>
      )}

      {/* Search */}
      <EmployeeSearch
        filter={filter}
        onFilterChange={setFilter}
        totalCount={employees.length}
        filteredCount={filtered.length}
      />
    </View>
  ), [
    stats, showForm, canManageEmployees,
    restaurantId, restaurant, existingEmployees,
    editEmployee, handleFormSuccess, handleFormCancel,
    filter, employees.length, filtered.length,
  ]);

  // ── Empty component ───────────────────────
  const ListEmpty = useMemo(() => (
    loading ? (
      <ActivityIndicator color={theme.primary} style={{ marginTop: 30 }} />
    ) : (
      <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
        <MaterialIcons name="people-outline" size={48} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          {employees.length === 0 ? "No employees yet" : "No results found"}
        </Text>
        {employees.length === 0 && canManageEmployees && (
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Add employees to connect with Schedule & Payroll
          </Text>
        )}
      </View>
    )
  ), [loading, theme, employees.length, canManageEmployees]);

  // ─────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>EMPLOYEES</Text>
            <Text style={styles.headerSub}>
              {restaurant?.name ?? "Master Database"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerBtn,
                includeArchived && { backgroundColor: "rgba(255,255,255,0.2)" },
              ]}
              onPress={() => setIncludeArchived((v) => !v)}
            >
              <MaterialIcons
                name="archive"
                size={18}
                color={includeArchived ? "#FFD700" : "rgba(255,255,255,0.6)"}
              />
            </TouchableOpacity>

            {canManageEmployees && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={showForm ? handleFormCancel : handleAddNew}
              >
                <MaterialIcons
                  name={showForm ? "close" : "person-add"}
                  size={20}
                  color="#00154f"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* ✅ v2 — FlatList */}
      <FlatList
        data={filtered}
        renderItem={renderEmployee}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { paddingTop: Platform.OS === "web" ? 28 : 50, paddingBottom: 24, paddingHorizontal: 20 },
  headerRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  headerTitle:   { color: "#FFD700", fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  headerSub:     { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
 headerActions:  { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  addBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center" },
  body:          { padding: 14, paddingBottom: 40 },
  emptyBox:      { borderRadius: 14, padding: 40, alignItems: "center", gap: 8 },
  emptyText:     { fontSize: 14, fontWeight: "700" },
  emptySub:      { fontSize: 12, textAlign: "center" },
});
