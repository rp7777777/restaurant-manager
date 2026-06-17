// ============================================
// SERVORA ERP — PayrollFilters Component
// ✅ Search + Status filter
// ✅ ALL / DRAFT / GENERATED / PAID
// ============================================

import React from "react";
import {
  View, Text, TextInput,
  TouchableOpacity, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { PayrollFilterStatus } from "../utils/payroll-filter";

interface Props {
  search: string;
  activeFilter: PayrollFilterStatus;
  onSearchChange: (text: string) => void;
  onFilterChange: (filter: PayrollFilterStatus) => void;
}

const FILTERS: PayrollFilterStatus[] = ["ALL", "DRAFT", "GENERATED", "PAID"];

export function PayrollFilters({
  search,
  activeFilter,
  onSearchChange,
  onFilterChange,
}: Props) {
  const { theme } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* Search */}
      <View style={[styles.searchBox, {
        backgroundColor: theme.bg,
        borderColor:     theme.border,
      }]}>
        <MaterialIcons name="search" size={15} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search name, no, position..."
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={onSearchChange}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")}>
            <MaterialIcons name="close" size={15} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={[styles.tabRow, { borderTopColor: theme.border }]}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.tab,
              activeFilter === f && {
                borderBottomColor: theme.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => onFilterChange(f)}
          >
            <Text style={[
              styles.tabText,
              { color: activeFilter === f ? theme.primary : theme.textSecondary },
            ]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { paddingHorizontal: 12, paddingTop: 8 },
  searchBox: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    borderWidth:     1.5,
    borderRadius:    9,
    paddingHorizontal: 10,
    paddingVertical:   7,
    marginBottom:    8,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  tabRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    marginHorizontal: -12,
    paddingHorizontal: 4,
  },
  tab:     { flex: 1, alignItems: "center", paddingVertical: 9 },
  tabText: { fontSize: 11, fontWeight: "700" },
});