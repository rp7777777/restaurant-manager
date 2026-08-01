// ============================================
// SERVORA ERP — Kitchen Module Constants
// ✅ Moved verbatim from the old kitchen-module/index.tsx as part
//    of the Phase 2 module restructuring — values unchanged, just
//    relocated so every screen/component/hook in this module reads
//    them from one place instead of each file redefining its own.
// ============================================

import { RequestStatus } from "../types/kitchen-types";

export const UNITS = [
  "kg", "g", "L", "ml", "pcs", "box", "bag", "bottle", "pac",
] as const;

export const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#3b82f6",
  ISSUED: "#10b981",
  REJECTED: "#ef4444",
};

export const STATUS_ICONS: Record<RequestStatus, string> = {
  PENDING: "schedule",
  APPROVED: "check-circle",
  ISSUED: "done-all",
  REJECTED: "cancel",
};