// ============================================
// SERVORA ERP — Schedule Statuses
// ✅ DO/DC = Day Off (label only)
// ============================================

import { DayStatus } from "../types/schedule-types";

export const STATUS_COLORS: Record<DayStatus, string> = {
  WORK:     "#10b981",
  DO:       "#f97316",
  DC:       "#dc2626",
  ABSENT:   "#94a3b8",
  HOLIDAY:  "#8b5cf6",
  SICK:     "#ef4444",
  VACATION: "#06b6d4",
  TRAINING: "#f59e0b",
};

export const STATUS_BG: Record<DayStatus, string> = {
  WORK:     "#10b98115",
  DO:       "#f9731615",
  DC:       "#dc262615",
  ABSENT:   "#94a3b815",
  HOLIDAY:  "#8b5cf615",
  SICK:     "#ef444415",
  VACATION: "#06b6d415",
  TRAINING: "#f59e0b15",
};

export const STATUS_LABEL: Record<DayStatus, string> = {
  WORK:     "Working",
  DO:       "Day Off",
  DC:       "Day Off",
  ABSENT:   "Absent",
  HOLIDAY:  "Public Holiday",
  SICK:     "Sick Leave",
  VACATION: "Vacation",
  TRAINING: "Training",
};

export const ALL_STATUSES: DayStatus[] = [
  "WORK", "DO", "DC", "ABSENT",
  "HOLIDAY", "SICK", "VACATION", "TRAINING",
];

export const STATUS_OPTIONS = ALL_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABEL[status],
  color: STATUS_COLORS[status],
  bg:    STATUS_BG[status],
}));