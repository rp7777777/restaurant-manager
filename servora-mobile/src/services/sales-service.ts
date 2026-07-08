// ============================================
// SERVORA ERP — Sales Service
// Multi-tenant Firestore operations
// Single gateway for all sales data access
//
// TODO: Move dashboard aggregation to Cloud Functions
//       for stronger write-consistency guarantees.
// TODO: Split writeBatch into chunks of 500 if a
//       shift ever exceeds 500 entries in one day.
// NOTE: createSale()'s shift-entry-count check uses a
//       non-transactional query inside runTransaction —
//       Firestore transactions only track single-document
//       reads (transaction.get(docRef)), not queries. This
//       means two near-simultaneous creates on the same
//       shift could both pass the count check in a rare
//       race. Accepted as low-risk for this use case
//       (single POS terminal per shift in practice). A
//       fully atomic fix would require a separate per-shift
//       counter document tracked via transaction.get/.set.
// FROZEN
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query,
  where, orderBy, serverTimestamp,
  writeBatch, runTransaction,
  QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { COL, RCOL } from "../constants/firestore-collections";
import { logCreate, logEdit, logDelete } from "../app/security/audit-service";
import { updateDashboardStats } from "./dashboard-service";
import {
  SaleEntry, Shift,
  CreateSaleInput, UpdateSaleInput,
} from "../app/sales-module/types/sales-types";
import { MAX_ENTRIES_PER_SHIFT } from "../app/sales-module/utils/sale-validation";

function salesCollection(restaurantId: string) {
  return collection(db, COL.RESTAURANTS, restaurantId, RCOL.SALES);
}

function saleDoc(restaurantId: string, saleId: string) {
  return doc(db, COL.RESTAURANTS, restaurantId, RCOL.SALES, saleId);
}

function mapQueryDoc(d: QueryDocumentSnapshot<DocumentData>): SaleEntry {
  return { id: d.id, ...(d.data() as Omit<SaleEntry, "id">) };
}

function nextMonthStr(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

// ── Create — best-effort transaction: verifies lock + entry count before write.
//    See file header NOTE re: query-based reads inside transactions. ──
export async function createSale(
  restaurantId: string,
  input: CreateSaleInput
): Promise<string> {
  if (!restaurantId) throw new Error("Restaurant not configured");

  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const newRef = doc(salesCollection(restaurantId));

  await runTransaction(db, async (transaction) => {
    const q = query(
      salesCollection(restaurantId),
      where("date", "==", input.date),
      where("shift", "==", input.shift)
    );
    const existingSnap = await getDocs(q);
    const existingEntries = existingSnap.docs.map((d) => d.data() as Omit<SaleEntry, "id">);

    const shiftLocked = existingEntries.some((e) => e.locked);
    if (shiftLocked) {
      throw new Error(`${input.shift} shift is already locked.`);
    }

    if (existingEntries.length >= MAX_ENTRIES_PER_SHIFT) {
      throw new Error(`${input.shift} shift already has ${MAX_ENTRIES_PER_SHIFT} entries. Maximum reached.`);
    }

    const data = {
      ...input,
      entryName: input.entryName?.trim() ?? "",
      locked: false,
      userId: user.uid,
      restaurantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(newRef, data);
  });

  await updateDashboardStats(restaurantId, "sales", input.amount, "add");

  await logCreate("SALES", newRef.id, {
    date: input.date,
    shift: input.shift,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
  });

  return newRef.id;
}

// ── Update — runTransaction: read + locked-check + write happen atomically,
//    closing the race window between check and write ──
export async function updateSale(
  restaurantId: string,
  saleId: string,
  oldSale: SaleEntry,
  updates: UpdateSaleInput
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = saleDoc(restaurantId, saleId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Sale entry not found");

    const currentData = snap.data() as Omit<SaleEntry, "id">;
    if (currentData.locked) throw new Error("This entry is locked and cannot be edited");

    const cleanUpdates = {
      ...updates,
      ...(updates.entryName !== undefined && { entryName: updates.entryName.trim() }),
      updatedAt: serverTimestamp(),
    };

    transaction.update(ref, cleanUpdates);
  });

  if (updates.amount !== undefined && oldSale.amount !== undefined) {
    const diff = updates.amount - oldSale.amount;
    if (diff !== 0) {
      await updateDashboardStats(restaurantId, "sales", diff, "add");
    }
  }

  await logEdit(
    "SALES",
    saleId,
    oldSale as unknown as Record<string, unknown>,
    updates as unknown as Record<string, unknown>
  );
}

// ── Delete — runTransaction: read + locked-check + delete happen atomically ──
export async function deleteSale(
  restaurantId: string,
  saleId: string,
  saleData: SaleEntry
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const ref = saleDoc(restaurantId, saleId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Sale entry not found");

    const currentData = snap.data() as Omit<SaleEntry, "id">;
    if (currentData.locked) throw new Error("This entry is locked and cannot be deleted");

    transaction.delete(ref);
  });

  await updateDashboardStats(restaurantId, "sales", saleData.amount, "subtract");

  await logDelete("SALES", saleId, saleData as unknown as Record<string, unknown>);
}

export async function getSaleById(
  restaurantId: string,
  saleId: string
): Promise<SaleEntry | null> {
  const snap = await getDoc(saleDoc(restaurantId, saleId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SaleEntry, "id">) };
}

export function subscribeTodaySales(
  restaurantId: string,
  date: string,
  callback: (sales: SaleEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!restaurantId) {
    callback([]);
    return () => {};
  }

  const q = query(
    salesCollection(restaurantId),
    where("date", "==", date),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mapQueryDoc)),
    (err) => onError?.(err)
  );
}

export async function getSalesByDate(
  restaurantId: string,
  date: string
): Promise<SaleEntry[]> {
  if (!restaurantId) return [];

  const q = query(
    salesCollection(restaurantId),
    where("date", "==", date),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(mapQueryDoc);
}

export async function getSalesByMonth(
  restaurantId: string,
  monthStr: string
): Promise<SaleEntry[]> {
  if (!restaurantId) return [];

  const start = `${monthStr}-01`;
  const end = `${nextMonthStr(monthStr)}-01`;

  const q = query(
    salesCollection(restaurantId),
    where("date", ">=", start),
    where("date", "<", end),
    orderBy("date", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(mapQueryDoc);
}

export async function lockShift(
  restaurantId: string,
  date: string,
  shift: Shift
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const q = query(
    salesCollection(restaurantId),
    where("date", "==", date),
    where("shift", "==", shift),
    where("locked", "==", false)
  );

  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { locked: true, updatedAt: serverTimestamp() });
  });

  await batch.commit();

  await logEdit("SALES", `${date}-${shift}`, { locked: false }, { locked: true });
}

export async function unlockShift(
  restaurantId: string,
  date: string,
  shift: Shift
): Promise<void> {
  if (!restaurantId) throw new Error("Restaurant not configured");
  if (!auth.currentUser) throw new Error("User not authenticated");

  const q = query(
    salesCollection(restaurantId),
    where("date", "==", date),
    where("shift", "==", shift),
    where("locked", "==", true)
  );

  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { locked: false, updatedAt: serverTimestamp() });
  });

  await batch.commit();

  await logEdit("SALES", `${date}-${shift}`, { locked: true }, { locked: false });
}