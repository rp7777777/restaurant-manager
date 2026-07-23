// ============================================
// SERVORA ERP — useCategoriesForPicker Hook
// ✅ Combines live Category + Department subscriptions into a
//    single, display-ready list for the Inventory form's category
//    dropdown — grouped by department (Food > Vegetables, Meat...),
//    matching the "Department → Category" browsing UX discussed
//    earlier.
// FROZEN
// ============================================

import { useState, useEffect, useMemo } from "react";
import { subscribeCategories } from "../repository/category-repository";
import { subscribeDepartments } from "../repository/department-repository";
import { Category } from "../types/category";
import { Department } from "../types/department";

export interface CategoryPickerGroup {
  department: Department | null; // null = categories with no department set
  categories: Category[];
}

export interface UseCategoriesForPickerResult {
  groups:     CategoryPickerGroup[];
  categories: Category[]; // flat list — useful for simple dropdowns
  loading:    boolean;
}

export function useCategoriesForPicker(
  restaurantId: string | null | undefined
): UseCategoriesForPickerResult {
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [catLoaded,    setCatLoaded]    = useState(false);
  const [deptLoaded,   setDeptLoaded]   = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setCategories([]);
      setCatLoaded(true);
      return;
    }
    setCatLoaded(false);
    const unsub = subscribeCategories(
      restaurantId,
      (data) => { setCategories(data); setCatLoaded(true); },
      () => setCatLoaded(true)
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setDepartments([]);
      setDeptLoaded(true);
      return;
    }
    setDeptLoaded(false);
    const unsub = subscribeDepartments(
      restaurantId,
      (data) => { setDepartments(data); setDeptLoaded(true); },
      () => setDeptLoaded(true)
    );
    return unsub;
  }, [restaurantId]);

  const groups = useMemo<CategoryPickerGroup[]>(() => {
    const byDept = new Map<string, Category[]>();
    const noDept: Category[] = [];

    categories.forEach((cat) => {
      if (cat.departmentId) {
        const list = byDept.get(cat.departmentId) ?? [];
        list.push(cat);
        byDept.set(cat.departmentId, list);
      } else {
        noDept.push(cat);
      }
    });

    const result: CategoryPickerGroup[] = departments
      .map((dept) => ({
        department: dept,
        categories: byDept.get(dept.id) ?? [],
      }))
      .filter((g) => g.categories.length > 0);

    if (noDept.length > 0) {
      result.push({ department: null, categories: noDept });
    }

    return result;
  }, [categories, departments]);

  return {
    groups,
    categories,
    loading: !catLoaded || !deptLoaded,
  };
}