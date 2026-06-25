// ============================================
// SERVORA ERP — Employee Service
// ✅ Business logic only — no validation logic
// ✅ All validation → employee-validation.ts
// ✅ Transfer — caller decides permanent/multi-location
// ✅ Soft delete — archived flag
// ✅ Hard delete — orphan warning
// ✅ Firestore payload — undefined fields stripped
// ✅ No UI, No Context, No AppContext
// FROZEN
// ============================================

import {
  collection, doc, addDoc, updateDoc,
  deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { EmployeeDB, LeaveBalance } from "../types/employee-types";
import {
  validateEmployee,
  validateEmployeeUpdate,
  checkDuplicateEmployeeNumber,
} from "../utils/employee-validation";
import { DEFAULT_LEAVE_BALANCE } from "../constants/employee-defaults";
import { ROLE_ACCESS_MAP } from "../constants/employee-roles";

// ── Collection ref ────────────────────────────
const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "employees");

const docRef = (restaurantId: string, employeeId: string) =>
  doc(db, "restaurants", restaurantId, "employees", employeeId);

// ── Strip undefined ───────────────────────────
// ✅ Firestore does not support undefined values
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

// ── Result type ───────────────────────────────
export interface ServiceResult {
  success: boolean;
  id?: string;
  error?: string;
  validationErrors?: Record<string, string>;
}

// ── Create Employee ───────────────────────────
export interface CreateEmployeeInput {
  data: Omit<EmployeeDB, "id" | "createdAt" | "updatedAt">;
  existingEmployees: Pick<EmployeeDB, "id" | "employeeNumber">[];
}

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<ServiceResult> {
  const { data, existingEmployees } = input;

  const validation = validateEmployee(data);
  if (!validation.valid) {
    return { success: false, validationErrors: validation.errors };
  }

  const dupError = checkDuplicateEmployeeNumber(
    data.employeeNumber,
    existingEmployees,
  );
  if (dupError) {
    return { success: false, error: dupError };
  }

  try {
    const accessLevel  = data.accessLevel ?? ROLE_ACCESS_MAP[data.role];
    const leaveBalance = data.leaveBalance ?? DEFAULT_LEAVE_BALANCE;

    // ✅ Strip undefined before Firestore write
    const payload = stripUndefined({
      ...data,
      accessLevel,
      leaveBalance,
      archived:  false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const ref = await addDoc(col(data.restaurantId), payload);
    return { success: true, id: ref.id };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create employee";
    return { success: false, error: message };
  }
}

// ── Update Employee ───────────────────────────
export interface UpdateEmployeeInput {
  employeeId: string;
  restaurantId: string;
  data: Partial<Omit<EmployeeDB, "id" | "createdAt" | "restaurantId">>;
  existingEmployees: Pick<EmployeeDB, "id" | "employeeNumber">[];
}

export async function updateEmployee(
  input: UpdateEmployeeInput
): Promise<ServiceResult> {
  const { employeeId, restaurantId, data, existingEmployees } = input;

  const validation = validateEmployeeUpdate(data);
  if (!validation.valid) {
    return { success: false, validationErrors: validation.errors };
  }

  if (data.employeeNumber) {
    const dupError = checkDuplicateEmployeeNumber(
      data.employeeNumber,
      existingEmployees,
      employeeId,
    );
    if (dupError) {
      return { success: false, error: dupError };
    }
  }

  try {
    // ✅ Strip undefined before Firestore write
    const updatePayload = stripUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    });

    if (data.role && !data.accessLevel) {
      updatePayload.accessLevel = ROLE_ACCESS_MAP[data.role];
    }

    await updateDoc(docRef(restaurantId, employeeId), updatePayload);
    return { success: true, id: employeeId };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update employee";
    return { success: false, error: message };
  }
}

// ── Archive Employee ──────────────────────────
export async function archiveEmployee(
  restaurantId: string,
  employeeId: string,
): Promise<ServiceResult> {
  try {
    await updateDoc(docRef(restaurantId, employeeId), {
      archived:  true,
      updatedAt: serverTimestamp(),
    });
    return { success: true, id: employeeId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to archive employee";
    return { success: false, error: message };
  }
}

// ── Restore Employee ──────────────────────────
export async function restoreEmployee(
  restaurantId: string,
  employeeId: string,
): Promise<ServiceResult> {
  try {
    await updateDoc(docRef(restaurantId, employeeId), {
      archived:  false,
      updatedAt: serverTimestamp(),
    });
    return { success: true, id: employeeId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to restore employee";
    return { success: false, error: message };
  }
}

// ── Update Status ─────────────────────────────
export async function updateEmployeeStatus(
  restaurantId: string,
  employeeId: string,
  status: EmployeeDB["status"],
  terminationDate?: string,
): Promise<ServiceResult> {
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (status === "TERMINATED" && terminationDate) {
      payload.terminationDate = terminationDate;
    }
    await updateDoc(docRef(restaurantId, employeeId), payload);
    return { success: true, id: employeeId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update status";
    return { success: false, error: message };
  }
}

// ── Transfer Employee ─────────────────────────
// ✅ Caller decides permanent vs multi-location
export interface TransferEmployeeInput {
  fromRestaurantId: string;
  toRestaurantId: string;
  toRestaurantName: string;
  employeeId: string;
  assignedRestaurantIds: string[];
}

export async function transferEmployee(
  input: TransferEmployeeInput
): Promise<ServiceResult> {
  const {
    fromRestaurantId,
    toRestaurantId,
    toRestaurantName,
    employeeId,
    assignedRestaurantIds,
  } = input;

  try {
    await updateDoc(docRef(fromRestaurantId, employeeId), {
      restaurantId:          toRestaurantId,
      restaurantName:        toRestaurantName,
      assignedRestaurantIds: Array.from(new Set(assignedRestaurantIds)),
      updatedAt:             serverTimestamp(),
    });
    return { success: true, id: employeeId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to transfer employee";
    return { success: false, error: message };
  }
}

// ── Update Leave Balance ──────────────────────
export async function updateLeaveBalance(
  restaurantId: string,
  employeeId: string,
  leaveBalance: LeaveBalance,
): Promise<ServiceResult> {
  try {
    await updateDoc(docRef(restaurantId, employeeId), {
      leaveBalance,
      updatedAt: serverTimestamp(),
    });
    return { success: true, id: employeeId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update leave balance";
    return { success: false, error: message };
  }
}

// ── Hard Delete ───────────────────────────────
// ⚠️ DANGEROUS — prefer archiveEmployee()
// Only for: GDPR requests, test data cleanup
// TODO: Check linked records before deleting:
//   - payrolls, schedules, attendance,
//   - leave requests, salary slips, documents
// Orphan records remain if deleted without cleanup!
export async function hardDeleteEmployee(
  restaurantId: string,
  employeeId: string,
): Promise<ServiceResult> {
  try {
    await deleteDoc(docRef(restaurantId, employeeId));
    return { success: true, id: employeeId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete employee";
    return { success: false, error: message };
  }
}