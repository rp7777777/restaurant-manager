// ============================================
// SERVORA ERP — EmployeeSearch Component
// ✅ position?.toLowerCase — crash safe
// ✅ localSearch sync — parent reset works
// ✅ Debounced search — 300ms
// ✅ Status + Role filter chips
// ✅ memo — no re-renders
// FROZEN
// ============================================

import React, { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { EmployeeDB, EmployeeStatus, EmployeeRole } from "../types/employee-types";
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS } from "../constants/employee-status";
import { EMPLOYEE_ROLES, EMPLOYEE_ROLE_LABELS } from "../constants/employee-roles";
import { STATUS_COLORS } from "../constants/employee-status-colors";

// ── Filter state ──────────────────────────────
export interface EmployeeFilter {
  search: string;
  status: EmployeeStatus | "ALL";
  role:   EmployeeRole   | "ALL";
}

// ── Filter function ───────────────────────────
export function filterEmployees(
  employees: EmployeeDB[],
  filter: EmployeeFilter,
): EmployeeDB[] {
  return employees.filter((emp) => {
    if (filter.status !== "ALL" && emp.status !== filter.status) return false;
    if (filter.role   !== "ALL" && emp.role   !== filter.role)   return false;

    if (filter.search.trim()) {
      const q        = filter.search.toLowerCase();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      return (
        fullName.includes(q)                                    ||
        emp.employeeNumber.toLowerCase().includes(q)            ||
        // ✅ Fix #1 — crash safe
        (emp.position ?? "").toLowerCase().includes(q)          ||
        emp.role.toLowerCase().includes(q)
      );
    }

    return true;
  });
}

// ── Props ─────────────────────────────────────
interface EmployeeSearchProps {
  filter:         EmployeeFilter;
  onFilterChange: (filter: EmployeeFilter) => void;
  totalCount:     number;
  filteredCount:  number;
}

export const EmployeeSearch = memo(({
  filter,
  onFilterChange,
  totalCount,
  filteredCount,
}: EmployeeSearchProps) => {
  const { theme } = useApp();
  const [localSearch, setLocalSearch] = useState(filter.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Fix #2 — sync localSearch when parent resets filter
  useEffect(() => {
    setLocalSearch(filter.search);
  }, [filter.search]);

  // Debounced search — 300ms
  const handleSearchChange = useCallback((text: string) => {
    setLocalSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ ...filter, search: text });
    }, 300);
  }, [filter, onFilterChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleStatusFilter = useCallback((status: EmployeeStatus | "ALL") => {
    onFilterChange({ ...filter, status });
  }, [filter, onFilterChange]);

  const handleRoleFilter = useCallback((role: EmployeeRole | "ALL") => {
    onFilterChange({ ...filter, role });
  }, [filter, onFilterChange]);

  const handleClear = useCallback(() => {
    setLocalSearch("");
    onFilterChange({ search: "", status: "ALL", role: "ALL" });
  }, [onFilterChange]);

  const hasActiveFilter =
    filter.search.trim() !== "" ||
    filter.status !== "ALL"     ||
    filter.role   !== "ALL";

  return (
    <View style={styles.container}>

      {/* Search input */}
      <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <MaterialIcons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search name, number, position..."
          placeholderTextColor={theme.textSecondary}
          value={localSearch}
          onChangeText={handleSearchChange}
        />
        {localSearch.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange("")}>
            <MaterialIcons name="close" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: theme.border },
            filter.status === "ALL" && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => handleStatusFilter("ALL")}
        >
          <Text style={[styles.chipText, { color: filter.status === "ALL" ? theme.accent : theme.textSecondary }]}>
            All
          </Text>
        </TouchableOpacity>
        {EMPLOYEE_STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.chip,
              { borderColor: STATUS_COLORS[s] + "60" },
              filter.status === s && { backgroundColor: STATUS_COLORS[s] + "25", borderColor: STATUS_COLORS[s] },
            ]}
            onPress={() => handleStatusFilter(s)}
          >
            <View style={[styles.dot, { backgroundColor: STATUS_COLORS[s] }]} />
            <Text style={[styles.chipText, { color: STATUS_COLORS[s] }]}>
              {EMPLOYEE_STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Role chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: theme.border },
            filter.role === "ALL" && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => handleRoleFilter("ALL")}
        >
          <Text style={[styles.chipText, { color: filter.role === "ALL" ? theme.accent : theme.textSecondary }]}>
            All Roles
          </Text>
        </TouchableOpacity>
        {EMPLOYEE_ROLES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.chip,
              { borderColor: theme.border },
              filter.role === r && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => handleRoleFilter(r)}
          >
            <Text style={[styles.chipText, { color: filter.role === r ? theme.accent : theme.textSecondary }]}>
              {EMPLOYEE_ROLE_LABELS[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Result count + clear */}
      <View style={styles.resultRow}>
        <Text style={[styles.resultText, { color: theme.textSecondary }]}>
          {filteredCount === totalCount
            ? `${totalCount} employees`
            : `${filteredCount} of ${totalCount} employees`
          }
        </Text>
        {hasActiveFilter && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <MaterialIcons name="filter-alt-off" size={14} color={theme.primary} />
            <Text style={[styles.clearText, { color: theme.primary }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
});

const styles = StyleSheet.create({
  container:   { gap: 8, marginBottom: 4 },
  searchBox:   { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chips:       { flexDirection: "row" },
  chip:        { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  chipText:    { fontSize: 11, fontWeight: "700" },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  resultRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultText:  { fontSize: 12 },
  clearBtn:    { flexDirection: "row", alignItems: "center", gap: 4 },
  clearText:   { fontSize: 12, fontWeight: "700" },
});