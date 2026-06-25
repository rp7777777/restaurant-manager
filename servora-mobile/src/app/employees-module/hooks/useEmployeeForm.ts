// ============================================
// SERVORA ERP — useEmployeeForm Hook
// ✅ createEmployeePayload + updateEmployeePayload separate
// ✅ leaveBalance — create only, edit preserves existing
// ✅ restaurantName — NOT in update payload
// ✅ validate first — no unnecessary saving state flip
// ✅ payload built once in handleSubmit
// ✅ undefined → null (Firestore safe)
// ✅ No Firestore direct calls — service layer
// FROZEN
// ============================================

import { useState, useCallback, useMemo } from "react";
import {
  EmployeeDB,
  EmployeeRole,
  EmployeeStatus,
  ContractType,
  PaymentMode,
  MaritalStatus,
  Gender,
  EmployeeAllowance,
} from "../types/employee-types";
import {
  validateEmployee,
  validateEmployeeUpdate,
  ValidationResult,
} from "../utils/employee-validation";
import {
  DEFAULT_ALLOWANCES,
  DEFAULT_LEAVE_BALANCE,
  DEFAULT_PROBATION_DAYS,
  DEFAULT_DAILY_HOURS,
  DEFAULT_WEEKLY_HOURS,
} from "../constants/employee-defaults";
import { ROLE_ACCESS_MAP } from "../constants/employee-roles";
import {
  createEmployee,
  updateEmployee,
  ServiceResult,
} from "../services/employee-service";

// ── Form State ────────────────────────────────
export interface EmployeeFormState {
  employeeNumber:        string;
  employeeCode:          string;
  firstName:             string;
  lastName:              string;
  email:                 string;
  phone:                 string;
  birthDate:             string;
  gender:                Gender | "";

  role:                  EmployeeRole;
  position:              string;
  status:                EmployeeStatus;
  contractType:          ContractType;
  paymentMode:           PaymentMode;
  hireDate:              string;
  probationDays:         string;
  terminationDate:       string;

  monthlySalary:         string;
  hourlyRate:            string;
  dailyHours:            string;
  weeklyHours:           string;

  taxId:                 string;
  nationalInsuranceId:   string;
  maritalStatus:         MaritalStatus;
  dependents:            string;
  taxRate:               string;
  ssRate:                string;

  iban:                  string;
  bankName:              string;

  address:               string;
  postalCode:            string;
  city:                  string;
  country:               string;

  allowances:            EmployeeAllowance[];

  emergencyName:         string;
  emergencyPhone:        string;
  emergencyRelationship: string;

  notes:                 string;
}

// ── Empty form ────────────────────────────────
export function createEmptyForm(
  overrides?: Partial<EmployeeFormState>
): EmployeeFormState {
  return {
    employeeNumber:        "",
    employeeCode:          "",
    firstName:             "",
    lastName:              "",
    email:                 "",
    phone:                 "",
    birthDate:             "",
    gender:                "",

    role:                  "STAFF",
    position:              "",
    status:                "ACTIVE",
    contractType:          "FULL_TIME",
    paymentMode:           "MONTHLY",
    hireDate:              "",
    probationDays:         String(DEFAULT_PROBATION_DAYS),
    terminationDate:       "",

    monthlySalary:         "",
    hourlyRate:            "",
    dailyHours:            String(DEFAULT_DAILY_HOURS),
    weeklyHours:           String(DEFAULT_WEEKLY_HOURS),

    taxId:                 "",
    nationalInsuranceId:   "",
    maritalStatus:         "SINGLE",
    dependents:            "0",
    taxRate:               "",
    ssRate:                "",

    iban:                  "",
    bankName:              "",

    address:               "",
    postalCode:            "",
    city:                  "",
    country:               "",

    allowances:            DEFAULT_ALLOWANCES.map((a) => ({ ...a })),

    emergencyName:         "",
    emergencyPhone:        "",
    emergencyRelationship: "",

    notes:                 "",
    ...overrides,
  };
}

