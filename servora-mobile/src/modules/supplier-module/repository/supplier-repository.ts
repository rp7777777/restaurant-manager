// ============================================
// SERVORA ERP — Supplier Repository
// ✅ Single gateway for all supplier Firestore operations
// ✅ No duplicate-name check by design (see types/supplier.ts note)
// ✅ FUTURE (Phase 8+, not built here): deleteSupplier() should
//    check whether any Purchase Order or Inventory item still
//    references this supplierId before deleting, similar to the
//    planned Category/Department reference checks.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { COL, RCOL } from "../../../constants/firestore-collections";
import {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
} from "../types/supplier";

function suppliersCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.SUPPLIERS);
}

function supplierDoc(restaurantId: string, supplierId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.SUPPLIERS, supplierId);
}

// ── Create ──────────────────────────────────────
export async function createSupplier(
  restaurantId: string,
  input: CreateSupplierInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!input.name.trim()) throw new Error("Supplier name is required");

  const ref = await addDoc(suppliersCollection(restaurantId), {
    name:          input.name.trim(),
    contactPerson: input.contactPerson?.trim() || null,
    phone:         input.phone?.trim() || null,
    email:         input.email?.trim() || null,
    address:       input.address?.trim() || null,
    notes:         input.notes?.trim() || null,
    restaurantId,
    createdAt:     serverTimestamp(),
    updatedAt:     serverTimestamp(),
  });

  return ref.id;
}

// ── Update ──────────────────────────────────────
export async function updateSupplier(
  restaurantId: string,
  supplierId: string,
  input: UpdateSupplierInput
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("Supplier name is required");
  }

  const updates: Record<string, unknown> = {
    ...(input.name          !== undefined && { name: input.name.trim() }),
    ...(input.contactPerson !== undefined && { contactPerson: input.contactPerson?.trim() || null }),
    ...(input.phone         !== undefined && { phone: input.phone?.trim() || null }),
    ...(input.email         !== undefined && { email: input.email?.trim() || null }),
    ...(input.address       !== undefined && { address: input.address?.trim() || null }),
    ...(input.notes         !== undefined && { notes: input.notes?.trim() || null }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(supplierDoc(restaurantId, supplierId), updates);
}

// ── Delete — see FUTURE note in file header re: checking Purchase
//    Order / Inventory references before deleting. ──
export async function deleteSupplier(
  restaurantId: string,
  supplierId: string
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  await deleteDoc(supplierDoc(restaurantId, supplierId));
}

// ── Get single supplier ─────────────────────────
export async function getSupplierById(
  restaurantId: string,
  supplierId: string
): Promise<Supplier | null> {
  const snap = await getDoc(supplierDoc(restaurantId, supplierId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Supplier, "id">) };
}

// ── Get all (one-time fetch) ────────────────────
export async function getAllSuppliers(
  restaurantId: string
): Promise<Supplier[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(
    query(suppliersCollection(restaurantId), orderBy("name", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, "id">) }));
}

// ── Subscribe (live) ────────────────────────────
export function subscribeSuppliers(
  restaurantId: string,
  callback: (suppliers: Supplier[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    query(suppliersCollection(restaurantId), orderBy("name", "asc")),
    (snap) => {
      callback(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<Supplier, "id">),
      })));
    },
    (err) => onError?.(err)
  );
}