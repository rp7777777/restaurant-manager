// ============================================
// SERVORA ERP — Settings Mappers
// ✅ workDaysPerWeek added
// ✅ FirestoreSettingsDoc complete
// ✅ 10/10 production ready
// ============================================
import { RolePermissions } from "../types/settings-types";
import { DEFAULT_SETTINGS, RestaurantSettings } from "../types/settings-types";
import { getCountryDefaults }                   from "../constants/countries";
import { PaymentType, ContractType }            from "../constants/payment-types";

export interface FirestoreSettingsDoc {
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
  financeCurrency:           string;
  financeCurrencySymbol:     string;
  financeTaxRate:            number;
  financeSSRate:             number;
  normalDailyHours:          number;
  normalWeeklyHours:         number;
  payrollMonthDays:          number;
  workDaysPerWeek:           number;  // ✅ added
  autoDeductBreak:           boolean;
  defaultBreakMinutes:       number;
  autoDeductBreakAfterHours: number;
  paymentType:               PaymentType;
  overtimeRate:              number;
  absentPenaltyRate:         number;
  sickLeavePayRate:          number;
  vacationPayRate:           number;
  trainingPayRate:           number;
  publicHolidayPayRate:      number;
  dayOffDoPayRate:           number;
  dayOffDcPayRate:           0;
  defaultHourlyRate:         number;
  defaultMonthlyRate:        number;
  defaultContractType:       ContractType;
  defaultPaymentMode:        PaymentType;
  employeeDefaultTaxRate:    number;
  employeeDefaultSSRate:     number;
  defaultDailyHours:         number;
  defaultWeeklyHours:        number;
  probationDays:             number;
  rolePermissions:           Record<string, string[]>;
}

