// ============================================
// SERVORA ERP — Employee Types v4.2.2 — FROZEN
// ✅ Worldwide ready — no country hardcoding
// ✅ LeaveBalance — 5 types (unpaidLeave LeaveRequest ma)
// ✅ AdditionalPayEligible — generic subsidies
// ✅ taxRate? ssRate? — undefined = use settings
// ✅ taxId + nationalInsuranceId — worldwide
// ✅ AccessLevel — permissions layer
// ✅ assignedRestaurantIds — multi-location
// ✅ archived — soft delete
// ✅ Optional fields — string | null (Firestore safe)
// Used by: Schedule, Payroll, Attendance, Leave
// ============================================

import { Timestamp } from "firebase/firestore";

// ── Enums ─────────────────────────────────────
export type EmployeeRole =
  | "OWNER"
  | "MANAGER"
  | "SUPERVISOR"
  | "CHEF"
  | "WAITER"
  | "CASHIER"
  | "STORE_KEEPER"
  | "DELIVERY"
  | "STAFF";

export type AccessLevel =
  | "OWNER"
  | "MANAGER"
  | "SUPERVISOR"
  | "STAFF";

export type EmployeeStatus =
  | "ACTIVE"
  | "PROBATION"
  | "ON_LEAVE"
  | "INACTIVE"
  | "TERMINATED";

export type ContractType =
  | "FULL_TIME"
  | "PART_TIME"
  | "FIXED_TERM"
  | "OPEN_ENDED"
  | "TEMPORARY"
  | "INTERNSHIP"
  | "SEASONAL"
  | "TRAINEE";

export type PaymentMode =
  | "MONTHLY"
  | "HOURLY"
  | "DAILY";

export type MaritalStatus =
  | "SINGLE"
  | "MARRIED"
  | "DIVORCED"
  | "WIDOWED";

export type AllowanceType =
  | "MONTHLY"
  | "ONE_TIME"
  | "PERCENTAGE";

export type Gender =
  | "MALE"
  | "FEMALE"
  | "OTHER";

// ── Sub-interfaces ────────────────────────────
export interface EmployeeAllowance {
  id: string;
  name: string;
  amount: number;
  type: AllowanceType;
  taxable: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

// ✅ v4.2.2 — 5 leave types
// unpaidLeave → LeaveRequest history ma (not balance)
export interface LeaveBalance {
  annualLeave: number;
  sickLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  bereavementLeave: number;
}

export interface EmployeeDocuments {
  contractUrl?: string;
  passportUrl?: string;
  visaUrl?: string;
}

// ✅ Generic subsidy — not Portugal-centric
export interface AdditionalPayEligible {
  thirteenthMonth?: boolean;  // Brazil, Portugal, Spain
  holidayBonus?: boolean;     // Portugal, Germany
  christmasBonus?: boolean;   // Portugal, Italy
}

// ── Main EmployeeDB ───────────────────────────
export interface EmployeeDB {
  id: string;

  // ── Identity ──────────────────────────────
  employeeNumber: string;
  employeeCode?:  string | null;   // ✅ null safe
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoUrl?:  string | null;       // ✅ null safe
  birthDate?: string | null;       // ✅ null safe — ISO: "1990-05-15"
  gender?:    Gender | null;       // ✅ null safe

  // ── Employment ────────────────────────────
  role: EmployeeRole;
  accessLevel: AccessLevel;
  position: string;
  status: EmployeeStatus;
  contractType: ContractType;
  paymentMode: PaymentMode;
  hireDate: string;
  probationDays: number;
  terminationDate?: string | null; // ✅ null safe

  // ── Payroll Base ──────────────────────────
  monthlySalary: number;
  hourlyRate: number;
  dailyHours: number;
  weeklyHours: number;

  // ── Tax IDs (Worldwide) ───────────────────
  taxId?:               string | null; // ✅ null safe
  nationalInsuranceId?: string | null; // ✅ null safe

  // ── Tax Rates ─────────────────────────────
  // undefined = use settings.defaultTaxRate
  taxRate?: number | null;  // ✅ null safe
  ssRate?:  number | null;  // ✅ null safe

  maritalStatus: MaritalStatus;
  dependents: number;

  // ── Additional Pay Eligibility ────────────
  additionalPayEligible?: AdditionalPayEligible;

  // ── Banking ───────────────────────────────
  iban?:     string | null; // ✅ null safe
  bankName?: string | null; // ✅ null safe

  // ── Address ───────────────────────────────
  address: string;
  postalCode: string;
  city: string;
  country: string;

  // ── Allowances ────────────────────────────
  allowances: EmployeeAllowance[];

  // ── Leave Balance ─────────────────────────
  leaveBalance: LeaveBalance;

  // ── Documents ─────────────────────────────
  documents?: EmployeeDocuments;

  // ── Emergency ─────────────────────────────
  emergencyContact: EmergencyContact;

  // ── Notes ─────────────────────────────────
  notes: string;

  // ── Multi-location ────────────────────────
  assignedRestaurantIds?: string[];

  // ── Soft Delete ───────────────────────────
  archived: boolean;

  // ── Metadata ──────────────────────────────
  restaurantId: string;
  restaurantName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ── Salary Snapshot ───────────────────────────
export interface EmployeeSalarySnapshot {
  employeeNumber: string;
  fullName: string;
  role: EmployeeRole;
  accessLevel: AccessLevel;
  position: string;
  contractType: ContractType;
  paymentMode: PaymentMode;
  monthlySalary: number;
  hourlyRate: number;
  dailyHours: number;
  weeklyHours: number;
  taxRate?:  number | null;
  ssRate?:   number | null;
  maritalStatus: MaritalStatus;
  dependents: number;
  additionalPayEligible?: AdditionalPayEligible;
  allowances: EmployeeAllowance[];
  restaurantId: string;
  restaurantName: string;
}