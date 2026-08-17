// ============================================
// SERVORA ERP — Seed Store Defaults Service
// ✅ One-time (but idempotent — safe to re-run) orchestrator that
//    creates the default Category taxonomy for a restaurant that
//    doesn't have any yet.
// ✅ MAJOR REVISION — matching default-categories-seed.ts's new flat
//    12-category design, this service NO LONGER creates or depends
//    on Departments at all. Previously this seeded 10 Departments
//    first, then resolved each Category's departmentId by matching
//    against DEFAULT_CATEGORIES_BY_DEPARTMENT's grouping. That
//    department-nesting concept is gone — categories are now
//    created flat, with no departmentId, matching the confirmed "12
//    main categories, no parent-child nesting" design. Department
//    creation/lookup logic (createDepartment/getAllDepartments,
//    DEFAULT_DEPARTMENTS) is removed from this function entirely —
//    the Department repository/type itself is left untouched
//    elsewhere in the codebase in case it's needed for some other
//    purpose later, but this seeding flow no longer touches it.
// ✅ Idempotent: checks EXISTING categories by name first, only
//    creates what's actually missing. Running this twice never
//    creates duplicates.
// ✅ All seeded categories get isSystem: true.
// ✅ SeedResult's departmentsCreated/departmentsSkipped fields are
//    KEPT (always 0 now) rather than removed, so
//    InventoryToolbar.tsx's existing success-message formatting
//    ("Created X departments, Y categories") doesn't need an
//    immediate matching change — it will just always show "0
//    departments" going forward. A follow-up UI cleanup to drop the
//    departments phrase entirely is a reasonable future tidy-up, not
//    done here to keep this change scoped to the seeding logic
//    itself.
// FROZEN
// ============================================

import { createCategory, getAllCategories } from "../../inventory-module/repository/category-repository";
import { DEFAULT_CATEGORIES } from "../../inventory-module/constants/default-categories-seed";

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

  let categoriesCreated  = 0;
  let categoriesSkipped  = 0;

  // ── Idempotent pattern — check existing category names first,
  //    only create what's missing (case-insensitive match). No
  //    department step at all now. ──
  const existingCategories = await getAllCategories(restaurantId);
  const existingCategoryNames = new Set(
    existingCategories.map((c) => c.name.trim().toLowerCase())
  );

  for (const catInput of DEFAULT_CATEGORIES) {
    const key = catInput.name.trim().toLowerCase();
    if (existingCategoryNames.has(key)) {
      categoriesSkipped += 1;
      continue;
    }
    try {
      await createCategory(restaurantId, {
        name:     catInput.name,
        icon:     catInput.icon,
        isSystem: true,
      });
      existingCategoryNames.add(key);
      categoriesCreated += 1;
    } catch (error) {
      console.warn(`Seed: failed to create category "${catInput.name}":`, error);
      categoriesSkipped += 1;
    }
  }

  return {
    departmentsCreated: 0,
    departmentsSkipped: 0,
    categoriesCreated,
    categoriesSkipped,
  };
}