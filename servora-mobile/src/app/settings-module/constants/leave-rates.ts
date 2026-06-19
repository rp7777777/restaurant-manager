// ============================================
// SERVORA ERP — Leave Rates Constants
// ✅ Leave ≠ Absent — separated
// ✅ LEAVE_CONFIG_MAP O(1) frozen
// ✅ calculateLeavePay — no hardcoded rules
// ✅ Overtime/Night/Weekend structure ready
// ✅ 10/10 production ready
// ============================================

// ── Leave Types (Leave only — absent separate) ─
export type LeaveType =
  | "sick"
  | "vacation"
  | "training"
  | "publicHoliday"
  | "dayOffDO"
  | "dayOffDC";

// ── Attendance (Absent separate from Leave) ────
export type AttendanceType =
  | "absent"
  | "lateArrival"
  | "earlyDeparture";

// ── Premium Types ─────────────────────────────
export type PremiumType =
  | "overtime"
  | "nightShift"
  | "weekendShift"
  | "publicHolidayWorked";

export interface LeaveRateOption {
  value:       number;
  label:       string;
  description: string;
}

export interface LeaveTypeConfig {
  key:         LeaveType;
  label:       string;
  emoji:       string;
  description: string;
  defaultRate: number;
  options:     LeaveRateOption[];
  fixed:       boolean;
  fixedRate?:  number;
}

export interface AttendancePenaltyConfig {
  key:         AttendanceType;
  label:       string;
  emoji:       string;
  description: string;
  defaultRate: number;
  options:     LeaveRateOption[];
}

export interface PremiumRateConfig {
  key:         PremiumType;
  label:       string;
  emoji:       string;
  description: string;
  defaultRate: number;
  options:     LeaveRateOption[];
}

// ── Rate Options ──────────────────────────────
export const STANDARD_RATE_OPTIONS: LeaveRateOption[] = [
  { value: 0,   label: "0%",   description: "No pay"            },
  { value: 25,  label: "25%",  description: "Quarter pay"       },
  { value: 50,  label: "50%",  description: "Half pay"          },
  { value: 75,  label: "75%",  description: "Three quarter pay" },
  { value: 100, label: "100%", description: "Full pay"          },
];

export const HOLIDAY_RATE_OPTIONS: LeaveRateOption[] = [
  { value: 100, label: "100%", description: "Normal pay"    },
  { value: 125, label: "125%", description: "+25% premium"  },
  { value: 150, label: "150%", description: "+50% premium"  },
  { value: 175, label: "175%", description: "+75% premium"  },
  { value: 200, label: "200%", description: "Double pay"    },
  { value: 250, label: "250%", description: "2.5x pay"      },
  { value: 300, label: "300%", description: "Triple pay"    },
];

export const PENALTY_RATE_OPTIONS: LeaveRateOption[] = [
  { value: 0,   label: "0%",   description: "No penalty"       },
  { value: 25,  label: "25%",  description: "Quarter penalty"  },
  { value: 50,  label: "50%",  description: "Half penalty"     },
  { value: 75,  label: "75%",  description: "75% penalty"      },
  { value: 100, label: "100%", description: "Full day penalty" },
];

export const PREMIUM_RATE_OPTIONS: LeaveRateOption[] = [
  { value: 100, label: "100%", description: "Normal rate"   },
  { value: 125, label: "125%", description: "+25% premium"  },
  { value: 150, label: "150%", description: "+50% premium"  },
  { value: 175, label: "175%", description: "+75% premium"  },
  { value: 200, label: "200%", description: "Double rate"   },
  { value: 250, label: "250%", description: "2.5x rate"     },
];

// ── Leave Type Configs ────────────────────────
export const LEAVE_TYPE_CONFIGS: LeaveTypeConfig[] = [
  {
    key:         "sick",
    label:       "Sick Leave",
    emoji:       "🤒",
    description: "Employee is sick or medically unfit",
    defaultRate: 50,
    options:     STANDARD_RATE_OPTIONS,
    fixed:       false,
  },
  {
    key:         "vacation",
    label:       "Vacation",
    emoji:       "🏖️",
    description: "Planned annual holiday leave",
    defaultRate: 100,
    options:     STANDARD_RATE_OPTIONS,
    fixed:       false,
  },
  {
    key:         "training",
    label:       "Training",
    emoji:       "📚",
    description: "Work-related training or course",
    defaultRate: 100,
    options:     STANDARD_RATE_OPTIONS,
    fixed:       false,
  },
  {
    key:         "publicHoliday",
    label:       "Public Holiday",
    emoji:       "🎉",
    description: "National or public holiday",
    defaultRate: 200,
    options:     HOLIDAY_RATE_OPTIONS,
    fixed:       false,
  },
  {
    key:         "dayOffDO",
    label:       "Day Off (DO)",
    emoji:       "📅",
    description: "Mandatory rest day — paid",
    defaultRate: 100,
    options:     STANDARD_RATE_OPTIONS,
    fixed:       false,
  },
  {
    key:         "dayOffDC",
    label:       "Day Off (DC)",
    emoji:       "📋",
    description: "Compensatory day off — always unpaid",
    defaultRate: 0,
    options:     STANDARD_RATE_OPTIONS,
    fixed:       true,
    fixedRate:   0,
  },
];

