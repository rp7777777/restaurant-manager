import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase";

import {
  logCreate,
  logDelete,
  logEdit,
} from "../security/audit-service";

export interface SaleItem {
  id?: string;

  date: string;

  morningSale: number;

  afternoonSale: number;

  nightSale: number;

  totalSale: number;

  paymentMethod: string;

  note: string;

  createdAt?: any;
}

const SALES_COLLECTION = "sales";

export async function createSale(
  sale: SaleItem
) {

  const docRef =
    await addDoc(

      collection(
        db,
        SALES_COLLECTION
      ),

      {
        ...sale,
        createdAt:
          serverTimestamp(),
      }

    );

  await logCreate(
    "SALES",
    docRef.id,
    sale
  );

  return docRef.id;

}

export async function updateSale(
  saleId: string,
  oldSale: any,
  updatedSale: Partial<SaleItem>
) {

  const saleRef =
    doc(
      db,
      SALES_COLLECTION,
      saleId
    );

  await updateDoc(
    saleRef,
    updatedSale
  );

  await logEdit(
    "SALES",
    saleId,
    oldSale,
    updatedSale
  );

}

export async function deleteSale(
  saleId: string,
  saleData: any
) {

  await deleteDoc(

    doc(
      db,
      SALES_COLLECTION,
      saleId
    )

  );

  await logDelete(
    "SALES",
    saleId,
    saleData
  );

}

export async function getAllSales() {

  const q = query(

    collection(
      db,
      SALES_COLLECTION
    ),

    orderBy(
      "createdAt",
      "desc"
    )

  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    (docItem) => ({

      id:
        docItem.id,

      ...docItem.data(),

    })
  );

}

export async function getTodaySalesTotal() {

  const sales =
    await getAllSales();

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  let total = 0;

  sales.forEach(
    (sale: any) => {

      if (
        sale.date === today
      ) {

        total += Number(
          sale.totalSale || 0
        );

      }

    }
  );

  return total;

}

export async function getMonthlySalesTotal(
  month: number,
  year: number
) {

  const sales =
    await getAllSales();

  let total = 0;

  sales.forEach(
    (sale: any) => {

      if (
        !sale.date
      ) return;

      const date =
        new Date(
          sale.date
        );

      if (

        date.getMonth() ===
          month &&

        date.getFullYear() ===
          year

      ) {

        total += Number(
          sale.totalSale || 0
        );

      }

    }
  );

  return total;

}