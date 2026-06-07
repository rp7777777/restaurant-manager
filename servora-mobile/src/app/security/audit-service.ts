import {
  collection,
  addDoc,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../../firebase";

export async function saveAuditLog(
  moduleName: string,
  action: string,
  recordId: string,
  oldData: any = null,
  newData: any = null
) {

  const user =
    auth.currentUser;

  if (!user) return;

  try {

    await addDoc(

      collection(
        db,
        "auditLogs"
      ),

      {

        userId:
          user.uid,

        moduleName,

        action,

        recordId,

        oldData,

        newData,

        timestamp:
          new Date(),

      }

    );

  } catch (error) {

    console.log(
      "Audit Log Error:",
      error
    );

  }

}

export async function logCreate(
  moduleName: string,
  recordId: string,
  newData: any
) {

  await saveAuditLog(

    moduleName,

    "CREATE",

    recordId,

    null,

    newData

  );

}

export async function logEdit(
  moduleName: string,
  recordId: string,
  oldData: any,
  newData: any
) {

  await saveAuditLog(

    moduleName,

    "EDIT",

    recordId,

    oldData,

    newData

  );

}

export async function logDelete(
  moduleName: string,
  recordId: string,
  deletedData: any
) {

  await saveAuditLog(

    moduleName,

    "DELETE",

    recordId,

    deletedData,

    null

  );

}

export async function logLogin() {

  const user =
    auth.currentUser;

  if (!user) return;

  await addDoc(

    collection(
      db,
      "auditLogs"
    ),

    {

      userId:
        user.uid,

      moduleName:
        "AUTH",

      action:
        "LOGIN",

      recordId:
        user.uid,

      timestamp:
        new Date(),

    }

  );

}

export async function logLogout() {

  const user =
    auth.currentUser;

  if (!user) return;

  await addDoc(

    collection(
      db,
      "auditLogs"
    ),

    {

      userId:
        user.uid,

      moduleName:
        "AUTH",

      action:
        "LOGOUT",

      recordId:
        user.uid,

      timestamp:
        new Date(),

    }

  );

}