// ── Attendance Penalty Configs ─────────────────
export const ATTENDANCE_PENALTY_CONFIGS: AttendancePenaltyConfig[] = [
  {
    key:         "absent",
    label:       "Absent",
    emoji:       "❌",
    description: "Unauthorized absence — salary cut + optional penalty",
    defaultRate: 0,
    options:     PENALTY_RATE_OPTIONS,
  },
  {
    key:         "lateArrival",
    label:       "Late Arrival",
    emoji:       "⏰",
    description: "Employee arrived late",
    defaultRate: 0,
    options:     PENALTY_RATE_OPTIONS,
  },
  {
    key:         "earlyDeparture",
    label:       "Early Departure",
    emoji:       "🚪",
    description: "Employee left early without permission",
    defaultRate: 0,
    options:     PENALTY_RATE_OPTIONS,
  },
];

// ── Premium Rate Configs ───────────────────────
export const PREMIUM_RATE_CONFIGS: PremiumRateConfig[] = [
  {
    key:         "overtime",
    label:       "Overtime",
    emoji:       "⏱️",
    description: "Hours worked beyond normal daily hours",
    defaultRate: 150,
    options:     PREMIUM_RATE_OPTIONS,
  },
  {
    key:         "nightShift",
    label:       "Night Shift",
    emoji:       "🌙",
    description: "Hours worked between 22:00 and 06:00",
    defaultRate: 125,
    options:     PREMIUM_RATE_OPTIONS,
  },
  {
    key:         "weekendShift",
    label:       "Weekend Shift",
    emoji:       "📆",
    description: "Hours worked on Saturday or Sunday",
    defaultRate: 125,
    options:     PREMIUM_RATE_OPTIONS,
  },
  {
    key:         "publicHolidayWorked",
    label:       "Public Holiday Worked",
    emoji:       "🎊",
    description: "Employee worked on a public holiday",
    defaultRate: 200,
    options:     PREMIUM_RATE_OPTIONS,
  },
];

// ── Default Rates ─────────────────────────────
export const DEFAULT_LEAVE_RATES = Object.freeze({
  sick:          50,
  vacation:      100,
  training:      100,
  publicHoliday: 200,
  dayOffDO:      100,
  dayOffDC:      0,
} as const);

export const DEFAULT_PENALTY_RATES = Object.freeze({
  absent:         0,
  lateArrival:    0,
  earlyDeparture: 0,
} as const);

export const DEFAULT_PREMIUM_RATES = Object.freeze({
  overtime:             150,
  nightShift:           125,
  weekendShift:         125,
  publicHolidayWorked:  200,
} as const);

// ── O(1) Frozen Maps ──────────────────────────
export const LEAVE_CONFIG_MAP = Object.freeze(
  Object.fromEntries(
    LEAVE_TYPE_CONFIGS.map((c) => [c.key, c])
  )
) as Record<LeaveType, LeaveTypeConfig>;

export const PENALTY_CONFIG_MAP = Object.freeze(
  Object.fromEntries(
    ATTENDANCE_PENALTY_CONFIGS.map((c) => [c.key, c])
  )
) as Record<AttendanceType, AttendancePenaltyConfig>;

export const PREMIUM_CONFIG_MAP = Object.freeze(
  Object.fromEntries(
    PREMIUM_RATE_CONFIGS.map((c) => [c.key, c])
  )
) as Record<PremiumType, PremiumRateConfig>;

// ── Helpers ───────────────────────────────────

// ✅ O(1) — throw if not found
export function getLeaveConfig(key: LeaveType): LeaveTypeConfig {
  const config = LEAVE_CONFIG_MAP[key];
  if (!config) throw new Error(`Unknown leave type: ${key}`);
  return config;
}

export function getPenaltyConfig(key: AttendanceType): AttendancePenaltyConfig {
  const config = PENALTY_CONFIG_MAP[key];
  if (!config) throw new Error(`Unknown attendance type: ${key}`);
  return config;
}

export function getPremiumConfig(key: PremiumType): PremiumRateConfig {
  const config = PREMIUM_CONFIG_MAP[key];
  if (!config) throw new Error(`Unknown premium type: ${key}`);
  return config;
}

// ✅ No hardcoded rules — rate from config
export function calculateLeavePay(
  dailyRate: number,
  days:      number,
  rate:      number
): number {
  return dailyRate * days * (rate / 100);
}

// ✅ Absent = base cut + penalty
export function calculateAbsentDeduction(
  dailyRate:   number,
  days:        number,
  penaltyRate: number
): number {
  const baseCut = dailyRate * days;
  const penalty = dailyRate * days * (penaltyRate / 100);
  return baseCut + penalty;
}

// ✅ Premium pay
export function calculatePremiumPay(
  hourlyRate: number,
  hours:      number,
  rate:       number
): number {
  return hourlyRate * hours * (rate / 100);
}

// ✅ Payslip summary
export function getLeavePaySummary(
  dailyRate:  number,
  leaveType:  LeaveType,
  days:       number,
  rate:       number
): {
  days:        number;
  dailyRate:   number;
  ratePercent: number;
  totalPay:    number;
  label:       string;
} {
  const config   = getLeaveConfig(leaveType);
  const totalPay = calculateLeavePay(dailyRate, days, rate);
  return {
    days,
    dailyRate,
    ratePercent: rate,
    totalPay,
    label: `${config.emoji} ${config.label} (${days}d × ${rate}%)`,
  };
}

