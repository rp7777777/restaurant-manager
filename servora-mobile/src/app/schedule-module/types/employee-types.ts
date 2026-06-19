// ============================================
// SERVORA ERP — Employee Types
// Used by: Schedule, Payroll, Attendance
// ============================================

import { Timestamp } from "firebase/firestore";

export interface EmployeeAllowance {
  name: string;
  amount: number;
  taxable: boolean;
}

export type ContractType =
  | "FULL_TIME"
  | "PART_TIME"
  | "TEMPORARY"
  | "TRAINEE";

export interface EmployeeDB {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  contractType: ContractType;
  basicSalary: number;
  hourlyRate: number;
  overtimeRate: number;
  holidayRate: number;
  nightRate: number;
  taxRate: number;
  ssRate: number;
  contractHoursPerWeek: number;
  allowances: EmployeeAllowance[];
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}