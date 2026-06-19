// ============================================
// SERVORA ERP — Audit Service
// Enterprise-grade action logging
// ============================================

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";

export type AuditAction = "CREATE" | "EDIT" | "DELETE" | "LOGIN" | "LOGOUT" | "VIEW";
export type AuditModule =
  | "SALES" | "EXPENSES" | "INVENTORY" | "PAYROLL"
  | "SCHEDULE" | "EMPLOYEES" | "SETTINGS" | "AUTH"
  | "STORE" | "KITCHEN" | "USERS" | "BACKUP";

interface AuditLog {
  userId: string;
  restaurantId: string;
  moduleName: AuditModule;
  action: AuditAction;
  recordId: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  timestamp: unknown;
  ipAddress?: string;
}

async function saveAuditLog(
  moduleName: AuditModule,
  action: AuditAction,
  recordId: string,
  oldData: Record<string, unknown> | null = null,
  newData: Record<string, unknown> | null = null
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const log: Omit<AuditLog, "timestamp"> & { timestamp: unknown } = {
      userId: user.uid,
      restaurantId: (user as any).restaurantId ?? user.uid,
      moduleName,
      action,
      recordId,
      oldData,
      newData,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, "auditLogs"), log);
  } catch (error) {
    // Never block main flow for audit errors
    console.warn("Audit log failed:", error);
  }
}

export const logCreate = (
  module: AuditModule,
  recordId: string,
  data: Record<string, unknown>
) => saveAuditLog(module, "CREATE", recordId, null, data);

export const logEdit = (
  module: AuditModule,
  recordId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
) => saveAuditLog(module, "EDIT", recordId, oldData, newData);

export const logDelete = (
  module: AuditModule,
  recordId: string,
  data: Record<string, unknown>
) => saveAuditLog(module, "DELETE", recordId, data, null);

export const logLogin = () =>
  saveAuditLog("AUTH", "LOGIN", auth.currentUser?.uid ?? "");

export const logLogout = () =>
  saveAuditLog("AUTH", "LOGOUT", auth.currentUser?.uid ?? "");
export default {};
