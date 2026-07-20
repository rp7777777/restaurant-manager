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
// ✅ FUTURE (Phase 8+, not built here): deleteDepartment() should
//    check whether any Category still references this
//    departmentId and either reject the delete or offer to
//    reassign those categories to another department first.
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

// ── Delete — see FUTURE note in file header re: checking Category
//    references before deleting (not implemented yet). ──
export async function deleteDepartment(
  restaurantId: string,
  departmentId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
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