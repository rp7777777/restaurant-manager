// ============================================
// SERVORA ERP — Inventory Category Repository
// ✅ Single gateway for all category Firestore operations
// ✅ Duplicate-name prevention — case-insensitive check
// ✅ RCOL.DEPARTMENTS constant used — no hardcoded collection string
// ✅ isSystem — set only at creation time (never editable)
// ✅ expiryAlertDays — validated: must be >= 0 (0 = disabled for
//    this category, falls through to Restaurant Default otherwise).
//    Negative values rejected outright.
// ✅ PHASE 2 (Enterprise restructuring) — deleteCategory() delete
//    guard implemented (was previously deferred as a "FUTURE
//    Phase 8+" note — reclassified as a referential-integrity
//    requirement, not a cosmetic feature, since this restructuring
//    IS the current Phase 8 work):
//    1. isSystem categories can never be deleted (enforced here,
//       not just hidden in the UI — repository is the last line of
//       defense even if a future caller bypasses the UI).
//    2. A category still referenced by any InventoryItem
//       (categoryId match) cannot be deleted — prevents orphaned
//       categoryId references that would break the category picker,
//       filters, and PDF/report category resolution.
// ✅ This query stays a direct Firestore query against the
//    inventory collection (same collection path the inventory
//    repository uses) rather than importing/calling into
//    inventory-repository.ts — repositories remain independent and
//    never call each other; only inventory-service.ts orchestrates
//    across repositories.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query,
  where, limit, orderBy, serverTimestamp,
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

// ── Same collection path inventory-repository.ts writes to.
//    Kept local (not imported) so this repository stays independent —
//    see the FROZEN header note above. ──
function inventoryCollectionForGuard(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY);
}

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

// ── Validation — expiryAlertDays must be >= 0 (0 = disabled) ──
function validateExpiryAlertDays(days: number | undefined): void {
  if (days === undefined) return;
  if (days < 0) {
    throw new Error("Expiry alert days cannot be negative");
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
  validateExpiryAlertDays(input.expiryAlertDays);

  await assertNameNotTaken(restaurantId, input.name);

  const ref = await addDoc(categoriesCollection(restaurantId), {
    name:            input.name.trim(),
    departmentId:    input.departmentId ?? null,
    color:           input.color ?? null,
    icon:            input.icon ?? null,
    isSystem:        input.isSystem ?? false,
    expiryAlertDays: input.expiryAlertDays ?? null,
    restaurantId,
    createdAt:       serverTimestamp(),
    updatedAt:       serverTimestamp(),
  });

  return ref.id;
}

// ── Update ──────────────────────────────────────
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
  validateExpiryAlertDays(input.expiryAlertDays);

  const updates: Record<string, unknown> = {
    ...(input.name            !== undefined && { name: input.name.trim() }),
    ...(input.departmentId    !== undefined && { departmentId: input.departmentId ?? null }),
    ...(input.color           !== undefined && { color: input.color ?? null }),
    ...(input.icon            !== undefined && { icon: input.icon ?? null }),
    ...(input.expiryAlertDays !== undefined && { expiryAlertDays: input.expiryAlertDays ?? null }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(categoryDoc(restaurantId, categoryId), updates);
}

// ── Delete ──────────────────────────────────────
// ✅ Delete guard — referential integrity:
//    1. isSystem categories are never deletable.
//    2. Categories still referenced by at least one InventoryItem
//       (categoryId match) are blocked from deletion.
export async function deleteCategory(
  restaurantId: string,
  categoryId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const snap = await getDoc(categoryDoc(restaurantId, categoryId));
  if (!snap.exists()) {
    throw new Error("Category not found");
  }
  const category = { id: snap.id, ...(snap.data() as Omit<Category, "id">) };

  if (category.isSystem) {
    throw new Error(
      `Cannot delete "${category.name}" — this is a default system category and cannot be removed.`
    );
  }

  const referencingItems = await getDocs(
    query(
      inventoryCollectionForGuard(restaurantId),
      where("categoryId", "==", categoryId),
      limit(1)
    )
  );

  if (!referencingItems.empty) {
    // Count is only needed for the error message — a second,
    // uncapped query is acceptable here since it only runs in the
    // (already-blocked) delete-attempt path, not on every render.
    const allReferencing = await getDocs(
      query(inventoryCollectionForGuard(restaurantId), where("categoryId", "==", categoryId))
    );
    throw new Error(
      `Cannot delete "${category.name}" — it is still used by ${allReferencing.size} inventory item(s). Move those items to another category first.`
    );
  }

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