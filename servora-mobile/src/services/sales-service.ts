// ============================================
// SERVORA ERP — Sales Service
// Multi-tenant Firestore operations
// ============================================

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, where,
  serverTimestamp, Timestamp, getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { logCreate, logEdit, logDelete } from "../security/audit-service";
import { updateDashboardStats } from "./dashboard-service";

// ── Types ────────────────────────────────────
export interface SaleItem {
  id?: string;
  date: string;
  morningSale: number;
  afternoonSale: number;
  nightSale: number;
  totalSale: number;
  paymentMethod: string;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  userId?: string;
  restaurantId?: string;
}

// ── Helpers ──────────────────────────────────
function getRestaurantId(): string {
  return auth.currentUser?.uid ?? "";
}

function salesCollection(restaurantId: string) {
  return collection(db, "restaurants", restaurantId, "sales");
}

// ── Create ───────────────────────────────────
export async function createSale(sale: Omit<SaleItem, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  const data = {
    ...sale,
    userId: auth.currentUser!.uid,
    restaurantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(salesCollection(restaurantId), data);

  // Update aggregate stats
  await updateDashboardStats(restaurantId, "sales", sale.totalSale, "add");

  await logCreate("SALES", docRef.id, {
    date: sale.date,
    totalSale: sale.totalSale,
    paymentMethod: sale.paymentMethod,
  });

  return docRef.id;
}

// ── Update ───────────────────────────────────
export async function updateSale(
  saleId: string,
  oldSale: SaleItem,
  updatedFields: Partial<SaleItem>
): Promise<void> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  const saleRef = doc(db, "restaurants", restaurantId, "sales", saleId);

  await updateDoc(saleRef, {
    ...updatedFields,
    updatedAt: serverTimestamp(),
  });

  // Update stats if totalSale changed
  if (updatedFields.totalSale !== undefined && oldSale.totalSale !== undefined) {
    const diff = updatedFields.totalSale - oldSale.totalSale;
    await updateDashboardStats(restaurantId, "sales", diff, "add");
  }

  await logEdit("SALES", saleId, oldSale as unknown as Record<string, unknown>, updatedFields as unknown as Record<string, unknown>);
}

// ── Delete ───────────────────────────────────
export async function deleteSale(saleId: string, saleData: SaleItem): Promise<void> {
  const restaurantId = getRestaurantId();
  if (!restaurantId) throw new Error("Not authenticated");

  await deleteDoc(doc(db, "restaurants", restaurantId, "sales", saleId));

  // Subtract from stats
  await updateDashboardStats(restaurantId, "sales", saleData.totalSale, "subtract");

  await logDelete("SALES", saleId, saleData as unknown as Record<string, unknown>);
}

// ── Real-time listener ───────────────────────
export function subscribeSales(
  restaurantId: string,
  callback: (sales: SaleItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(salesCollection(restaurantId), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const sales: SaleItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SaleItem, "id">),
      }));
      callback(sales);
    },
    (err) => onError?.(err)
  );
}

// ── Today's sales listener ───────────────────
export function subscribeTodaySales(
  restaurantId: string,
  callback: (total: number) => void
): () => void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const q = query(
    salesCollection(restaurantId),
    where("createdAt", ">=", Timestamp.fromDate(today))
  );

  return onSnapshot(q, (snap) => {
    let total = 0;
    snap.forEach((d) => { total += Number(d.data().totalSale ?? 0); });
    callback(total);
  });
}
