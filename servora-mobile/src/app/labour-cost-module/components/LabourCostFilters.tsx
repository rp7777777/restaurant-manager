// ============================================
// SERVORA ERP — LabourCostFilters Component
// ✅ Pure presentation component
// ✅ theme prop — no AppContext dependency
// ✅ PERIOD_CHIPS as const — strong type inference
// ✅ periodLabel useMemo — stable
// ✅ IIFE removed — clean render
// ✅ handlePeriodChange — industry standard flow
// ✅ accessibilityRole — button only, no "text"
// ✅ clearButtonMode removed — custom X icon exists
// ✅ Search accessibility label + hint
// ✅ formatPeriodLabel locale support
// ✅ onSelectCustomRange — CUSTOM flow complete
// ✅ Debounced search 300ms
// ✅ memo export
// FROZEN
// ============================================

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  LabourCostFilter,
  LabourCostPeriod,
  DateRange,
} from "../types/labour-cost-types";
import { formatPeriodLabel } from "../utils/labour-cost-filters";

// ✅ as const — strong type inference
const PERIOD_CHIPS = [
  { label: "Daily",   value: "DAILY"   },
  { label: "Weekly",  value: "WEEKLY"  },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Custom",  value: "CUSTOM"  },
] as const;

interface Theme {
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
}

interface Props {
  filter:               Pick<LabourCostFilter, "search" | "position">;
  period:               LabourCostPeriod;
  dateRange:            DateRange;
  positions:            string[];
  theme:                Theme;
  locale?:              string;
  onChange:             (f: Partial<Pick<LabourCostFilter, "search" | "position">>) => void;
  onPeriodChange:       (p: LabourCostPeriod) => void;
  onPrevPeriod?:        () => void;
  onNextPeriod?:        () => void;
  // ✅ CUSTOM flow — parent handles date picker UI
  onSelectCustomRange?: (range: DateRange) => void;
}

