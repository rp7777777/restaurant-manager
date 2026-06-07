import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../../firebase";

import {
  logCreate,
  logEdit,
  logDelete,
} from "../security/audit-service";

import {
  canEdit,
  canDelete,
  getNextEditCount,
  getNextDeleteCount,
} from "../utils/edit-delete";

const COLLECTION =
  "expenses";

export async function createExpense(
  expenseName: string,
  category: string,
  amount: number,
  note: string
) {

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      "User not logged in"
    );

  }

  const docRef =
    await addDoc(

      collection(
        db,
        COLLECTION
      ),

      {

        userId:
          user.uid,

        expenseName,

        category,

        amount,

        note,

        editCount: 0,

        deleteCount: 0,

        isDeleted: false,

        createdAt:
          Timestamp.now(),

        updatedAt:
          Timestamp.now(),

      }

    );

  await logCreate(

    "EXPENSES",

    docRef.id,

    {

      expenseName,

      category,

      amount,

    }

  );

  return docRef.id;

}

export async function getExpenses() {

  const user =
    auth.currentUser;

  if (!user)
    return [];

  const q =
    query(

      collection(
        db,
        COLLECTION
      ),

      where(
        "userId",
        "==",
        user.uid
      ),

      orderBy(
        "createdAt",
        "desc"
      )

    );

  const snapshot =
    await getDocs(q);

  const data:
    any[] = [];

  snapshot.forEach(
    (item) => {

      const expense =
        item.data();

      if (
        !expense.isDeleted
      ) {

        data.push({

          id:
            item.id,

          ...expense,

        });

      }

    }
  );

  return data;

}

export async function updateExpense(

  expenseId: string,

  oldExpense: any,

  expenseName: string,

  category: string,

  amount: number,

  note: string

) {

  if (

    !canEdit(
      oldExpense.editCount || 0
    )

  ) {

    throw new Error(
      "Maximum edit limit reached"
    );

  }

  const expenseRef =
    doc(
      db,
      COLLECTION,
      expenseId
    );

  const updatedData = {

    expenseName,

    category,

    amount,

    note,

    editCount:

      getNextEditCount(
        oldExpense.editCount || 0
      ),

    updatedAt:
      Timestamp.now(),

  };

  await updateDoc(

    expenseRef,

    updatedData

  );

  await logEdit(

    "EXPENSES",

    expenseId,

    oldExpense,

    updatedData

  );

}

export async function deleteExpense(

  expenseId: string,

  expenseData: any

) {

  if (

    !canDelete(
      expenseData.deleteCount || 0
    )

  ) {

    throw new Error(
      "Maximum delete limit reached"
    );

  }

  const expenseRef =
    doc(
      db,
      COLLECTION,
      expenseId
    );

  await updateDoc(

    expenseRef,

    {

      isDeleted:
        true,

      deleteCount:

        getNextDeleteCount(
          expenseData.deleteCount || 0
        ),

      updatedAt:
        Timestamp.now(),

    }

  );

  await logDelete(

    "EXPENSES",

    expenseId,

    expenseData

  );

}

export async function getTotalExpenses() {

  const expenses =
    await getExpenses();

  return expenses.reduce(

    (
      total,
      item
    ) =>

      total +
      Number(
        item.amount || 0
      ),

    0

  );

}

export async function getMonthlyExpenses() {

  const expenses =
    await getExpenses();

  const currentMonth =
    new Date().getMonth();

  const currentYear =
    new Date().getFullYear();

  const filtered =
    expenses.filter(
      (expense) => {

        if (
          !expense.createdAt
        )
          return false;

        const date =

          expense.createdAt
            ?.toDate
            ? expense.createdAt.toDate()
            : new Date(
                expense.createdAt
              );

        return (

          date.getMonth() ===
            currentMonth &&

          date.getFullYear() ===
            currentYear

        );

      }
    );

  return filtered;

}

export async function getMonthlyExpenseTotal() {

  const expenses =
    await getMonthlyExpenses();

  return expenses.reduce(

    (
      total,
      item
    ) =>

      total +
      Number(
        item.amount || 0
      ),

    0

  );

}