// ── Form from EmployeeDB ──────────────────────
export function formFromEmployee(emp: EmployeeDB): EmployeeFormState {
  return {
    employeeNumber:        emp.employeeNumber,
    employeeCode:          emp.employeeCode          ?? "",
    firstName:             emp.firstName,
    lastName:              emp.lastName,
    email:                 emp.email,
    phone:                 emp.phone,
    birthDate:             emp.birthDate             ?? "",
    gender:                emp.gender               ?? "",

    role:                  emp.role,
    position:              emp.position,
    status:                emp.status,
    contractType:          emp.contractType,
    paymentMode:           emp.paymentMode,
    hireDate:              emp.hireDate,
    probationDays:         String(emp.probationDays),
    terminationDate:       emp.terminationDate       ?? "",

    monthlySalary:         String(emp.monthlySalary),
    hourlyRate:            String(emp.hourlyRate),
    dailyHours:            String(emp.dailyHours),
    weeklyHours:           String(emp.weeklyHours),

    taxId:                 emp.taxId                ?? "",
    nationalInsuranceId:   emp.nationalInsuranceId  ?? "",
    maritalStatus:         emp.maritalStatus,
    dependents:            String(emp.dependents),
    taxRate:               emp.taxRate !== undefined ? String(emp.taxRate) : "",
    ssRate:                emp.ssRate  !== undefined ? String(emp.ssRate)  : "",

    iban:                  emp.iban                 ?? "",
    bankName:              emp.bankName             ?? "",

    address:               emp.address,
    postalCode:            emp.postalCode,
    city:                  emp.city,
    country:               emp.country,

    allowances: emp.allowances.length
      ? emp.allowances.map((a) => ({ ...a }))
      : DEFAULT_ALLOWANCES.map((a) => ({ ...a })),

    emergencyName:         emp.emergencyContact.name,
    emergencyPhone:        emp.emergencyContact.phone,
    emergencyRelationship: emp.emergencyContact.relationship,

    notes:                 emp.notes,
  };
}

// ── Helpers ───────────────────────────────────
// ✅ empty string → null (Firestore safe, no undefined)
function nullIfEmpty(value: string): string | null {
  return value.trim() || null;
}

// ── Create payload ────────────────────────────
function createEmployeePayload(
  form: EmployeeFormState,
  restaurantId: string,
  restaurantName: string,
): Omit<EmployeeDB, "id" | "createdAt" | "updatedAt"> {
  const role = form.role;
  return {
    employeeNumber:        form.employeeNumber.trim(),
    employeeCode:          nullIfEmpty(form.employeeCode),
    firstName:             form.firstName.trim(),
    lastName:              form.lastName.trim(),
    email:                 form.email.trim(),
    phone:                 form.phone.trim(),
    birthDate:             nullIfEmpty(form.birthDate),
    gender:                (form.gender as Gender)   || null,

    role,
    accessLevel:           ROLE_ACCESS_MAP[role],
    position:              form.position.trim(),
    status:                form.status,
    contractType:          form.contractType,
    paymentMode:           form.paymentMode,
    hireDate:              form.hireDate.trim(),
    probationDays:         Number(form.probationDays)     || DEFAULT_PROBATION_DAYS,
    terminationDate:       nullIfEmpty(form.terminationDate),

    monthlySalary:         Number(form.monthlySalary)     || 0,
    hourlyRate:            Number(form.hourlyRate)        || 0,
    dailyHours:            Number(form.dailyHours)        || DEFAULT_DAILY_HOURS,
    weeklyHours:           Number(form.weeklyHours)       || DEFAULT_WEEKLY_HOURS,

    taxId:                 nullIfEmpty(form.taxId),
    nationalInsuranceId:   nullIfEmpty(form.nationalInsuranceId),
    maritalStatus:         form.maritalStatus,
    dependents:            Number(form.dependents)        || 0,
    taxRate:               form.taxRate ? Number(form.taxRate) : null,
    ssRate:                form.ssRate  ? Number(form.ssRate)  : null,

    iban:                  nullIfEmpty(form.iban),
    bankName:              nullIfEmpty(form.bankName),

    address:               form.address.trim(),
    postalCode:            form.postalCode.trim(),
    city:                  form.city.trim(),
    country:               form.country.trim(),

    allowances:            form.allowances.filter((a) => a.name.trim()),
    leaveBalance:          DEFAULT_LEAVE_BALANCE,

    emergencyContact: {
      name:         form.emergencyName.trim(),
      phone:        form.emergencyPhone.trim(),
      relationship: form.emergencyRelationship.trim(),
    },

    notes:                 form.notes.trim(),
    assignedRestaurantIds: [restaurantId],
    archived:              false,
    restaurantId,
    restaurantName,
  };
}

