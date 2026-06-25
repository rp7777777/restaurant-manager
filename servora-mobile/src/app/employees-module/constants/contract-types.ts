// ============================================
// SERVORA ERP — Contract & Payment Types
// Portugal Labour Law compliant
// ============================================

import {
  ContractType,
  PaymentMode,
  MaritalStatus,
  Gender,
} from "../types/employee-types";

export const CONTRACT_TYPES: ContractType[] = [
  "FULL_TIME",
  "PART_TIME",
  "FIXED_TERM",
  "OPEN_ENDED",
  "TEMPORARY",
  "INTERNSHIP",
  "SEASONAL",
  "TRAINEE",
];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  FULL_TIME:  "Full Time",
  PART_TIME:  "Part Time",
  FIXED_TERM: "Fixed Term",      // Contrato a Termo Certo
  OPEN_ENDED: "Open Ended",      // Contrato Sem Termo
  TEMPORARY:  "Temporary",
  INTERNSHIP: "Internship",      // Estágio
  SEASONAL:   "Seasonal",
  TRAINEE:    "Trainee",
};

export const PAYMENT_MODES: PaymentMode[] = [
  "MONTHLY",
  "HOURLY",
  "DAILY",
];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  MONTHLY: "Monthly Salary",
  HOURLY:  "Hourly Rate",
  DAILY:   "Daily Rate",
};

export const MARITAL_STATUSES: MaritalStatus[] = [
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
];

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  SINGLE:   "Single",
  MARRIED:  "Married",
  DIVORCED: "Divorced",
  WIDOWED:  "Widowed",
};

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "MALE",   label: "Male"   },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER",  label: "Other"  },
];

export function isValidContractType(type: string): type is ContractType {
  return CONTRACT_TYPES.includes(type as ContractType);
}

export function isValidPaymentMode(mode: string): mode is PaymentMode {
  return PAYMENT_MODES.includes(mode as PaymentMode);
}