import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../../firebase";

export async function getMonthlySales(
  month: string
) {
  const snapshot = await getDocs(
    collection(db, "sales")
  );

  const data = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return data.filter((item: any) =>
    item.date?.startsWith(month)
  );
}

export async function getMonthlyExpenses(
  month: string
) {
  const snapshot = await getDocs(
    collection(db, "expenses")
  );

  const data = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return data.filter((item: any) =>
    item.date?.startsWith(month)
  );
}

export async function getDashboardCounts() {
  const salesSnapshot = await getDocs(
    collection(db, "sales")
  );

  const expenseSnapshot = await getDocs(
    collection(db, "expenses")
  );

  return {
    salesCount: salesSnapshot.size,
    expenseCount: expenseSnapshot.size,
  };
}