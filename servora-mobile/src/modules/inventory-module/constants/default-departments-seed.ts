// ============================================
// SERVORA ERP — Default Departments Seed Data
// ✅ Used to auto-create a starter set of departments for a new
//    restaurant, so the owner doesn't have to build the taxonomy
//    from scratch. isSystem: true marks these as seeded defaults
//    (vs. isSystem: false for anything the owner adds later).
// FROZEN
// ============================================

import { CreateDepartmentInput } from "../types/department";

export const DEFAULT_DEPARTMENTS: CreateDepartmentInput[] = [
  { name: "Food",        icon: "🍽️", color: "#16a34a", isSystem: true },
  { name: "Beverage",    icon: "🥤", color: "#2563eb", isSystem: true },
  { name: "Alcohol",     icon: "🍷", color: "#7c3aed", isSystem: true },
  { name: "Bakery",      icon: "🍰", color: "#db2777", isSystem: true },
  { name: "Cleaning",    icon: "🧼", color: "#0891b2", isSystem: true },
  { name: "Packaging",   icon: "📦", color: "#ca8a04", isSystem: true },
  { name: "Kitchen",     icon: "🍳", color: "#ea580c", isSystem: true },
  { name: "Hotel",       icon: "🏨", color: "#4338ca", isSystem: true },
  { name: "Maintenance", icon: "🛠️", color: "#57534e", isSystem: true },
  { name: "Office",      icon: "📄", color: "#64748b", isSystem: true },
];