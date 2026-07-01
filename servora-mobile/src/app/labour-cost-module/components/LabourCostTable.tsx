// ============================================
// SERVORA ERP — LabourCostTable Component
// ✅ Pure presentation component
// ✅ theme prop — no AppContext dependency
// ✅ formatVariance unused import removed
// ✅ onEndReached removed — scrollEnabled=false
// ✅ localeCompare — locale + sensitivity base
// ✅ Complete memo comparator — all theme fields
// ✅ onPressEmployee in comparator
// ✅ FlatList — 500+ employees performance
// ✅ Sortable columns
// ✅ Pagination — DEFAULT_PAGE_SIZE
// ✅ Empty state handled
// FROZEN
// ============================================

import React, { memo, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { EmployeeLabourCost } from "../types/labour-cost-types";
import { LABOUR_COST_TABLE_CONFIG } from "../constants/labour-cost-config";
import {
  formatLabourCost,
  formatLabourHours,
  formatEmployeeInitials,
} from "../utils/labour-cost-format";

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
  success?:      string;
  warning?:      string;
  error?:        string;
}

type SortKey = "employeeName" | "totalCost" | "workedHours" |
               "overtimeHours" | "labourCostPct" | "absentDays";
type SortDir = "asc" | "desc";

interface Props {
  employees:        EmployeeLabourCost[];
  theme:            Theme;
  currencySymbol?:  string;
  locale?:          string;
  onPressEmployee?: (emp: EmployeeLabourCost) => void;
}

interface Column {
  key:   SortKey;
  label: string;
  width: number;
  align: "left" | "right";
}

const COLUMNS: Column[] = [
  { key: "employeeName",  label: "Employee", width: 130, align: "left"  },
  { key: "totalCost",     label: "Cost",     width: 80,  align: "right" },
  { key: "workedHours",   label: "Hours",    width: 70,  align: "right" },
  { key: "overtimeHours", label: "OT",       width: 60,  align: "right" },
  { key: "labourCostPct", label: "% Total",  width: 65,  align: "right" },
  { key: "absentDays",    label: "Absent",   width: 60,  align: "right" },
];

