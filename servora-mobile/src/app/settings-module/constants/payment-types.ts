// ============================================
// SERVORA ERP — Payment Types
// ✅ PaymentType + ContractType
// ✅ PAYMENT_TYPE_CONFIGS with emoji
// ✅ CONTRACT_TYPE_CONFIGS with emoji
// ✅ 10/10 production ready
// ============================================

// ── Types ─────────────────────────────────────
export type PaymentType =
  | "MONTHLY"
  | "WEEKLY"
  | "DAILY"
  | "HOURLY";

export type ContractType =
  | "FULL_TIME"
  | "PART_TIME"
  | "TEMPORARY"
  | "PROBATION";

// ── Interfaces ────────────────────────────────
export interface PaymentTypeConfig {
  key:         PaymentType;
  label:       string;
  emoji:       string;
  description: string;
}

export interface ContractTypeConfig {
  key:         ContractType;
  label:       string;
  emoji:       string;
  description: string;
}

// ── Payment Type Configs ──────────────────────
export const PAYMENT_TYPE_CONFIGS: PaymentTypeConfig[] = Object.freeze([
  {
    key:         "MONTHLY",
    label:       "Monthly",
    emoji:       "📅",
    description: "Fixed monthly salary — most common for full-time staff",
  },
  {
    key:         "WEEKLY",
    label:       "Weekly",
    emoji:       "📆",
    description: "Paid every week — common for part-time staff",
  },
  {
    key:         "DAILY",
    label:       "Daily",
    emoji:       "📋",
    description: "Paid per day worked — flexible workers",
  },
  {
    key:         "HOURLY",
    label:       "Hourly",
    emoji:       "⏱️",
    description: "Paid per hour worked — maximum flexibility",
  },
]) as PaymentTypeConfig[];

// ── Contract Type Configs ─────────────────────
export const CONTRACT_TYPE_CONFIGS: ContractTypeConfig[] = Object.freeze([
  {
    key:         "FULL_TIME",
    label:       "Full Time",
    emoji:       "💼",
    description: "Standard full-time contract with full benefits",
  },
  {
    key:         "PART_TIME",
    label:       "Part Time",
    emoji:       "🕐",
    description: "Reduced hours — pro-rata benefits",
  },
  {
    key:         "TEMPORARY",
    label:       "Temporary",
    emoji:       "📝",
    description: "Fixed-term contract with end date",
  },
  {
    key:         "PROBATION",
    label:       "Probation",
    emoji:       "🔍",
    description: "Trial period before permanent contract",
  },
]) as ContractTypeConfig[];

// ── Helpers ───────────────────────────────────
export function getPaymentTypeConfig(key: PaymentType): PaymentTypeConfig {
  const config = PAYMENT_TYPE_CONFIGS.find((c) => c.key === key);
  if (!config) throw new Error(`Unknown payment type: ${key}`);
  return config;
}

export function getContractTypeConfig(key: ContractType): ContractTypeConfig {
  const config = CONTRACT_TYPE_CONFIGS.find((c) => c.key === key);
  if (!config) throw new Error(`Unknown contract type: ${key}`);
  return config;
}

// ── Compensation ──────────────────────────────
export type Compensation =
  | { type: "MONTHLY"; monthlyRate: number }
  | { type: "WEEKLY";  weeklyRate:  number }
  | { type: "DAILY";   dailyRate:   number }
  | { type: "HOURLY";  hourlyRate:  number };

export function buildCompensation(
  type: PaymentType,
  amount: number
): Compensation {
  switch (type) {
    case "MONTHLY": return { type, monthlyRate: amount };
    case "WEEKLY":  return { type, weeklyRate:  amount };
    case "DAILY":   return { type, dailyRate:   amount };
    case "HOURLY":  return { type, hourlyRate:  amount };
  }
}

export function getCompensationAmount(comp: Compensation): number {
  switch (comp.type) {
    case "MONTHLY": return comp.monthlyRate;
    case "WEEKLY":  return comp.weeklyRate;
    case "DAILY":   return comp.dailyRate;
    case "HOURLY":  return comp.hourlyRate;
  }
}

