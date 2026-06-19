// ============================================
// SERVORA ERP — Employee Repository
// ✅ mapEmployeeDoc — reusable mapper
// ✅ Fallback values — no crash on old records
// ✅ Error handling
// ============================================

import {
  collection, onSnapshot,
  query, orderBy,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { EmployeeDB } from "../types/employee-types";
import { SCHEDULE_CONFIG } from "../constants/schedule-config";

const col = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "employees");

// ✅ Reusable mapper — Payroll, Attendance, Schedule sabai le use garxa
export function mapEmployeeDoc(id: string, data: any): EmployeeDB {
  const basicSalary = data.basicSalary ?? 0;
  return {
    id,
    employeeNo:           data.employeeNo           ?? "",
    fullName:             data.fullName             ?? "",
    position:             data.position             ?? "",
    contractType:         data.contractType         ?? "FULL_TIME",
    basicSalary,
    hourlyRate:           data.hourlyRate ?? (
      SCHEDULE_CONFIG.MONTHLY_HOURS > 0
        ? basicSalary / SCHEDULE_CONFIG.MONTHLY_HOURS
        : 0
    ),
    overtimeRate:         data.overtimeRate  ?? SCHEDULE_CONFIG.DEFAULT_OT_RATE,
    holidayRate:          data.holidayRate   ?? SCHEDULE_CONFIG.DEFAULT_HOLIDAY_RATE,
    nightRate:            data.nightRate     ?? SCHEDULE_CONFIG.DEFAULT_NIGHT_RATE,
    taxRate:              data.taxRate       ?? SCHEDULE_CONFIG.DEFAULT_TAX_RATE,
    ssRate:               data.ssRate        ?? SCHEDULE_CONFIG.DEFAULT_SS_RATE,
    contractHoursPerWeek: data.contractHoursPerWeek ?? SCHEDULE_CONFIG.NORMAL_WEEKLY_HOURS,
    allowances:           data.allowances    ?? [],
    active:               data.active !== false,
  };
}

export function subscribeToEmployees(
  restaurantId: string,
  onData: (employees: EmployeeDB[]) => void,
  onError?: (err: unknown) => void  // ✅ 3rd parameter add
): () => void {
  const q = query(col(restaurantId), orderBy("employeeNo", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => mapEmployeeDoc(d.id, d.data()))
          .filter((e) => e.active)
      );
    },
    (error) => {
      console.error("Employee subscribe error:", error);
      onError?.(error);  // ✅ pass to caller
      onData([]);
    }
  );
}