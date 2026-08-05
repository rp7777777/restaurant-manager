// ============================================
// SERVORA ERP — Department Repository
// ✅ Single gateway for all department Firestore operations
// ✅ Duplicate-name prevention — case-insensitive check
// ✅ RCOL.DEPARTMENTS constant used — no hardcoded collection
//    string, consistent with every other repository in Servora
// ✅ isSystem — set only at creation time (never editable via
//    updateDepartment(), since UpdateDepartmentInput excludes it).
//    Default departments are created with isSystem: true, anything
//    the owner adds later defaults to isSystem: false.
// ✅ PHASE 2 (Enterprise restructuring) — deleteDepartment() delete
//    guard implemented (was previously deferred as a "FUTURE
//    Phase 8+" note — reclassified as a referential-integrity
//    requirement, mirroring the identical fix applied to
//    category-repository.ts's deleteCategory()):
//    1. isSystem departments can never be deleted (enforced here,
//       not just hidden in the UI).
//    2. A department still referenced by any Category
//       (departmentId match) cannot be deleted — prevents orphaned
//       departmentId references that would break the Category
//       screen, department filters, and report/PDF resolution.
// ✅ Direct Firestore query against the categories collection
//    (same collection path category-repository.ts uses) rather
//    than importing/calling into category-repository.ts —
//    repositories remain independent; only inventory-service.ts
//    orchestrates across repositories.
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
  Department,
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "../types/department";

function departmentsCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.DEPARTMENTS);
}

function departmentDoc(restaurantId: string, departmentId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.DEPARTMENTS, departmentId);
}

// ── Same collection path category-repository.ts writes to.
//    Kept local (not imported) so this repository stays independent —
//    see the FROZEN header note above. ──
function categoriesCollectionForGuard(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.INVENTORY_CATEGORIES);
}

async function assertNameNotTaken(
  restaurantId: string,
  name: string,
  excludeDepartmentId?: string
): Promise<void> {
  const snap = await getDocs(departmentsCollection(restaurantId));
  const normalized = name.trim().toLowerCase();
  const clash = snap.docs.find((d) => {
    if (excludeDepartmentId && d.id === excludeDepartmentId) return false;
    const data = d.data();
    return (data.name as string ?? "").trim().toLowerCase() === normalized;
  });
  if (clash) {
    throw new Error(`A department named "${name.trim()}" already exists`);
  }
}

// ── Create — isSystem defaults to false unless explicitly passed
//    true (used only by the default-seeding function). ──
export async function createDepartment(
  restaurantId: string,
  input: CreateDepartmentInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!input.name.trim()) throw new Error("Department name is required");

  await assertNameNotTaken(restaurantId, input.name);

  const ref = await addDoc(departmentsCollection(restaurantId), {
    name:         input.name.trim(),
    icon:         input.icon ?? null,
    color:        input.color ?? null,
    isSystem:     input.isSystem ?? false,
    restaurantId,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  });

  return ref.id;
}

// ── Update — isSystem can NEVER be changed here (UpdateDepartmentInput
//    excludes it at the type level, so it's not even possible to
//    pass it accidentally). ──
export async function updateDepartment(
  restaurantId: string,
  departmentId: string,
  input: UpdateDepartmentInput
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error("Department name is required");
    await assertNameNotTaken(restaurantId, input.name, departmentId);
  }

  const updates: Record<string, unknown> = {
    ...(input.name  !== undefined && { name: input.name.trim() }),
    ...(input.icon  !== undefined && { icon: input.icon ?? null }),
    ...(input.color !== undefined && { color: input.color ?? null }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(departmentDoc(restaurantId, departmentId), updates);
}

// ── Delete guard — referential integrity:
//    1. isSystem departments are never deletable.
//    2. Departments still referenced by at least one Category
//       (departmentId match) are blocked from deletion.
export async function deleteDepartment(
  restaurantId: string,
  departmentId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const snap = await getDoc(departmentDoc(restaurantId, departmentId));
  if (!snap.exists()) {
    throw new Error("Department not found");
  }
  const department = { id: snap.id, ...(snap.data() as Omit<Department, "id">) };

  if (department.isSystem) {
    throw new Error(
      `Cannot delete "${department.name}" — this is a default system department and cannot be removed.`
    );
  }

  const referencingCategories = await getDocs(
    query(
      categoriesCollectionForGuard(restaurantId),
      where("departmentId", "==", departmentId),
      limit(1)
    )
  );

  if (!referencingCategories.empty) {
    // Count is only needed for the error message — a second,
    // uncapped query is acceptable here since it only runs in the
    // (already-blocked) delete-attempt path, not on every render.
    const allReferencing = await getDocs(
      query(categoriesCollectionForGuard(restaurantId), where("departmentId", "==", departmentId))
    );
    throw new Error(
      `Cannot delete "${department.name}" — it is still used by ${allReferencing.size} categor${allReferencing.size === 1 ? "y" : "ies"}. Move those categories to another department first.`
    );
  }

  await deleteDoc(departmentDoc(restaurantId, departmentId));
}

export async function getAllDepartments(
  restaurantId: string
): Promise<Department[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(
    query(departmentsCollection(restaurantId), orderBy("name", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Department, "id">) }));
}

export function subscribeDepartments(
  restaurantId: string,
  callback: (departments: Department[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(departmentsCollection(restaurantId), orderBy("name", "asc")),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<Department, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}