export function mapFirestoreToSettings(
  data: Partial<FirestoreSettingsDoc>
): RestaurantSettings {
  return {
    general: {
      name:         data.name         ?? DEFAULT_SETTINGS.general.name,
      address:      data.address      ?? DEFAULT_SETTINGS.general.address,
      phone:        data.phone        ?? DEFAULT_SETTINGS.general.phone,
      email:        data.email        ?? DEFAULT_SETTINGS.general.email,
      vatNumber:    data.vatNumber    ?? DEFAULT_SETTINGS.general.vatNumber,
      country:      data.country      ?? DEFAULT_SETTINGS.general.country,
      timezone:     data.timezone     ?? DEFAULT_SETTINGS.general.timezone,
      language:     data.language     ?? DEFAULT_SETTINGS.general.language,
      dateFormat:   data.dateFormat   ?? DEFAULT_SETTINGS.general.dateFormat,
      weekStartDay: data.weekStartDay ?? DEFAULT_SETTINGS.general.weekStartDay,
    },
    finance: {
      currency:       data.financeCurrency       ?? DEFAULT_SETTINGS.finance.currency,
      currencySymbol: data.financeCurrencySymbol ?? DEFAULT_SETTINGS.finance.currencySymbol,
      taxRate:        data.financeTaxRate        ?? DEFAULT_SETTINGS.finance.taxRate,
      ssRate:         data.financeSSRate         ?? DEFAULT_SETTINGS.finance.ssRate,
    },
    attendance: {
      normalDailyHours:  data.normalDailyHours  ?? DEFAULT_SETTINGS.attendance.normalDailyHours,
      normalWeeklyHours: data.normalWeeklyHours ?? DEFAULT_SETTINGS.attendance.normalWeeklyHours,
      payrollMonthDays:  data.payrollMonthDays  ?? DEFAULT_SETTINGS.attendance.payrollMonthDays,
      workDaysPerWeek:   data.workDaysPerWeek   ?? DEFAULT_SETTINGS.attendance.workDaysPerWeek, // ✅
      breakPolicy: {
        autoDeduct: data.autoDeductBreak            ?? DEFAULT_SETTINGS.attendance.breakPolicy.autoDeduct,
        duration:   data.defaultBreakMinutes        ?? DEFAULT_SETTINGS.attendance.breakPolicy.duration,
        afterHours: data.autoDeductBreakAfterHours  ?? DEFAULT_SETTINGS.attendance.breakPolicy.afterHours,
      },
    },
    payroll: {
      paymentType:       data.paymentType       ?? DEFAULT_SETTINGS.payroll.paymentType,
      overtimeRate:      data.overtimeRate      ?? DEFAULT_SETTINGS.payroll.overtimeRate,
      absentPenaltyRate: data.absentPenaltyRate ?? DEFAULT_SETTINGS.payroll.absentPenaltyRate,
    },
    leaveRates: {
      sick:          data.sickLeavePayRate     ?? DEFAULT_SETTINGS.leaveRates.sick,
      vacation:      data.vacationPayRate      ?? DEFAULT_SETTINGS.leaveRates.vacation,
      training:      data.trainingPayRate      ?? DEFAULT_SETTINGS.leaveRates.training,
      publicHoliday: data.publicHolidayPayRate ?? DEFAULT_SETTINGS.leaveRates.publicHoliday,
      dayOffDO:      data.dayOffDoPayRate      ?? DEFAULT_SETTINGS.leaveRates.dayOffDO,
      dayOffDC:      0,
    },
    employeeDefaults: {
      defaultHourlyRate:   data.defaultHourlyRate      ?? DEFAULT_SETTINGS.employeeDefaults.defaultHourlyRate,
      defaultMonthlyRate:  data.defaultMonthlyRate     ?? DEFAULT_SETTINGS.employeeDefaults.defaultMonthlyRate,
      defaultContractType: data.defaultContractType    ?? DEFAULT_SETTINGS.employeeDefaults.defaultContractType,
      defaultPaymentMode:  data.defaultPaymentMode     ?? DEFAULT_SETTINGS.employeeDefaults.defaultPaymentMode,
      defaultTaxRate:      data.employeeDefaultTaxRate ?? DEFAULT_SETTINGS.employeeDefaults.defaultTaxRate,
      defaultSSRate:       data.employeeDefaultSSRate  ?? DEFAULT_SETTINGS.employeeDefaults.defaultSSRate,
      defaultDailyHours:   data.defaultDailyHours      ?? DEFAULT_SETTINGS.employeeDefaults.defaultDailyHours,
      defaultWeeklyHours:  data.defaultWeeklyHours     ?? DEFAULT_SETTINGS.employeeDefaults.defaultWeeklyHours,
      probationDays:       data.probationDays          ?? DEFAULT_SETTINGS.employeeDefaults.probationDays,
    },
    security: {
      rolePermissions: (data.rolePermissions ?? DEFAULT_SETTINGS.security.rolePermissions) as RolePermissions,
    },
  };
}

export function mapSettingsToFirestore(
  s: RestaurantSettings
): FirestoreSettingsDoc {
  return {
    name:         s.general.name,
    address:      s.general.address,
    phone:        s.general.phone,
    email:        s.general.email,
    vatNumber:    s.general.vatNumber,
    country:      s.general.country,
    timezone:     s.general.timezone,
    language:     s.general.language,
    dateFormat:   s.general.dateFormat,
    weekStartDay: s.general.weekStartDay,
    financeCurrency:           s.finance.currency,
    financeCurrencySymbol:     s.finance.currencySymbol,
    financeTaxRate:            s.finance.taxRate,
    financeSSRate:             s.finance.ssRate,
    normalDailyHours:          s.attendance.normalDailyHours,
    normalWeeklyHours:         s.attendance.normalWeeklyHours,
    payrollMonthDays:          s.attendance.payrollMonthDays,
    workDaysPerWeek:           s.attendance.workDaysPerWeek,  // ✅
    autoDeductBreak:           s.attendance.breakPolicy.autoDeduct,
    defaultBreakMinutes:       s.attendance.breakPolicy.duration,
    autoDeductBreakAfterHours: s.attendance.breakPolicy.afterHours,
    paymentType:               s.payroll.paymentType,
    overtimeRate:              s.payroll.overtimeRate,
    absentPenaltyRate:         s.payroll.absentPenaltyRate,
    sickLeavePayRate:          s.leaveRates.sick,
    vacationPayRate:           s.leaveRates.vacation,
    trainingPayRate:           s.leaveRates.training,
    publicHolidayPayRate:      s.leaveRates.publicHoliday,
    dayOffDoPayRate:           s.leaveRates.dayOffDO,
    dayOffDcPayRate:           0,
    defaultHourlyRate:         s.employeeDefaults.defaultHourlyRate,
    defaultMonthlyRate:        s.employeeDefaults.defaultMonthlyRate,
    defaultContractType:       s.employeeDefaults.defaultContractType,
    defaultPaymentMode:        s.employeeDefaults.defaultPaymentMode,
    employeeDefaultTaxRate:    s.employeeDefaults.defaultTaxRate,
    employeeDefaultSSRate:     s.employeeDefaults.defaultSSRate,
    defaultDailyHours:         s.employeeDefaults.defaultDailyHours,
    defaultWeeklyHours:        s.employeeDefaults.defaultWeeklyHours,
    probationDays:             s.employeeDefaults.probationDays,
    rolePermissions:           s.security.rolePermissions,
  };
}

