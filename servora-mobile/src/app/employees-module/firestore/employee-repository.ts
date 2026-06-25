// ============================================
// SERVORA ERP — Employee Repository v4.2 — FROZEN
// ✅ Worldwide ready — no country hardcoding
// ✅ nif → taxId, socialSecurityNumber → nationalInsuranceId
// ✅ taxRate/ssRate → undefined = use settings
// ✅ LeaveBalance — 5 types, neutral 0
// ✅ AdditionalPayEligible — generic subsidies
// ✅ Legacy migration — old records no crash
// ✅ collectionGroup — multi-restaurant
// ✅ chunkArray + FIRESTORE_IN_QUERY_LIMIT
// ✅ restaurantId_docId — globally unique key
// ✅ Repository = Data Only
// FROZEN
// ============================================

import {
  collection, collectionGroup, onSnapshot,
  query, orderBy, where,
} from "firebase/firestore";
import { db } from "../../../firebase";
import {
  EmployeeDB,
  EmployeeAllowance,
  EmergencyContact,
  LeaveBalance,
  EmployeeDocuments,
  AdditionalPayEligible,
  ContractType,
  PaymentMode,
  EmployeeRole,
  AccessLevel,
  EmployeeStatus,
  MaritalStatus,
  Gender,
} from "../types/employee-types";
import { ROLE_ACCESS_MAP } from "../constants/employee-roles";
import {
  DEFAULT_MONTHLY_HOURS,
  DEFAULT_DAILY_HOURS,
  DEFAULT_WEEKLY_HOURS,
} from "../constants/employee-defaults";
import { FIRESTORE_IN_QUERY_LIMIT } from "../constants/firestore-config";

// ── Collection ref ────────────────────────────
const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "employees");

// ── Safe ISO date ─────────────────────────────
function safeISODate(value: unknown, legacyValue?: unknown): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (
    value !== null &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate()
      .toISOString().split("T")[0];
  }
  if (typeof legacyValue === "string" && legacyValue.length > 0) return legacyValue;
  return "";
}

// ── Safe number ───────────────────────────────
function safeNumber(value: unknown, fallback: number = 0): number {
  const n = Number(value ?? fallback);
  return isNaN(n) ? fallback : n;
}

// ── Safe optional number ──────────────────────
// 0 or null/undefined → undefined (use settings)
function safeOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (isNaN(n) || n === 0) return undefined;
  return n;
}

// ── Allowance type validator ──────────────────
const VALID_ALLOWANCE_TYPES: EmployeeAllowance["type"][] = [
  "MONTHLY", "ONE_TIME", "PERCENTAGE",
];

function safeAllowanceType(value: unknown): EmployeeAllowance["type"] {
  return VALID_ALLOWANCE_TYPES.includes(value as EmployeeAllowance["type"])
    ? (value as EmployeeAllowance["type"])
    : "MONTHLY";
}

