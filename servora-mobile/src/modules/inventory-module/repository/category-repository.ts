// ============================================
// SERVORA ERP — Inventory Category Repository
// ✅ Single gateway for all category Firestore operations
// ✅ Duplicate-name prevention — case-insensitive check before
//    create/rename, so "Fish"/"fish"/"FISH" can never coexist as
//    separate categories for the same restaurant
// ✅ NOTE: the duplicate check is a query-based read, not wrapped
//    in a transaction — Firestore transactions only track
//    single-document reads, not queries. Two near-simultaneous
//    category creates with the same name could rarely both pass
//    the check in a race. Accepted as low-risk (category creation
//    is an infrequent admin action, not a high-frequency operation
//    like Sales/Attendance).
// ✅ Duplicate check currently fetches all categories client-side
//    (fine at typical scale of 20-50 categories per restaurant).
//    A normalizedName field + where() query is a valid future
//    optimization, deferred until it's actually needed.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, onSnapshot, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../types/category";

function categoriesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_CATEGORIES);
}

function categoryDoc(restaurantId: string, categoryId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_CATEGORIES, categoryId);
}

// ── Case-insensitive duplicate check ──────────
async function assertNameNotTaken(
  restaurantId: string,
  name: string,
  excludeCategoryId?: string
): Promise<void> {
  const snap = await getDocs(categoriesCollection(restaurantId));
  const normalized = name.trim().toLowerCase();
  const clash = snap.docs.find((d) => {
    if (excludeCategoryId && d.id === excludeCategoryId) return false;
    const data = d.data();
    return (data.name as string ?? "").trim().toLowerCase() === normalized;
  });
  if (clash) {
    throw new Error(`A category named "${name.trim()}" already exists`);
  }
}

// ── Create ──────────────────────────────────────
export async function createCategory(
  restaurantId: string,
  input: CreateCategoryInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!input.name.trim()) throw new Error("Category name is required");

  await assertNameNotTaken(restaurantId, input.name);

  const ref = await addDoc(categoriesCollection(restaurantId), {
    name:         input.name.trim(),
    color:        input.color ?? null,
    icon:         input.icon ?? null,
    restaurantId,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  });

  return ref.id;
}

// ── Update (rename / recolor / re-icon) ────────
export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error("Category name is required");
    await assertNameNotTaken(restaurantId, input.name, categoryId);
  }

  const updates: Record<string, unknown> = {
    ...(input.name  !== undefined && { name: input.name.trim() }),
    ...(input.color !== undefined && { color: input.color ?? null }),
    ...(input.icon  !== undefined && { icon: input.icon ?? null }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(categoryDoc(restaurantId, categoryId), updates);
}

// ── Delete ──────────────────────────────────────
// NOTE: does NOT check whether inventory items still reference
// this categoryId — that check belongs in the service layer once
// inventory-repository.ts is wired to use categoryId (Phase 8).
// Phase 8 should reject the delete with a clear error (e.g.
// "Cannot delete category — 12 inventory items still use it")
// rather than silently orphaning references.
export async function deleteCategory(
  restaurantId: string,
  categoryId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  await deleteDoc(categoryDoc(restaurantId, categoryId));
}

// ── Get all (one-time fetch) ────────────────────
export async function getAllCategories(
  restaurantId: string
): Promise<Category[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(
    query(categoriesCollection(restaurantId), orderBy("name", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, "id">) }));
}

// ── Subscribe (live) ────────────────────────────
export function subscribeCategories(
  restaurantId: string,
  callback: (categories: Category[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(categoriesCollection(restaurantId), orderBy("name", "asc")),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<Category, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}