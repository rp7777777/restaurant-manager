// ============================================
// SERVORA ERP — Supplier Repository
// ✅ Single gateway for all supplier Firestore operations
// ✅ No duplicate-name check by design (see types/supplier.ts note)
// ✅ EXTENDED (Phase 8.3) — supplierCode auto-generated at creation
//    via a TRANSACTION-SAFE counter document (same pattern as
//    PurchaseOrder.poNumber) — never client-supplied, never
//    editable after creation. Deliberately NOT snap.size + 1: that
//    approach breaks the moment any supplier is ever deleted (count
//    drops, so the next generated code collides with an existing
//    one) — a dedicated counter document that only ever increments
//    avoids that regardless of deletions.
//    companyName/taxId/country/currency/paymentTerms added as
//    OPTIONAL fields; status defaults to "ACTIVE" when omitted.
//    currency is uppercased (ISO codes like EUR/USD/GBP/NPR read
//    consistently); country is left as typed (uppercasing a country
//    NAME, unlike a currency CODE, makes it harder to read, e.g.
//    "PORTUGAL" vs "Portugal").
// ✅ FUTURE (Phase 8+, not built here): deleteSupplier() should
//    check whether any Purchase Order or Inventory item still
//    references this supplierId before deleting, similar to the
//    planned Category/Department reference checks.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query,
  orderBy, serverTimestamp, runTransaction,
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

// ── Counter doc for sequential supplierCode generation — reuses
//    the same "counters" doc under RCOL.STORE that poNumber's
//    counter lives in, keyed by its own field so the two counters
//    don't collide with each other. ──
function supplierCounterDoc(restaurantId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.STORE, "counters");
}

// ── Create ──────────────────────────────────────
// Generates the next sequential supplierCode (e.g. "SUP-0001") and
// creates the supplier in one transaction, so the counter can never
// be incremented without a matching supplier actually being
// created (and vice versa) — same guarantee as createPurchaseOrder.
export async function createSupplier(
  restaurantId: string,
  input: CreateSupplierInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");
  if (!input.name.trim()) throw new Error("Supplier name is required");

  const counterRef  = supplierCounterDoc(restaurantId);
  const newSupplierRef = doc(suppliersCollection(restaurantId));

  await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const lastNumber  = Number(counterSnap.data()?.supplierCode ?? 0);
    const nextNumber  = lastNumber + 1;
    const supplierCode = `SUP-${String(nextNumber).padStart(4, "0")}`;

    transaction.set(counterRef, { supplierCode: nextNumber }, { merge: true });

    transaction.set(newSupplierRef, {
      supplierCode,
      name:          input.name.trim(),
      companyName:   input.companyName?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      phone:         input.phone?.trim() || null,
      email:         input.email?.trim() || null,
      taxId:         input.taxId?.trim() || null,
      address:       input.address?.trim() || null,
      country:       input.country?.trim() || null,
      currency:      input.currency?.trim().toUpperCase() || null,
      paymentTerms:  input.paymentTerms?.trim() || null,
      status:        input.status ?? "ACTIVE",
      notes:         input.notes?.trim() || null,
      restaurantId,
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    });
  });

  return newSupplierRef.id;
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
    ...(input.companyName   !== undefined && { companyName: input.companyName?.trim() || null }),
    ...(input.contactPerson !== undefined && { contactPerson: input.contactPerson?.trim() || null }),
    ...(input.phone         !== undefined && { phone: input.phone?.trim() || null }),
    ...(input.email         !== undefined && { email: input.email?.trim() || null }),
    ...(input.taxId         !== undefined && { taxId: input.taxId?.trim() || null }),
    ...(input.address       !== undefined && { address: input.address?.trim() || null }),
    ...(input.country       !== undefined && { country: input.country?.trim() || null }),
    ...(input.currency      !== undefined && { currency: input.currency?.trim().toUpperCase() || null }),
    ...(input.paymentTerms  !== undefined && { paymentTerms: input.paymentTerms?.trim() || null }),
    ...(input.status        !== undefined && { status: input.status }),
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