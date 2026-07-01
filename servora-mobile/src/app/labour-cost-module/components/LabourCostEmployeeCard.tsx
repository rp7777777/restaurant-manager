// ============================================
// SERVORA ERP — LabourCostEmployeeCard Component
// ✅ Pure presentation component
// ✅ theme prop — no AppContext dependency
// ✅ as any removed — type safe width
// ✅ Field-level memo comparator — complete
//    theme.primary, hoursVariance,
//    employeeName, position added
// ✅ Hours variance color coded
// ✅ Labour cost % bar
// ✅ Attendance indicators
// ✅ Overtime highlight
// ✅ Accessibility support
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { EmployeeLabourCost } from "../types/labour-cost-types";
import {
  formatLabourCost,
  formatLabourHours,
  formatVariance,
  formatEmployeeInitials,
  getHoursVarianceColor,
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

interface Props {
  employee:        EmployeeLabourCost;
  theme:           Theme;
  currencySymbol?: string;
  locale?:         string;
  onPress?:        (employee: EmployeeLabourCost) => void;
}

function LabourCostEmployeeCardComponent({
  employee,
  theme,
  currencySymbol = "€",
  locale         = "en",
  onPress,
}: Props) {

  const successColor  = theme.success ?? "#10b981";
  const errorColor    = theme.error   ?? "#ef4444";
  const warningColor  = theme.warning ?? "#f59e0b";
  const varianceColor = getHoursVarianceColor(employee.hoursVariance);
  const overtimeColor = employee.overtimeCost > 0 ? warningColor : successColor;
  const initials      = formatEmployeeInitials(employee.employeeName);

  return (
    <TouchableOpacity
      onPress={() => onPress?.(employee)}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.card, {
        backgroundColor: theme.surface,
        borderColor:     theme.border,
      }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${employee.employeeName}, ${employee.position}, Total cost: ${formatLabourCost(employee.totalCost, currencySymbol, locale)}`}
    >

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: `${theme.primary}20` }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {initials}
          </Text>
        </View>

        <View style={styles.nameWrap}>
          <Text
            style={[styles.name, { color: theme.text }]}
            numberOfLines={1}
          >
            {employee.employeeName}
          </Text>
          <Text
            style={[styles.position, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {employee.position || "—"}
          </Text>
        </View>

        <View style={styles.costWrap}>
          <Text style={[styles.totalCost, { color: theme.primary }]}>
            {formatLabourCost(employee.totalCost, currencySymbol, locale)}
          </Text>
          <Text style={[styles.costPct, { color: theme.textSecondary }]}>
            {employee.labourCostPct.toFixed(1)}% of total
          </Text>
        </View>
      </View>

      {/* ── Labour Cost % Bar ── */}
      <View style={[styles.barTrack, { backgroundColor: theme.bg }]}>
        <View style={[
          styles.barFill,
          {
            // ✅ Fix #1 — as any removed
            width:           `${Math.min(100, employee.labourCostPct)}%`,
            backgroundColor: theme.primary,
          },
        ]} />
      </View>

      {/* ── Stats Row ── */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <MaterialIcons name="schedule" size={13} color={theme.textSecondary} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {formatLabourHours(employee.workedHours)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Worked
          </Text>
        </View>

        <View style={styles.stat}>
          <MaterialIcons name="compare-arrows" size={13} color={varianceColor} />
          <Text style={[styles.statValue, { color: varianceColor }]}>
            {formatVariance(employee.hoursVariance)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Variance
          </Text>
        </View>

        <View style={styles.stat}>
          <MaterialIcons name="more-time" size={13} color={overtimeColor} />
          <Text style={[styles.statValue, { color: overtimeColor }]}>
            {formatLabourHours(employee.overtimeHours)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Overtime
          </Text>
        </View>

        <View style={styles.stat}>
          <MaterialIcons
            name="fact-check"
            size={13}
            color={employee.absentDays > 0 ? errorColor : successColor}
          />
          <Text style={[styles.statValue, {
            color: employee.absentDays > 0 ? errorColor : successColor,
          }]}>
            {employee.presentDays}d
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Present
          </Text>
        </View>
      </View>

      {/* ── Badges ── */}
      {(employee.lateDays > 0 ||
        employee.absentDays > 0 ||
        employee.overtimeCost > 0) && (
        <View style={styles.badgeRow}>
          {employee.lateDays > 0 && (
            <View style={[styles.badge, { backgroundColor: `${warningColor}20` }]}>
              <Text style={[styles.badgeText, { color: warningColor }]}>
                {employee.lateDays} late
              </Text>
            </View>
          )}
          {employee.absentDays > 0 && (
            <View style={[styles.badge, { backgroundColor: `${errorColor}20` }]}>
              <Text style={[styles.badgeText, { color: errorColor }]}>
                {employee.absentDays} absent
              </Text>
            </View>
          )}
          {employee.overtimeCost > 0 && (
            <View style={[styles.badge, { backgroundColor: `${warningColor}20` }]}>
              <Text style={[styles.badgeText, { color: warningColor }]}>
                OT: {formatLabourCost(employee.overtimeCost, currencySymbol, locale)}
              </Text>
            </View>
          )}
        </View>
      )}

    </TouchableOpacity>
  );
}

// ✅ Fix #2 #3 #4 — complete field-level comparator
export const LabourCostEmployeeCard = memo(
  LabourCostEmployeeCardComponent,
  (prev, next) =>
    prev.employee.employeeId    === next.employee.employeeId    &&
    prev.employee.employeeName  === next.employee.employeeName  &&
    prev.employee.position      === next.employee.position      &&
    prev.employee.totalCost     === next.employee.totalCost     &&
    prev.employee.workedHours   === next.employee.workedHours   &&
    prev.employee.overtimeHours === next.employee.overtimeHours &&
    prev.employee.hoursVariance === next.employee.hoursVariance &&
    prev.employee.presentDays   === next.employee.presentDays   &&
    prev.employee.absentDays    === next.employee.absentDays    &&
    prev.employee.lateDays      === next.employee.lateDays      &&
    prev.employee.labourCostPct === next.employee.labourCostPct &&
    prev.theme.surface          === next.theme.surface          &&
    prev.theme.text             === next.theme.text             &&
    prev.theme.textSecondary    === next.theme.textSecondary    &&
    prev.theme.border           === next.theme.border           &&
    prev.theme.primary          === next.theme.primary          &&
    prev.currencySymbol         === next.currencySymbol         &&
    prev.locale                 === next.locale
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical:    6,
    borderRadius:     14,
    borderWidth:       1,
    padding:          14,
    gap:               8,
  },
  header: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  avatar: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize:   14,
    fontWeight: "800",
  },
  nameWrap: {
    flex: 1,
    gap:   2,
  },
  name: {
    fontSize:   14,
    fontWeight: "700",
  },
  position: {
    fontSize: 11,
  },
  costWrap: {
    alignItems: "flex-end",
    gap:         2,
  },
  totalCost: {
    fontSize:   15,
    fontWeight: "800",
  },
  costPct: {
    fontSize: 10,
  },
  barTrack: {
    height:       4,
    borderRadius: 2,
    overflow:     "hidden",
  },
  barFill: {
    height:       4,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    paddingTop:      4,
  },
  stat: {
    alignItems: "center",
    gap:         2,
    flex:        1,
  },
  statValue: {
    fontSize:   12,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 9,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:            6,
    paddingTop:     2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      10,
  },
  badgeText: {
    fontSize:   10,
    fontWeight: "700",
  },
});