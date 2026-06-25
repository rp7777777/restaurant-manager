// ============================================
// SERVORA ERP — Payroll Filter Utils
// ✅ Search + Status filter logic
// ============================================

import { PayrollDocument, PayrollStatus } from "../types/payroll-types";

export type PayrollFilterStatus = "ALL" | PayrollStatus;

export function filterPayrolls(
  payrolls: PayrollDocument[],
  search: string,
  status: PayrollFilterStatus
): PayrollDocument[] {
  const q = search.toLowerCase().trim();

  return payrolls.filter((p) => {
    // Status filter
    const matchStatus = status === "ALL" || p.payrollStatus === status;

    // Search filter
    const matchSearch = !q ||
  (p.employeeName   ?? "").toLowerCase().includes(q) ||
  (p.employeeNumber ?? "").toLowerCase().includes(q) || // ✅
  (p.position       ?? "").toLowerCase().includes(q);

    return matchStatus && matchSearch;
  });
}