// ── Row component ─────────────────────────────
const TableRow = memo(function TableRow({
  employee,
  index,
  theme,
  currencySymbol,
  locale,
  onPress,
}: {
  employee:       EmployeeLabourCost;
  index:          number;
  theme:          Theme;
  currencySymbol: string;
  locale:         string;
  onPress?:       (emp: EmployeeLabourCost) => void;
}) {
  const successColor = theme.success ?? "#10b981";
  const errorColor   = theme.error   ?? "#ef4444";
  const warningColor = theme.warning ?? "#f59e0b";
  const isEven       = index % 2 === 0;
  const initials     = formatEmployeeInitials(employee.employeeName);

  return (
    <TouchableOpacity
      onPress={() => onPress?.(employee)}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.row, {
        backgroundColor:   isEven ? theme.surface : theme.bg,
        borderBottomColor: theme.border,
      }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${employee.employeeName}, cost: ${formatLabourCost(employee.totalCost, currencySymbol, locale)}`}
    >
      {/* ── Employee ── */}
      <View style={[styles.cell, { width: COLUMNS[0].width }]}>
        <View style={[styles.miniAvatar, { backgroundColor: `${theme.primary}20` }]}>
          <Text style={[styles.miniAvatarText, { color: theme.primary }]}>
            {initials}
          </Text>
        </View>
        <View style={styles.nameCol}>
          <Text
            style={[styles.nameText, { color: theme.text }]}
            numberOfLines={1}
          >
            {employee.employeeName}
          </Text>
          <Text
            style={[styles.posText, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {employee.position || "—"}
          </Text>
        </View>
      </View>

      {/* ── Cost ── */}
      <Text style={[styles.cellRight, {
        width: COLUMNS[1].width,
        color: theme.primary,
      }]}>
        {formatLabourCost(employee.totalCost, currencySymbol, locale)}
      </Text>

      {/* ── Hours ── */}
      <Text style={[styles.cellRight, {
        width: COLUMNS[2].width,
        color: theme.text,
      }]}>
        {formatLabourHours(employee.workedHours)}
      </Text>

      {/* ── OT ── */}
      <Text style={[styles.cellRight, {
        width: COLUMNS[3].width,
        color: employee.overtimeHours > 0 ? warningColor : theme.textSecondary,
      }]}>
        {employee.overtimeHours > 0
          ? formatLabourHours(employee.overtimeHours)
          : "—"}
      </Text>

      {/* ── % Total ── */}
      <Text style={[styles.cellRight, {
        width: COLUMNS[4].width,
        color: theme.textSecondary,
      }]}>
        {employee.labourCostPct.toFixed(1)}%
      </Text>

      {/* ── Absent ── */}
      <Text style={[styles.cellRight, {
        width:      COLUMNS[5].width,
        color:      employee.absentDays > 0 ? errorColor : successColor,
        fontWeight: employee.absentDays > 0 ? "700" : "400",
      }]}>
        {employee.absentDays > 0 ? `${employee.absentDays}d` : "—"}
      </Text>
    </TouchableOpacity>
  );
});

// ── LabourCostTable ───────────────────────────
function LabourCostTableComponent({
  employees,
  theme,
  currencySymbol = "€",
  locale         = "en",
  onPressEmployee,
}: Props) {

  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page,    setPage]    = useState(0);

  const pageSize = LABOUR_COST_TABLE_CONFIG.DEFAULT_PAGE_SIZE;

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => d === "asc" ? "desc" : "asc");
        return prev;
      }
      setSortDir("desc");
      return key;
    });
    setPage(0);
  }, []);

  // ✅ localeCompare — locale + sensitivity base
  const sorted = useMemo(() => {
    return [...employees].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal, locale, { sensitivity: "base" })
          : bVal.localeCompare(aVal, locale, { sensitivity: "base" });
      }
      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [employees, sortKey, sortDir, locale]);

  const paginated = useMemo(
    () => sorted.slice(0, (page + 1) * pageSize),
    [sorted, page, pageSize]
  );

  const hasMore = paginated.length < sorted.length;

  const handleLoadMore = useCallback(() => {
    if (hasMore) setPage((p) => p + 1);
  }, [hasMore]);

  const keyExtractor = useCallback(
    (item: EmployeeLabourCost) => item.employeeId,
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: EmployeeLabourCost; index: number }) => (
      <TableRow
        employee={item}
        index={index}
        theme={theme}
        currencySymbol={currencySymbol}
        locale={locale}
        onPress={onPressEmployee}
      />
    ),
    [theme, currencySymbol, locale, onPressEmployee]
  );

  const ListHeader = useMemo(() => (
    <View style={[styles.headerRow, {
      backgroundColor:   theme.surface,
      borderBottomColor: theme.border,
    }]}>
      {COLUMNS.map((col) => {
        const isActive = sortKey === col.key;
        return (
          <TouchableOpacity
            key={col.key}
            onPress={() => handleSort(col.key)}
            style={[
              styles.headerCell,
              { width: col.width },
              col.align === "right" && styles.headerCellRight,
            ]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${col.label}`}
          >
            <Text style={[
              styles.headerText,
              { color: isActive ? theme.primary : theme.textSecondary },
            ]}>
              {col.label}
            </Text>
            {isActive && (
              <MaterialIcons
                name={sortDir === "asc" ? "arrow-upward" : "arrow-downward"}
                size={10}
                color={theme.primary}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  ), [sortKey, sortDir, theme, handleSort]);

  if (employees.length === 0) {
    return (
      <View style={[styles.wrapper, {
        backgroundColor: theme.surface,
        borderColor:     theme.border,
      }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          Employee Breakdown
        </Text>
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No employee data
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, {
      backgroundColor: theme.surface,
      borderColor:     theme.border,
    }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Employee Breakdown
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {"  "}{employees.length} employees
        </Text>
      </Text>

      <FlatList
        data={paginated}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        removeClippedSubviews={Platform.OS !== "web"}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              onPress={handleLoadMore}
              style={[styles.loadMore, { borderTopColor: theme.border }]}
            >
              <Text style={[styles.loadMoreText, { color: theme.primary }]}>
                Load more ({sorted.length - paginated.length} remaining)
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

// ✅ Complete memo comparator — all theme fields + onPressEmployee
export const LabourCostTable = memo(
  LabourCostTableComponent,
  (prev, next) =>
    prev.employees           === next.employees           &&
    prev.currencySymbol      === next.currencySymbol      &&
    prev.locale              === next.locale              &&
    // ✅ onPressEmployee added
    prev.onPressEmployee     === next.onPressEmployee     &&
    // ✅ All theme fields used in rows
    prev.theme.primary       === next.theme.primary       &&
    prev.theme.surface       === next.theme.surface       &&
    prev.theme.border        === next.theme.border        &&
    prev.theme.bg            === next.theme.bg            &&
    prev.theme.text          === next.theme.text          &&
    prev.theme.textSecondary === next.theme.textSecondary &&
    prev.theme.success       === next.theme.success       &&
    prev.theme.warning       === next.theme.warning       &&
    prev.theme.error         === next.theme.error
);

const styles = StyleSheet.create({
  wrapper: {
    margin:       12,
    borderRadius: 16,
    borderWidth:   1,
    overflow:     "hidden",
  },
  title: {
    fontSize:      14,
    fontWeight:    "800",
    padding:       14,
    paddingBottom: 10,
  },
  count: {
    fontSize:   12,
    fontWeight: "400",
  },
  headerRow: {
    flexDirection:     "row",
    paddingHorizontal: 12,
    paddingVertical:    8,
    borderBottomWidth:  1,
  },
  headerCell: {
    flexDirection: "row",
    alignItems:    "center",
    gap:            2,
  },
  headerCellRight: {
    justifyContent: "flex-end",
  },
  headerText: {
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 0.3,
  },
  row: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderBottomWidth:  0.5,
  },
  cell: {
    flexDirection: "row",
    alignItems:    "center",
    gap:            6,
  },
  cellRight: {
    fontSize:  12,
    textAlign: "right",
  },
  miniAvatar: {
    width:          26,
    height:         26,
    borderRadius:   13,
    alignItems:     "center",
    justifyContent: "center",
  },
  miniAvatarText: {
    fontSize:   9,
    fontWeight: "800",
  },
  nameCol: {
    flex: 1,
    gap:   1,
  },
  nameText: {
    fontSize:   12,
    fontWeight: "600",
  },
  posText: {
    fontSize: 10,
  },
  emptyBox: {
    height:         80,
    alignItems:     "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
  },
  loadMore: {
    padding:        14,
    alignItems:     "center",
    borderTopWidth: 1,
  },
  loadMoreText: {
    fontSize:   12,
    fontWeight: "700",
  },
});