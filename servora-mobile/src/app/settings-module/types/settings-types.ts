// ============================================
// SERVORA ERP — Settings Types
// ✅ workDaysPerWeek added
// ✅ PaymentType imported
// ✅ 10/10 production ready
// ============================================

import { PaymentType, ContractType } from "../constants/payment-types";
import { AppRole, Permission }        from "../constants/permissions";

export interface GeneralSettings {
  name:         string;
  address:      string;
  phone:        string;
  email:        string;
  vatNumber:    string;
  country:      string;
  timezone:     string;
  language:     string;
  dateFormat:   "DD/MM/YYYY" | "MM/DD/YYYY";
  weekStartDay: 0 | 1;
}

export interface FinanceSettings {
  currency:       string;
  currencySymbol: string;
  taxRate:        number;
  ssRate:         number;
}

export interface BreakPolicy {
  autoDeduct: boolean;
  duration:   number;
  afterHours: number;
}

export interface AttendanceSettings {
  normalDailyHours:  number;
  normalWeeklyHours: number;
  payrollMonthDays:  number;
  workDaysPerWeek:   number;  // ✅ added
  breakPolicy:       BreakPolicy;
}

export interface PayrollSettings {
  paymentType:       PaymentType;
  overtimeRate:      number;
  absentPenaltyRate: number;
}

export interface LeaveRates {
  sick:          number;
  vacation:      number;
  training:      number;
  publicHoliday: number;
  dayOffDO:      number;
  dayOffDC:      0;
}

export interface EmployeeDefaults {
  defaultHourlyRate:   number;
  defaultMonthlyRate:  number;
  defaultContractType: ContractType;
  defaultPaymentMode:  PaymentType;
  defaultTaxRate:      number;
  defaultSSRate:       number;
  defaultDailyHours:   number;
  defaultWeeklyHours:  number;
  probationDays:       number;
}

export type RolePermissions = Record<AppRole, Permission[]>;

export interface SecuritySettings {
  rolePermissions: RolePermissions;
}

export interface RestaurantSettings {
  general:          GeneralSettings;
  finance:          FinanceSettings;
  attendance:       AttendanceSettings;
  payroll:          PayrollSettings;
  leaveRates:       LeaveRates;
  employeeDefaults: EmployeeDefaults;
  security:         SecuritySettings;
}

export const DEFAULT_SETTINGS: RestaurantSettings = {
  general: {
    name:         "",
    address:      "",
    phone:        "",
    email:        "",
    vatNumber:    "",
    country:      "PT",
    timezone:     "Europe/Lisbon",
    language:     "en",
    dateFormat:   "DD/MM/YYYY",
    weekStartDay: 1,
  },
  finance: {
    currency:       "EUR",
    currencySymbol: "€",
    taxRate:        11,
    ssRate:         11,
  },
  attendance: {
    normalDailyHours:  8,
    normalWeeklyHours: 40,
    payrollMonthDays:  30,
    workDaysPerWeek:   5,   // ✅ default
    breakPolicy: {
      autoDeduct: true,
      duration:   30,
      afterHours: 6,
    },
  },
  payroll: {
    paymentType:       "MONTHLY",
    overtimeRate:      150,
    absentPenaltyRate: 0,
  },
  leaveRates: {
    sick:          50,
    vacation:      100,
    training:      100,
    publicHoliday: 200,
    dayOffDO:      100,
    dayOffDC:      0,
  },
  employeeDefaults: {
    defaultHourlyRate:   0,
    defaultMonthlyRate:  0,
    defaultContractType: "FULL_TIME",
    defaultPaymentMode:  "MONTHLY",
    defaultTaxRate:      11,
    defaultSSRate:       11,
    defaultDailyHours:   8,
    defaultWeeklyHours:  40,
    probationDays:       90,
  },
  security: {
    rolePermissions: {
      OWNER: [
        "edit_schedule",  "edit_inventory",  "edit_store",
        "view_payroll",   "edit_payroll",    "view_reports",
        "edit_employees", "edit_settings",   "manage_permissions",
        "view_sales",     "edit_sales",      "view_kitchen",
        "edit_kitchen",
      ],
      MANAGER: [
        "edit_schedule",  "edit_inventory",  "edit_store",
        "view_payroll",   "view_reports",    "edit_employees",
        "edit_settings",  "view_sales",      "edit_sales",
        "view_kitchen",
      ],
      CHEF: [
        "edit_inventory", "view_kitchen",
        "edit_kitchen",   "view_sales",
      ],
      STORE: [
        "edit_store",     "edit_inventory",
      ],
      SALESMAN: [
        "view_sales",     "edit_sales",
      ],
    },
  },
};