// ── Update payload ────────────────────────────
function updateEmployeePayload(
  form: EmployeeFormState,
): Partial<Omit<EmployeeDB, "id" | "createdAt" | "restaurantId">> {
  const role = form.role;
  return {
    employeeNumber:        form.employeeNumber.trim(),
    employeeCode:          nullIfEmpty(form.employeeCode),
    firstName:             form.firstName.trim(),
    lastName:              form.lastName.trim(),
    email:                 form.email.trim(),
    phone:                 form.phone.trim(),
    birthDate:             nullIfEmpty(form.birthDate),
    gender:                (form.gender as Gender)   || null,

    role,
    accessLevel:           ROLE_ACCESS_MAP[role],
    position:              form.position.trim(),
    status:                form.status,
    contractType:          form.contractType,
    paymentMode:           form.paymentMode,
    hireDate:              form.hireDate.trim(),
    probationDays:         Number(form.probationDays)     || DEFAULT_PROBATION_DAYS,
    terminationDate:       nullIfEmpty(form.terminationDate),

    monthlySalary:         Number(form.monthlySalary)     || 0,
    hourlyRate:            Number(form.hourlyRate)        || 0,
    dailyHours:            Number(form.dailyHours)        || DEFAULT_DAILY_HOURS,
    weeklyHours:           Number(form.weeklyHours)       || DEFAULT_WEEKLY_HOURS,

    taxId:                 nullIfEmpty(form.taxId),
    nationalInsuranceId:   nullIfEmpty(form.nationalInsuranceId),
    maritalStatus:         form.maritalStatus,
    dependents:            Number(form.dependents)        || 0,
    taxRate:               form.taxRate ? Number(form.taxRate) : null,
    ssRate:                form.ssRate  ? Number(form.ssRate)  : null,

    iban:                  nullIfEmpty(form.iban),
    bankName:              nullIfEmpty(form.bankName),

    address:               form.address.trim(),
    postalCode:            form.postalCode.trim(),
    city:                  form.city.trim(),
    country:               form.country.trim(),

    allowances:            form.allowances.filter((a) => a.name.trim()),

    emergencyContact: {
      name:         form.emergencyName.trim(),
      phone:        form.emergencyPhone.trim(),
      relationship: form.emergencyRelationship.trim(),
    },

    notes: form.notes.trim(),
  };
}

// ── Hook ──────────────────────────────────────
export interface UseEmployeeFormOptions {
  restaurantId:      string;
  restaurantName:    string;
  existingEmployees: Pick<EmployeeDB, "id" | "employeeNumber">[];
  onSuccess?:        (id: string) => void;
  onError?:          (error: string) => void;
}

export function useEmployeeForm(options: UseEmployeeFormOptions) {
  const {
    restaurantId,
    restaurantName,
    existingEmployees,
    onSuccess,
    onError,
  } = options;

  const [form,      setForm]      = useState<EmployeeFormState>(createEmptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  // ── Field setter ──────────────────────────
  const setField = useCallback(
    <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  // ── Reset ─────────────────────────────────
  const resetForm = useCallback(() => {
    setForm(createEmptyForm());
    setEditingId(null);
    setErrors({});
    setSaving(false);
  }, []);

  // ── Load employee for edit ─────────────────
  const loadEmployee = useCallback((emp: EmployeeDB) => {
    setForm(formFromEmployee(emp));
    setEditingId(emp.id);
    setErrors({});
  }, []);

  // ── Submit ────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (editingId) {
      const payload = updateEmployeePayload(form);
      const validation: ValidationResult = validateEmployeeUpdate(payload);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }
      setSaving(true);
      try {
        const result: ServiceResult = await updateEmployee({
          employeeId:        editingId,
          restaurantId,
          data:              payload,
          existingEmployees,
        });
        if (result.success && result.id) {
          onSuccess?.(result.id);
          resetForm();
        } else if (result.validationErrors) {
          setErrors(result.validationErrors);
        } else {
          onError?.(result.error ?? "Failed to update employee");
        }
      } finally {
        setSaving(false);
      }
    } else {
      const payload = createEmployeePayload(form, restaurantId, restaurantName);
      const validation: ValidationResult = validateEmployee(payload);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }
      setSaving(true);
      try {
        const result: ServiceResult = await createEmployee({
          data:              payload,
          existingEmployees,
        });
        if (result.success && result.id) {
          onSuccess?.(result.id);
          resetForm();
        } else if (result.validationErrors) {
          setErrors(result.validationErrors);
        } else {
          onError?.(result.error ?? "Failed to create employee");
        }
      } finally {
        setSaving(false);
      }
    }
  }, [form, editingId, restaurantId, restaurantName, existingEmployees, resetForm, onSuccess, onError]);

  // ── Computed ──────────────────────────────
  const isEditing = editingId !== null;

  const previewGross = useMemo(() => {
    const base       = Number(form.monthlySalary) || 0;
    const allowTotal = form.allowances.reduce((s, a) => s + (a.amount || 0), 0);
    return base + allowTotal;
  }, [form.monthlySalary, form.allowances]);

  return {
    form,
    setField,
    errors,
    saving,
    isEditing,
    editingId,
    previewGross,
    resetForm,
    loadEmployee,
    handleSubmit,
  };
}