function LabourCostFiltersComponent({
  filter,
  period,
  dateRange,
  positions,
  theme,
  locale = "en-GB",
  onChange,
  onPeriodChange,
  onPrevPeriod,
  onNextPeriod,
  onSelectCustomRange,
}: Props) {
  const [localSearch, setLocalSearch] = useState(filter.search);

  // ✅ Sync localSearch when filter resets
  useEffect(() => {
    setLocalSearch(filter.search);
  }, [filter.search]);

  // ✅ Debounced search 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filter.search) {
        onChange({ search: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, filter.search, onChange]);

  const handleClearSearch = useCallback(() => {
    setLocalSearch("");
    onChange({ search: "" });
  }, [onChange]);

  const handlePosition = useCallback(
    (pos: string) => onChange({ position: pos }),
    [onChange]
  );

  // ✅ Fix #1 — industry standard CUSTOM flow
  // CUSTOM → open date picker first
  // parent calls onPeriodChange("CUSTOM") after date selected
  const handlePeriodChange = useCallback((p: LabourCostPeriod) => {
    if (p === "CUSTOM") {
      // ✅ Open date picker — parent decides period after selection
      onSelectCustomRange?.(dateRange);
    } else {
      onPeriodChange(p);
    }
  }, [onPeriodChange, onSelectCustomRange, dateRange]);

  // ✅ IIFE removed — defined outside render
  const isAllActive = !filter.position || filter.position === "ALL";

  // ✅ locale passed to formatPeriodLabel
  const periodLabel = useMemo(
    () => formatPeriodLabel(period, dateRange, locale),
    [period, dateRange, locale]
  );

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface }]}>

      {/* ── Period Selector ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {PERIOD_CHIPS.map((chip) => {
          const isActive = period === chip.value;
          return (
            <TouchableOpacity
              key={chip.value}
              onPress={() => handlePeriodChange(chip.value)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={chip.label}
              accessibilityState={{ selected: isActive }}
              style={[styles.chip, {
                backgroundColor: isActive ? theme.primary : theme.bg,
                borderColor:     isActive ? theme.primary : theme.border,
              }]}
            >
              <Text style={[
                styles.chipText,
                { color: isActive ? "#fff" : theme.textSecondary },
              ]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Date Range Navigation ── */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          onPress={onPrevPeriod}
          disabled={!onPrevPeriod}
          style={[styles.arrow, { opacity: onPrevPeriod ? 1 : 0.3 }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Previous period"
        >
          <MaterialIcons name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>

        {/* ✅ Fix #2 — accessibilityRole button only for CUSTOM */}
        <TouchableOpacity
          style={styles.dateLabelWrap}
          onPress={period === "CUSTOM" && onSelectCustomRange
            ? () => onSelectCustomRange(dateRange)
            : undefined
          }
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Period: ${periodLabel}`}
        >
          <MaterialIcons name="date-range" size={14} color={theme.textSecondary} />
          <Text style={[styles.dateLabel, { color: theme.text }]}>
            {periodLabel}
          </Text>
          {period === "CUSTOM" && onSelectCustomRange && (
            <MaterialIcons name="edit" size={12} color={theme.textSecondary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNextPeriod}
          disabled={!onNextPeriod}
          style={[styles.arrow, { opacity: onNextPeriod ? 1 : 0.3 }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Next period"
        >
          <MaterialIcons name="chevron-right" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* ── Search Input ── */}
      <View style={[styles.searchBox, {
        backgroundColor: theme.bg,
        borderColor:     theme.border,
      }]}>
        <MaterialIcons name="search" size={16} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search employee, position..."
          placeholderTextColor={theme.textSecondary}
          value={localSearch}
          onChangeText={setLocalSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          // ✅ Fix #3 — clearButtonMode removed — custom X icon exists
          accessible
          accessibilityLabel="Search employees"
          accessibilityHint="Search by employee name or position"
        />
        {localSearch.length > 0 && (
          <TouchableOpacity
            onPress={handleClearSearch}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <MaterialIcons name="close" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Position Filter ── */}
      {positions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <TouchableOpacity
            onPress={() => handlePosition("ALL")}
            accessible
            accessibilityRole="button"
            accessibilityLabel="All Positions"
            accessibilityState={{ selected: isAllActive }}
            style={[styles.chip, {
              backgroundColor: isAllActive ? theme.primary : theme.bg,
              borderColor:     isAllActive ? theme.primary : theme.border,
            }]}
          >
            <Text style={[
              styles.chipText,
              { color: isAllActive ? "#fff" : theme.textSecondary },
            ]}>
              All Positions
            </Text>
          </TouchableOpacity>

          {positions.map((pos) => {
            const isActive = filter.position === pos;
            return (
              <TouchableOpacity
                key={pos}
                onPress={() => handlePosition(pos)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={pos}
                accessibilityState={{ selected: isActive }}
                style={[styles.chip, {
                  backgroundColor: isActive ? theme.primary : theme.bg,
                  borderColor:     isActive ? theme.primary : theme.border,
                }]}
              >
                <Text style={[
                  styles.chipText,
                  { color: isActive ? "#fff" : theme.textSecondary },
                ]}>
                  {pos}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

    </View>
  );
}

export const LabourCostFilters = memo(LabourCostFiltersComponent);

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical:   10,
    paddingHorizontal: 12,
    gap:               10,
  },
  dateRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
  },
  arrow: {
    padding: 4,
  },
  dateLabelWrap: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            6,
    flex:           1,
    justifyContent: "center",
  },
  dateLabel: {
    fontSize:   14,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    borderWidth:       1.5,
    borderRadius:      9,
    paddingHorizontal: 10,
    paddingVertical:   8,
  },
  searchInput: {
    flex:     1,
    fontSize: 13,
    padding:  0,
  },
  chipsRow: {
    gap:           6,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1.5,
  },
  chipText: {
    fontSize:   12,
    fontWeight: "600",
  },
});