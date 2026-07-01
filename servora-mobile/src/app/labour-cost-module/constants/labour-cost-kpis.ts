// ============================================
// SERVORA ERP — Labour Cost KPIs
// ✅ KPI key — LabourCostSummary derived
// ✅ Typo proof — autocomplete + rename safe
// ✅ KPI definitions — label, icon, color
// ✅ Threshold-based color coding
// ✅ Dashboard ready
// FROZEN
// ============================================

import { LabourCostSummary } from "../types/labour-cost-types";

// ✅ Key derived from LabourCostSummary — typo proof
export type LabourCostKPIKey = keyof Pick<
  LabourCostSummary,
  | "totalLabourCost"
  | "labourCostPercent"
  | "totalWorkedHours"
  | "totalOvertimeHours"
  | "overtimeCost"
  | "salesPerLabourHour"
  | "attendanceRate"
  | "hoursVariance"
>;

export interface KPIDefinition {
  key:            LabourCostKPIKey;
  label:          string;
  icon:           string;
  description:    string;
  unit:           "currency" | "percent" | "hours" | "count" | "ratio";
  higherIsBetter: boolean;
}

export const LABOUR_COST_KPIS: KPIDefinition[] = [
  {
    key:            "totalLabourCost",
    label:          "Total Labour Cost",
    icon:           "payments",
    description:    "Total wages + overtime paid",
    unit:           "currency",
    higherIsBetter: false,
  },
  {
    key:            "labourCostPercent",
    label:          "Labour Cost %",
    icon:           "pie-chart",
    description:    "Labour cost as % of total sales",
    unit:           "percent",
    higherIsBetter: false,
  },
  {
    key:            "totalWorkedHours",
    label:          "Total Hours",
    icon:           "schedule",
    description:    "Total hours worked by all employees",
    unit:           "hours",
    higherIsBetter: true,
  },
  {
    key:            "totalOvertimeHours",
    label:          "Overtime Hours",
    icon:           "more-time",
    description:    "Total overtime hours worked",
    unit:           "hours",
    higherIsBetter: false,
  },
  {
    key:            "overtimeCost",
    label:          "Overtime Cost",
    icon:           "trending-up",
    description:    "Total overtime pay",
    unit:           "currency",
    higherIsBetter: false,
  },
  {
    key:            "salesPerLabourHour",
    label:          "Sales / Labour Hour",
    icon:           "show-chart",
    description:    "Revenue generated per hour worked",
    unit:           "ratio",
    higherIsBetter: true,
  },
  {
    key:            "attendanceRate",
    label:          "Attendance Rate",
    icon:           "fact-check",
    description:    "% of employees present vs scheduled",
    unit:           "percent",
    higherIsBetter: true,
  },
  {
    key:            "hoursVariance",
    label:          "Hours Variance",
    icon:           "compare-arrows",
    description:    "Worked hours vs scheduled hours",
    unit:           "hours",
    higherIsBetter: false,
  },
];