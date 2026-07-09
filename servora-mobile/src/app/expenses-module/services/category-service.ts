// ============================================
// SERVORA ERP — Category Service
// Multi-tenant Firestore operations for expense categories
// and their nested subcategories
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, onSnapshot, query, orderBy, where, limit,
  serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  ExpenseCategory,
  ExpenseSubCategory,
  CreateCategoryInput,
  CreateSubCategoryInput,
  ExpenseCategoryWithSubs,
} from "../types/category-types";
import { DEFAULT_EXPENSE_CATEGORIES } from "../constants/default-categories";

function categoriesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSE_CATEGORIES);
}

function categoryDoc(restaurantId: string, categoryId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSE_CATEGORIES, categoryId);
}

function subCategoriesCollection(restaurantId: string, categoryId: string) {
  return collection(categoryDoc(restaurantId, categoryId), "subcategories");
}

function subCategoryDoc(restaurantId: string, categoryId: string, subCategoryId: string) {
  return doc(categoryDoc(restaurantId, categoryId), "subcategories", subCategoryId);
}

function expensesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.EXPENSES);
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

// ── Seed default categories for a brand-new restaurant.
//    Only runs if the restaurant has no categories yet — safe to call
//    on every app load without creating duplicates. ──
export async function seedDefaultCategoriesIfEmpty(restaurantId: string): Promise<void> {
  if (!restaurantId) return;

  const existing = await getDocs(categoriesCollection(restaurantId));
  if (!existing.empty) return;

  const batch = writeBatch(db);
  DEFAULT_EXPENSE_CATEGORIES.forEach((seed) => {
    const ref = doc(categoriesCollection(restaurantId));
    batch.set(ref, {
      name: seed.name,
      normalizedName: normalize(seed.name),
      color: seed.color,
      restaurantId,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// ── Create a new category — blocked if a category with the same
//    name already exists (case-insensitive match). ──
export async function createCategory(
  restaurantId: string,
  input: CreateCategoryInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const trimmedName = input.name.trim();
  const normalizedName = normalize(trimmedName);

  const dupeQuery = query(
    categoriesCollection(restaurantId),
    where("normalizedName", "==", normalizedName),
    limit(1)
  );
  const dupeSnap = await getDocs(dupeQuery);
  if (!dupeSnap.empty) {
    throw new Error("Category already exists.");
  }

  const docRef = await addDoc(categoriesCollection(restaurantId), {
    ...input,
    name: trimmedName,
    normalizedName,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── Update a category (e.g. rename, change color) — blocked if renaming
//    would collide with another existing category (case-insensitive). ──
export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  updates: Partial<Pick<ExpenseCategory, "name" | "color">>
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const cleanUpdates: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };

  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    const normalizedName = normalize(trimmedName);

    const dupeQuery = query(
      categoriesCollection(restaurantId),
      where("normalizedName", "==", normalizedName),
      limit(1)
    );
    const dupeSnap = await getDocs(dupeQuery);
    const collidesWithOther = dupeSnap.docs.some((d) => d.id !== categoryId);
    if (collidesWithOther) {
      throw new Error("Category already exists.");
    }

    cleanUpdates.name = trimmedName;
    cleanUpdates.normalizedName = normalizedName;
  }

  await updateDoc(categoryDoc(restaurantId, categoryId), cleanUpdates);
}

// ── Delete a category — blocked if any expense still references it,
//    to avoid leaving orphaned categoryId references behind. ──
export async function deleteCategory(
  restaurantId: string,
  categoryId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const inUseQuery = query(
    expensesCollection(restaurantId),
    where("categoryId", "==", categoryId),
    limit(1)
  );
  const inUseSnap = await getDocs(inUseQuery);
  if (!inUseSnap.empty) {
    throw new Error("Cannot delete category — it is already used by existing expenses.");
  }

  const subSnap = await getDocs(subCategoriesCollection(restaurantId, categoryId));
  const batch = writeBatch(db);
  subSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(categoryDoc(restaurantId, categoryId));
  await batch.commit();
}

// ── Create a subcategory under a category — blocked if a subcategory
//    with the same name already exists under that category. ──
export async function createSubCategory(
  restaurantId: string,
  input: CreateSubCategoryInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const trimmedName = input.name.trim();
  const normalizedName = normalize(trimmedName);

  const dupeQuery = query(
    subCategoriesCollection(restaurantId, input.categoryId),
    where("normalizedName", "==", normalizedName),
    limit(1)
  );
  const dupeSnap = await getDocs(dupeQuery);
  if (!dupeSnap.empty) {
    throw new Error("Sub-category already exists.");
  }

  const docRef = await addDoc(
    subCategoriesCollection(restaurantId, input.categoryId),
    { ...input, name: trimmedName, normalizedName, createdAt: serverTimestamp() }
  );
  return docRef.id;
}

// ── Update a subcategory — blocked if renaming would collide with
//    another subcategory under the same category. ──
export async function updateSubCategory(
  restaurantId: string,
  categoryId: string,
  subCategoryId: string,
  updates: Partial<Pick<ExpenseSubCategory, "name">>
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const cleanUpdates: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };

  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    const normalizedName = normalize(trimmedName);

    const dupeQuery = query(
      subCategoriesCollection(restaurantId, categoryId),
      where("normalizedName", "==", normalizedName),
      limit(1)
    );
    const dupeSnap = await getDocs(dupeQuery);
    const collidesWithOther = dupeSnap.docs.some((d) => d.id !== subCategoryId);
    if (collidesWithOther) {
      throw new Error("Sub-category already exists.");
    }

    cleanUpdates.name = trimmedName;
    cleanUpdates.normalizedName = normalizedName;
  }

  await updateDoc(subCategoryDoc(restaurantId, categoryId, subCategoryId), cleanUpdates);
}

// ── Delete a subcategory — blocked if any expense still references it ──
export async function deleteSubCategory(
  restaurantId: string,
  categoryId: string,
  subCategoryId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const inUseQuery = query(
    expensesCollection(restaurantId),
    where("subCategoryId", "==", subCategoryId),
    limit(1)
  );
  const inUseSnap = await getDocs(inUseQuery);
  if (!inUseSnap.empty) {
    throw new Error("Cannot delete sub-category — it is already used by existing expenses.");
  }

  await deleteDoc(subCategoryDoc(restaurantId, categoryId, subCategoryId));
}

// ── Realtime subscription — all categories with their subcategories nested.
//    Categories change very rarely (<100 docs), so one getDocs() per
//    category for subcategories is acceptable — not a hot path. ──
export function subscribeCategoriesWithSubs(
  restaurantId: string,
  callback: (categories: ExpenseCategoryWithSubs[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(categoriesCollection(restaurantId), orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    async (snap) => {
      try {
        const categories = await Promise.all(
          snap.docs.map(async (d) => {
            const category = { id: d.id, ...(d.data() as Omit<ExpenseCategory, "id">) };
            const subSnap = await getDocs(
              query(subCategoriesCollection(restaurantId, d.id), orderBy("createdAt", "asc"))
            );
            const subCategories = subSnap.docs.map((s) => ({
              id: s.id,
              ...(s.data() as Omit<ExpenseSubCategory, "id">),
            }));
            return { ...category, subCategories };
          })
        );
        callback(categories);
      } catch (err) {
        onError?.(err as Error);
      }
    },
    (err) => onError?.(err)
  );
}