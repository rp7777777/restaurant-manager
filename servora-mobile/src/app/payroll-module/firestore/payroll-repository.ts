// ============================================
// SERVORA ERP — Payroll Repository
// ✅ setDoc — deterministic ID
// ✅ createdAt preserved on update
// ✅ Lock protection on delete
// ✅ Status flow — DRAFT→GENERATED→PAID only
// ✅ lockPayroll — PAID status protected
// ============================================

import {
  collection, doc, getDocs,
  setDoc, updateDoc, deleteDoc,
  getDoc, onSnapshot,
  query, where, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { PayrollDocument, PayrollStatus } from "../types/payroll-types";

const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "payroll");

const payrollDoc = (restaurantId: string, docId: string) =>
  doc(db, "restaurants", restaurantId, "payroll", docId);

export function buildPayrollId(
  employeeNo: string,
  monthStr: string
): string {
  return employeeNo + "_" + monthStr.replace(/[^a-zA-Z0-9-]/g, "_");
}

const STATUS_ORDER: Record<PayrollStatus, number> = {
  DRAFT:     0,
  GENERATED: 1,
  PAID:      2,
};

export function subscribeToPayroll(
  restaurantId: string,
  month: string,
  onData: (payrolls: PayrollDocument[]) => void,
  onError?: () => void
): () => void {
  const q = query(col(restaurantId), where("month", "==", month));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PayrollDocument, "id">),
      })));
    },
    (error) => {
      console.error("Payroll subscribe error:", error);
      onError?.();
    }
  );
}

export async function getPayrollsByMonth(
  restaurantId: string,
  month: string
): Promise<PayrollDocument[]> {
  const snap = await getDocs(
    query(col(restaurantId), where("month", "==", month))
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PayrollDocument, "id">),
  }));
}

export async function getExistingPayrollNos(
  restaurantId: string,
  month: string
): Promise<Set<string>> {
  const snap = await getDocs(
    query(col(restaurantId), where("month", "==", month))
  );
  return new Set(snap.docs.map((d) => d.data().employeeNo as string));
}

// ✅ createdAt preserved on update
export async function savePayroll(
  restaurantId: string,
  docId: string,
  data: Omit<PayrollDocument, "id">
): Promise<void> {
  const existing = await getDoc(payrollDoc(restaurantId, docId));
  await setDoc(payrollDoc(restaurantId, docId), {
    ...data,
    userId:    auth.currentUser?.uid ?? "",
    createdAt: existing.exists()
      ? existing.data().createdAt
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ✅ Status flow — backwards blocked
export async function updatePayrollStatus(
  restaurantId: string,
  docId: string,
  newStatus: PayrollStatus
): Promise<void> {
  const snap          = await getDoc(payrollDoc(restaurantId, docId));
  const currentStatus = snap.data()?.payrollStatus as PayrollStatus;

  if (
    currentStatus &&
    STATUS_ORDER[newStatus] <= STATUS_ORDER[currentStatus]
  ) {
    throw new Error(
      "Cannot move payroll backwards: " +
      currentStatus + " → " + newStatus
    );
  }

  await updateDoc(payrollDoc(restaurantId, docId), {
    payrollStatus: newStatus,
    updatedAt:     serverTimestamp(),
  });
}

// ✅ lockPayroll — PAID status protected
export async function lockPayroll(
  restaurantId: string,
  docId: string
): Promise<void> {
  const snap = await getDoc(payrollDoc(restaurantId, docId));
  // ✅ Already PAID — don't downgrade
  if (snap.data()?.payrollStatus === "PAID") return;

  await updateDoc(payrollDoc(restaurantId, docId), {
    locked:        true,
    payrollStatus: "GENERATED" as PayrollStatus,
    updatedAt:     serverTimestamp(),
  });
}

export async function markPayrollPaid(
  restaurantId: string,
  docId: string
): Promise<void> {
  await updatePayrollStatus(restaurantId, docId, "PAID");
}

// ✅ Lock protection — locked payroll cannot be deleted
export async function deletePayroll(
  restaurantId: string,
  docId: string
): Promise<void> {
  const snap = await getDoc(payrollDoc(restaurantId, docId));
  if (snap.data()?.locked === true) {
    throw new Error("Locked payroll cannot be deleted");
  }
  await deleteDoc(payrollDoc(restaurantId, docId));
}