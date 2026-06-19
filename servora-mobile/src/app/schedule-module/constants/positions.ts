// ============================================
// SERVORA ERP — Employee Positions
// Used by: Schedule, Employees, Payroll
// Future: load from Firestore settings
// ============================================

export const DEFAULT_POSITIONS = [
  "Chef 3rd",
  "Chef 2nd",
  "Head Chef",
  "Waiter/Waitress",
  "Supervisor",
  "Cashier",
  "Store Keeper",
  "Manager",
  "Bartender",
  "Kitchen Porter",
  "Delivery Driver",
] as const;

// ✅ string — custom positions add garna milxa (Pizza Chef etc.)
export type PositionType = string;