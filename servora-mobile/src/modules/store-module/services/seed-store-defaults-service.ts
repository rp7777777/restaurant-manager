// ============================================
// SERVORA ERP — Seed Store Defaults Service
// ✅ One-time (but idempotent — safe to re-run) orchestrator that
//    creates the default Department + Category taxonomy for a
//    restaurant that doesn't have any yet.
// ✅ Idempotent: checks EXISTING departments/categories by name
//    first, only creates what's actually missing. Running this
//    twice never creates duplicates.
// ✅ All seeded items get isSystem: true (per the earlier
//    Department/Category design).
// FROZEN
// ============================================

import { createDepartment, getAllDepartments } from "../../inventory-module/repository/department-repository";
import { createCategory, getAllCategories } from "../../inventory-module/repository/category-repository";
import { DEFAULT_DEPARTMENTS } from "../../inventory-module/constants/default-departments-seed";
import { DEFAULT_CATEGORIES_BY_DEPARTMENT } from "../../inventory-module/constants/default-categories-seed";

export interface SeedResult {
  departmentsCreated: number;
  departmentsSkipped: number;
  categoriesCreated:  number;
  categoriesSkipped:  number;
}

export async function seedDefaultStoreTaxonomy(
  restaurantId: string
): Promise<SeedResult> {
  if (!restaurantId) throw new Error("Restaurant not configured");

  let departmentsCreated = 0;
  let departmentsSkipped = 0;
  let categoriesCreated  = 0;
  let categoriesSkipped  = 0;

  // ── Step 1: Departments — check existing first, only create
  //    what's missing (case-insensitive name match). ──
  const existingDepartments = await getAllDepartments(restaurantId);
  const departmentIdByName = new Map<string, string>(
    existingDepartments.map((d) => [d.name.trim().toLowerCase(), d.id])
  );

  for (const deptInput of DEFAULT_DEPARTMENTS) {
    const key = deptInput.name.trim().toLowerCase();
    if (departmentIdByName.has(key)) {
      departmentsSkipped += 1;
      continue;
    }
    try {
      const id = await createDepartment(restaurantId, deptInput);
      departmentIdByName.set(key, id);
      departmentsCreated += 1;
    } catch (error) {
      console.warn(`Seed: failed to create department "${deptInput.name}":`, error);
      departmentsSkipped += 1;
    }
  }

  // ── Step 2: Categories — same idempotent pattern, resolving
  //    departmentId from the map built above. ──
  const existingCategories = await getAllCategories(restaurantId);
  const existingCategoryNames = new Set(
    existingCategories.map((c) => c.name.trim().toLowerCase())
  );

  for (const group of DEFAULT_CATEGORIES_BY_DEPARTMENT) {
    const departmentId = departmentIdByName.get(group.departmentName.trim().toLowerCase());

    for (const catInput of group.categories) {
      const key = catInput.name.trim().toLowerCase();
      if (existingCategoryNames.has(key)) {
        categoriesSkipped += 1;
        continue;
      }
      try {
        await createCategory(restaurantId, {
          name:         catInput.name,
          icon:         catInput.icon,
          departmentId,
          isSystem:     true,
        });
        existingCategoryNames.add(key);
        categoriesCreated += 1;
      } catch (error) {
        console.warn(`Seed: failed to create category "${catInput.name}":`, error);
        categoriesSkipped += 1;
      }
    }
  }

  return { departmentsCreated, departmentsSkipped, categoriesCreated, categoriesSkipped };
}