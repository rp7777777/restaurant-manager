// ============================================
// SERVORA ERP — useEmployeeStats Hook
// ✅ total = working employees (archived excluded)
// ✅ switch statement — readable + maintainable
// ✅ Single O(n) pass — useMemo
// ✅ No Firestore, No Context
// FROZEN
// ============================================

import { useMemo } from "react";
import { EmployeeDB } from "../types/employee-types";
import {
  getTotalAllowances,
  getGrossSalary,
} from "../utils/employee-calculations";

export interface EmployeeStats {
  // ✅ total = working only (archived excluded)
  total:       number;
  active:      number;
  probation:   number;
  onLeave:     number;
  inactive:    number;
  terminated:  number;
  archived:    number;  // separate — not in total

  // Payroll — active + probation only
  totalMonthlySalary: number;
  totalGrossSalary:   number;
  totalAllowances:    number;
  averageSalary:      number;

  // Contract breakdown
  fullTime:   number;
  partTime:   number;
  fixedTerm:  number;
  openEnded:  number;
  temporary:  number;
  internship: number;
  seasonal:   number;
  trainee:    number;

  // Role breakdown
  byRole: Record<string, number>;
}

export function useEmployeeStats(
  employees: EmployeeDB[]
): EmployeeStats {
  return useMemo(() => {
    const stats: EmployeeStats = {
      total:       0,
      active:      0,
      probation:   0,
      onLeave:     0,
      inactive:    0,
      terminated:  0,
      archived:    0,

      totalMonthlySalary: 0,
      totalGrossSalary:   0,
      totalAllowances:    0,
      averageSalary:      0,

      fullTime:   0,
      partTime:   0,
      fixedTerm:  0,
      openEnded:  0,
      temporary:  0,
      internship: 0,
      seasonal:   0,
      trainee:    0,

      byRole: {},
    };

    employees.forEach((emp) => {
      // Archived — count separately, skip everything else
      if (emp.archived) {
        stats.archived++;
        return;
      }

      // ✅ Issue #2 — switch statement
      switch (emp.status) {
        case "ACTIVE":      stats.active++;     break;
        case "PROBATION":   stats.probation++;  break;
        case "ON_LEAVE":    stats.onLeave++;    break;
        case "INACTIVE":    stats.inactive++;   break;
        case "TERMINATED":  stats.terminated++; break;
      }

      // Payroll — active + probation only
      if (emp.status === "ACTIVE" || emp.status === "PROBATION") {
        const allowances = getTotalAllowances(emp);
        const gross      = getGrossSalary(emp);
        stats.totalMonthlySalary += emp.monthlySalary;
        stats.totalAllowances    += allowances;
        stats.totalGrossSalary   += gross;
      }

      // Contract breakdown
      switch (emp.contractType) {
        case "FULL_TIME":  stats.fullTime++;   break;
        case "PART_TIME":  stats.partTime++;   break;
        case "FIXED_TERM": stats.fixedTerm++;  break;
        case "OPEN_ENDED": stats.openEnded++;  break;
        case "TEMPORARY":  stats.temporary++;  break;
        case "INTERNSHIP": stats.internship++; break;
        case "SEASONAL":   stats.seasonal++;   break;
        case "TRAINEE":    stats.trainee++;    break;
      }

      // Role breakdown
      stats.byRole[emp.role] = (stats.byRole[emp.role] ?? 0) + 1;
    });

    // ✅ Issue #1 — total = working employees only
    stats.total =
      stats.active +
      stats.probation +
      stats.onLeave +
      stats.inactive +
      stats.terminated;

    // Average salary — active + probation only
    const activeProbationCount = stats.active + stats.probation;
    stats.averageSalary = activeProbationCount > 0
      ? parseFloat((stats.totalMonthlySalary / activeProbationCount).toFixed(2))
      : 0;

    return stats;
  }, [employees]);
}