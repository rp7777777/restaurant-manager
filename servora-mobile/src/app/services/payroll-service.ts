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
  "payroll";

export async function createPayroll(

  employeeName: string,

  position: string,

  basicSalary: number,

  overtime: number,

  bonus: number,

  taxRate: number,

  deduction: number,

  month: string

) {

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      "User not logged in"
    );

  }

  const taxAmount =

    (basicSalary *
      taxRate) /
    100;

  const grossSalary =

    basicSalary +
    overtime +
    bonus;

  const netSalary =

    grossSalary -
    taxAmount -
    deduction;

  const docRef =
    await addDoc(

      collection(
        db,
        COLLECTION
      ),

      {

        userId:
          user.uid,

        employeeName,

        position,

        basicSalary,

        overtime,

        bonus,

        taxRate,

        deduction,

        grossSalary,

        netSalary,

        month,

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

    "PAYROLL",

    docRef.id,

    {

      employeeName,

      month,

      netSalary,

    }

  );

  return docRef.id;

}

export async function getPayroll() {

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

      const payroll =
        item.data();

      if (
        !payroll.isDeleted
      ) {

        data.push({

          id:
            item.id,

          ...payroll,

        });

      }

    }
  );

  return data;

}

export async function updatePayroll(

  payrollId: string,

  oldPayroll: any,

  employeeName: string,

  position: string,

  basicSalary: number,

  overtime: number,

  bonus: number,

  taxRate: number,

  deduction: number,

  month: string

) {

  if (

    !canEdit(
      oldPayroll.editCount || 0
    )

  ) {

    throw new Error(
      "Maximum edit limit reached"
    );

  }

  const taxAmount =

    (basicSalary *
      taxRate) /
    100;

  const grossSalary =

    basicSalary +
    overtime +
    bonus;

  const netSalary =

    grossSalary -
    taxAmount -
    deduction;

  const payrollRef =
    doc(
      db,
      COLLECTION,
      payrollId
    );

  const updatedData = {

    employeeName,

    position,

    basicSalary,

    overtime,

    bonus,

    taxRate,

    deduction,

    grossSalary,

    netSalary,

    month,

    editCount:

      getNextEditCount(
        oldPayroll.editCount || 0
      ),

    updatedAt:
      Timestamp.now(),

  };

  await updateDoc(

    payrollRef,

    updatedData

  );

  await logEdit(

    "PAYROLL",

    payrollId,

    oldPayroll,

    updatedData

  );

}

export async function deletePayroll(

  payrollId: string,

  payrollData: any

) {

  if (

    !canDelete(
      payrollData.deleteCount || 0
    )

  ) {

    throw new Error(
      "Maximum delete limit reached"
    );

  }

  const payrollRef =
    doc(
      db,
      COLLECTION,
      payrollId
    );

  await updateDoc(

    payrollRef,

    {

      isDeleted:
        true,

      deleteCount:

        getNextDeleteCount(
          payrollData.deleteCount || 0
        ),

      updatedAt:
        Timestamp.now(),

    }

  );

  await logDelete(

    "PAYROLL",

    payrollId,

    payrollData

  );

}

export async function getTotalPayroll() {

  const payroll =
    await getPayroll();

  return payroll.reduce(

    (
      total,
      item
    ) =>

      total +
      Number(
        item.netSalary || 0
      ),

    0

  );

}

export async function getMonthlyPayroll(
  month: string
) {

  const payroll =
    await getPayroll();

  return payroll.filter(

    (item) =>

      item.month ===
      month

  );

}