// ── Chunk array ───────────────────────────────
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Mapper ────────────────────────────────────
export function mapEmployeeDoc(
  id: string,
  data: Record<string, unknown>,
  restaurantId: string,
): EmployeeDB {

  // Legacy: fullName → firstName + lastName
  const legacyFullName  = (data.fullName as string | undefined) ?? "";
  const legacyFirstName = legacyFullName.split(" ")[0] ?? "";
  const legacyLastName  = legacyFullName.split(" ").slice(1).join(" ") ?? "";

  // Legacy: basicSalary → monthlySalary
  const monthlySalary = safeNumber(data.monthlySalary ?? data.basicSalary);

  // Computed hourly rate fallback
  const computedHourlyRate =
    DEFAULT_MONTHLY_HOURS > 0
      ? monthlySalary / DEFAULT_MONTHLY_HOURS
      : 0;

  // Allowances
  const rawAllowances =
    (data.allowances as Record<string, unknown>[] | undefined) ?? [];
  const allowances: EmployeeAllowance[] = rawAllowances.map((a, idx) => ({
    id:      (a.id      as string  | undefined) ?? `allowance_${idx}`,
    name:    (a.name    as string  | undefined) ?? "Allowance",
    amount:  safeNumber(a.amount),
    type:    safeAllowanceType(a.type),
    taxable: (a.taxable as boolean | undefined) ?? false,
  }));

  // Emergency contact
  const ec = (data.emergencyContact as Record<string, unknown> | undefined) ?? {};
  const emergencyContact: EmergencyContact = {
    name:         (ec.name         as string | undefined) ?? "",
    phone:        (ec.phone        as string | undefined) ?? "",
    relationship: (ec.relationship as string | undefined) ?? "",
  };

  // Leave balance — 5 types, neutral 0
  const lb = (data.leaveBalance as Record<string, unknown> | undefined) ?? {};
  const leaveBalance: LeaveBalance = {
    annualLeave:      safeNumber(lb.annualLeave,      0),
    sickLeave:        safeNumber(lb.sickLeave,        0),
    maternityLeave:   safeNumber(lb.maternityLeave,   0),
    paternityLeave:   safeNumber(lb.paternityLeave,   0),
    bereavementLeave: safeNumber(lb.bereavementLeave, 0),
  };

  // Documents
  const docsRaw = (data.documents as Record<string, unknown> | undefined);
  const documents: EmployeeDocuments | undefined = docsRaw ? {
    contractUrl: (docsRaw.contractUrl as string | undefined),
    passportUrl: (docsRaw.passportUrl as string | undefined),
    visaUrl:     (docsRaw.visaUrl     as string | undefined),
  } : undefined;

  // Additional pay — generic subsidies
  const ap = (data.additionalPayEligible as Record<string, unknown> | undefined);
  const additionalPayEligible: AdditionalPayEligible | undefined = ap ? {
    thirteenthMonth: (ap.thirteenthMonth as boolean | undefined),
    holidayBonus:    (ap.holidayBonus    as boolean | undefined),
    christmasBonus:  (ap.christmasBonus  as boolean | undefined),
  } : undefined;

  // Legacy: holidaySubsidyEligible → additionalPayEligible
  const legacyHolidaySubsidy   = (data.holidaySubsidyEligible   as boolean | undefined);
  const legacyChristmasSubsidy = (data.christmasSubsidyEligible as boolean | undefined);
  const mergedAdditionalPay: AdditionalPayEligible | undefined =
    additionalPayEligible ?? (
      legacyHolidaySubsidy !== undefined || legacyChristmasSubsidy !== undefined
        ? {
            holidayBonus:   legacyHolidaySubsidy,
            christmasBonus: legacyChristmasSubsidy,
          }
        : undefined
    );

  // Status — legacy active: boolean → new status string
  const status: EmployeeStatus =
    (data.status as EmployeeStatus | undefined) ??
    (data.active === false ? "INACTIVE" : "ACTIVE");

  // Role + AccessLevel
  const role: EmployeeRole =
    (data.role as EmployeeRole | undefined) ?? "STAFF";
  const accessLevel: AccessLevel =
    (data.accessLevel as AccessLevel | undefined) ??
    ROLE_ACCESS_MAP[role];

  // assignedRestaurantIds — no duplicates
  const mainId = (data.restaurantId as string | undefined) ?? restaurantId;
  const rawAssigned = (data.assignedRestaurantIds as string[] | undefined) ?? [];
  const assignedRestaurantIds = Array.from(
    new Set([mainId, ...rawAssigned])
  );

  return {
    id,

    // ── Identity ────────────────────────────
    employeeNumber: (data.employeeNumber as string | undefined) ?? (data.employeeNo as string | undefined) ?? "",
    employeeCode:   (data.employeeCode   as string | undefined),
    firstName:      (data.firstName      as string | undefined) ?? legacyFirstName,
    lastName:       (data.lastName       as string | undefined) ?? legacyLastName,
    email:          (data.email          as string | undefined) ?? "",
    phone:          (data.phone          as string | undefined) ?? "",
    photoUrl:       (data.photoUrl       as string | undefined),
    birthDate:      safeISODate(data.birthDate) || undefined,
    gender:         (data.gender         as Gender | undefined),

    // ── Employment ──────────────────────────
    role,
    accessLevel,
    position:        (data.position     as string       | undefined) ?? "",
    status,
    contractType:    (data.contractType as ContractType | undefined) ?? "FULL_TIME",
    paymentMode:     (data.paymentMode  as PaymentMode  | undefined) ?? "MONTHLY",
    hireDate:        safeISODate(data.hireDate, data.joinDate),
    probationDays:   safeNumber(data.probationDays, 90),
    terminationDate: safeISODate(data.terminationDate) || undefined,

    // ── Payroll Base ────────────────────────
    monthlySalary,
    hourlyRate:  safeNumber(data.hourlyRate, computedHourlyRate),
    dailyHours:  safeNumber(data.dailyHours,  DEFAULT_DAILY_HOURS),
    weeklyHours: safeNumber(
      data.weeklyHours ?? data.contractHoursPerWeek,
      DEFAULT_WEEKLY_HOURS
    ),

    // ── Tax IDs ─────────────────────────────
    taxId:               (data.taxId               as string | undefined) ?? (data.nif                  as string | undefined),
    nationalInsuranceId: (data.nationalInsuranceId as string | undefined) ?? (data.socialSecurityNumber as string | undefined),

    // ── Tax Rates ───────────────────────────
    // undefined = use settings.defaultTaxRate
    taxRate: safeOptionalNumber(data.taxRate),
    ssRate:  safeOptionalNumber(data.ssRate),

    maritalStatus: (data.maritalStatus as MaritalStatus | undefined) ?? "SINGLE",
    dependents:    safeNumber(data.dependents, 0),

    // ── Additional Pay ───────────────────────
    additionalPayEligible: mergedAdditionalPay,

    // ── Banking ─────────────────────────────
    iban:     (data.iban     as string | undefined) ?? (data.bankAccount as string | undefined),
    bankName: (data.bankName as string | undefined),

    // ── Address ─────────────────────────────
    address:    (data.address    as string | undefined) ?? "",
    postalCode: (data.postalCode as string | undefined) ?? "",
    city:       (data.city       as string | undefined) ?? "",
    country:    (data.country    as string | undefined) ?? "",

    // ── Allowances & Notes ──────────────────
    allowances,
    leaveBalance,
    documents,
    emergencyContact,
    notes: (data.notes as string | undefined) ?? "",

    // ── Multi-location ───────────────────────
    assignedRestaurantIds,

    // ── Soft delete ──────────────────────────
    archived: (data.archived as boolean | undefined) ?? false,

    // ── Metadata ────────────────────────────
    restaurantId:   mainId,
    restaurantName: (data.restaurantName as string | undefined) ?? "",
    createdAt:      data.createdAt as EmployeeDB["createdAt"],
    updatedAt:      data.updatedAt as EmployeeDB["updatedAt"],
  };
}