export function applyCountryDefaults(
  settings:    RestaurantSettings,
  countryCode: string
): RestaurantSettings {
  const defaults = getCountryDefaults(countryCode);
  return {
    ...settings,
    general: {
      ...settings.general,
      country:    countryCode,
      timezone:   defaults.timezone,
      language:   defaults.language,
      dateFormat: defaults.dateFormat,
    },
    finance: {
      ...settings.finance,
      currency:       defaults.currency,
      currencySymbol: defaults.currencySymbol,
    },
  };
}

export function mergeSettings(
  current: RestaurantSettings,
  partial: Partial<RestaurantSettings>
): RestaurantSettings {
  return {
    general:          { ...current.general,          ...partial.general },
    finance:          { ...current.finance,          ...partial.finance },
    attendance: {
      ...current.attendance,
      ...partial.attendance,
      breakPolicy: {
        ...current.attendance.breakPolicy,
        ...partial.attendance?.breakPolicy,
      },
    },
    payroll:          { ...current.payroll,          ...partial.payroll },
    leaveRates:       { ...current.leaveRates,       ...partial.leaveRates },
    employeeDefaults: { ...current.employeeDefaults, ...partial.employeeDefaults },
    security:         { ...current.security,         ...partial.security },
  };
}

export interface ValidationResult {
  valid:  boolean;
  errors: string[];
}

export function validateSettings(s: RestaurantSettings): ValidationResult {
  const errors: string[] = [];
  if (!s.general.name.trim())
    errors.push("Restaurant name is required");
  if (s.general.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.general.email))
    errors.push("Invalid email address");
  if (s.general.phone && !/^\+?[\d\s\-()]{6,}$/.test(s.general.phone))
    errors.push("Invalid phone number");
  if (!s.general.country)
    errors.push("Country is required");
  if (!s.general.timezone)
    errors.push("Timezone is required");
  if (!s.finance.currency)
    errors.push("Currency is required");
  if (s.finance.taxRate < 0 || s.finance.taxRate > 100)
    errors.push("Tax rate must be 0–100%");
  if (s.finance.ssRate < 0 || s.finance.ssRate > 100)
    errors.push("SS rate must be 0–100%");
  if (s.attendance.normalDailyHours < 1 || s.attendance.normalDailyHours > 24)
    errors.push("Daily hours must be 1–24");
  if (s.attendance.normalWeeklyHours < 1 || s.attendance.normalWeeklyHours > 168)
    errors.push("Weekly hours must be 1–168");
  if (s.attendance.payrollMonthDays < 20 || s.attendance.payrollMonthDays > 31)
    errors.push("Payroll month days must be 20–31");
  if (!s.payroll.paymentType)
    errors.push("Payment type is required");
  if (s.payroll.overtimeRate < 100)
    errors.push("Overtime rate must be at least 100%");
  return { valid: errors.length === 0, errors };
}

