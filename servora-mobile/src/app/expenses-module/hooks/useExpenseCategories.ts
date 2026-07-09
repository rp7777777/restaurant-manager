// ============================================
// SERVORA ERP — useExpenseCategories Hook
// Realtime category+subcategory tree, plus first-run seeding
// ============================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../../../context/AppContext";
import {
  subscribeCategoriesWithSubs,
  seedDefaultCategoriesIfEmpty,
} from "../services/category-service";
import { ExpenseCategoryWithSubs } from "../types/category-types";

export function useExpenseCategories() {
  const { restaurantId } = useApp();

  const [categories, setCategories] = useState<ExpenseCategoryWithSubs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    let unsubscribe: () => void = () => {};
    let cancelled = false;

    setLoading(true);
    setError(null);

    async function init() {
      try {
        await seedDefaultCategoriesIfEmpty(restaurantId);
      } catch (err) {
        console.warn("seedDefaultCategoriesIfEmpty failed:", err);
      }

      if (cancelled) return;

      unsubscribe = subscribeCategoriesWithSubs(
        restaurantId,
        (data) => {
          setCategories(data);
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
    }

    init();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [restaurantId]);

  // ── O(1) lookup map, rebuilt only when categories change ──
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const getSubCategoriesFor = useCallback(
    (categoryId: string) => {
      return categoryMap.get(categoryId)?.subCategories ?? [];
    },
    [categoryMap]
  );

  const categoryHasSubCategories = useCallback(
    (categoryId: string) => {
      return getSubCategoriesFor(categoryId).length > 0;
    },
    [getSubCategoriesFor]
  );

  // ── O(1) lookup — used by ExpenseCard to resolve category name/color ──
  const getCategoryById = useCallback(
    (categoryId: string) => {
      return categoryMap.get(categoryId);
    },
    [categoryMap]
  );

  return {
    categories,
    loading,
    error,
    getSubCategoriesFor,
    categoryHasSubCategories,
    getCategoryById,
  };
}