// ── Subscribe — ACTIVE + PROBATION + ON_LEAVE ─
// Used by: Schedule — ON_LEAVE grey ma dekhixa
export function subscribeToEmployees(
  restaurantId: string,
  onData: (employees: EmployeeDB[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(col(restaurantId), orderBy("employeeNumber", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) =>
        mapEmployeeDoc(d.id, d.data() as Record<string, unknown>, restaurantId)
      );
      onData(all.filter((e) =>
        (
          e.status === "ACTIVE"    ||
          e.status === "PROBATION" ||
          e.status === "ON_LEAVE"
        ) && !e.archived
      ));
    },
    (error) => {
      console.error("Employee subscribe error:", error);
      onError?.(error);
      onData([]);
    }
  );
}

// ── Subscribe — active only (no archived) ─────
// Used by: Employee screen default view
export function subscribeToActiveEmployees(
  restaurantId: string,
  onData: (employees: EmployeeDB[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(col(restaurantId), orderBy("employeeNumber", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => mapEmployeeDoc(d.id, d.data() as Record<string, unknown>, restaurantId))
          .filter((e) => !e.archived)
      );
    },
    (error) => {
      console.error("Employee subscribe (active) error:", error);
      onError?.(error);
      onData([]);
    }
  );
}

// ── Subscribe — ALL including archived ────────
// Used by: HR view
export function subscribeToAllEmployees(
  restaurantId: string,
  onData: (employees: EmployeeDB[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(col(restaurantId), orderBy("employeeNumber", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) =>
          mapEmployeeDoc(d.id, d.data() as Record<string, unknown>, restaurantId)
        )
      );
    },
    (error) => {
      console.error("Employee subscribe (all) error:", error);
      onError?.(error);
      onData([]);
    }
  );
}

// ── Multi-restaurant chunked ──────────────────
// Used by: Owner dashboard — 30+ restaurants
// Firestore index required:
//   collectionGroup "employees"
//   Fields: restaurantId ASC, employeeNumber ASC
export function subscribeToEmployeesByRestaurants(
  restaurantIds: string[],
  onData: (employees: EmployeeDB[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  if (restaurantIds.length === 0) {
    onData([]);
    return () => {};
  }

  const chunks        = chunkArray(restaurantIds, FIRESTORE_IN_QUERY_LIMIT);
  const unsubscribers: (() => void)[] = [];
  const resultMap     = new Map<string, Map<string, EmployeeDB>>();

  const mergeAndEmit = () => {
    const allEmployees: EmployeeDB[] = [];
    resultMap.forEach((chunkMap) => {
      chunkMap.forEach((emp) => allEmployees.push(emp));
    });
    allEmployees.sort((a, b) => {
      if (a.restaurantId !== b.restaurantId) {
        return a.restaurantId.localeCompare(b.restaurantId);
      }
      return a.employeeNumber.localeCompare(b.employeeNumber);
    });
    onData(allEmployees);
  };

  chunks.forEach((chunk, chunkIndex) => {
    const chunkKey = String(chunkIndex);
    const q = query(
      collectionGroup(db, "employees"),
      where("restaurantId", "in",  chunk),
      where("archived",     "==",  false),
      orderBy("restaurantId",   "asc"),
      orderBy("employeeNumber", "asc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const chunkMap = new Map<string, EmployeeDB>();
        snap.docs.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const rId  = (data.restaurantId as string) ?? "";
          const emp  = mapEmployeeDoc(d.id, data, rId);
          chunkMap.set(`${emp.restaurantId}_${emp.id}`, emp);
        });
        resultMap.set(chunkKey, chunkMap);
        mergeAndEmit();
      },
      (error) => {
        console.error(`Multi-restaurant chunk ${chunkIndex} error:`, error);
        onError?.(error);
      }
    );

    unsubscribers.push(unsub);
  });

  return () => unsubscribers.forEach((unsub) => unsub());
}