// ============================================
// SERVORA ERP — Shift Constants
// Single source of truth for shift order, labels, icons, and time ranges
// FROZEN
// ============================================

import { MaterialIcons } from "@expo/vector-icons";
import { Shift } from "../types/sales-types";

export const SHIFTS: readonly Shift[] = [
  "Morning",
  "Afternoon",
  "Night",
] as const;

export const SHIFT_ICONS: Record<
  Shift,
  React.ComponentProps<typeof MaterialIcons>["name"]
> = {
  Morning: "wb-sunny",
  Afternoon: "wb-twilight",
  Night: "nights-stay",
};

export const SHIFT_LABELS: Record<Shift, string> = {
  Morning: "Morning",
  Afternoon: "Afternoon",
  Night: "Night",
};

export const SHIFT_TIME_RANGES: Record<
  Shift,
  {
    start: string;
    end: string;
  }
> = {
  Morning: {
    start: "06:00",
    end: "14:00",
  },
  Afternoon: {
    start: "14:00",
    end: "22:00",
  },
  Night: {
    start: "22:00",
    end: "06:00",
  },
};