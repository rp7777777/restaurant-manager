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
  "inventory";

export async function createInventoryItem(
  itemName: string,
  category: string,
  quantity: number,
  unitCost: number
) {

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      "User not logged in"
    );

  }

  const totalValue =
    quantity *
    unitCost;

  const docRef =
    await addDoc(

      collection(
        db,
        COLLECTION
      ),

      {

        userId:
          user.uid,

        itemName,

        category,

        quantity,

        unitCost,

        totalValue,

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

    "INVENTORY",

    docRef.id,

    {

      itemName,

      quantity,

      totalValue,

    }

  );

  return docRef.id;

}

export async function getInventory() {

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

  const data: any[] =
    [];

  snapshot.forEach(
    (item) => {

      const inventory =
        item.data();

      if (
        !inventory.isDeleted
      ) {

        data.push({

          id:
            item.id,

          ...inventory,

        });

      }

    }
  );

  return data;

}

export async function updateInventoryItem(

  inventoryId: string,

  oldItem: any,

  itemName: string,

  category: string,

  quantity: number,

  unitCost: number

) {

  if (

    !canEdit(
      oldItem.editCount || 0
    )

  ) {

    throw new Error(
      "Maximum edit limit reached"
    );

  }

  const totalValue =
    quantity *
    unitCost;

  const inventoryRef =
    doc(
      db,
      COLLECTION,
      inventoryId
    );

  const updatedData = {

    itemName,

    category,

    quantity,

    unitCost,

    totalValue,

    editCount:

      getNextEditCount(
        oldItem.editCount || 0
      ),

    updatedAt:
      Timestamp.now(),

  };

  await updateDoc(

    inventoryRef,

    updatedData

  );

  await logEdit(

    "INVENTORY",

    inventoryId,

    oldItem,

    updatedData

  );

}

export async function deleteInventoryItem(

  inventoryId: string,

  inventoryData: any

) {

  if (

    !canDelete(
      inventoryData.deleteCount || 0
    )

  ) {

    throw new Error(
      "Maximum delete limit reached"
    );

  }

  const inventoryRef =
    doc(
      db,
      COLLECTION,
      inventoryId
    );

  await updateDoc(

    inventoryRef,

    {

      isDeleted:
        true,

      deleteCount:

        getNextDeleteCount(
          inventoryData.deleteCount || 0
        ),

      updatedAt:
        Timestamp.now(),

    }

  );

  await logDelete(

    "INVENTORY",

    inventoryId,

    inventoryData

  );

}

export async function getTotalInventoryValue() {

  const inventory =
    await getInventory();

  return inventory.reduce(

    (
      total,
      item
    ) =>

      total +
      Number(
        item.totalValue || 0
      ),

    0

  );

}

export async function getLowStockItems(
  limitQty = 10
) {

  const inventory =
    await getInventory();

  return inventory.filter(

    (item) =>

      Number(
        item.quantity || 0
      ) <= limitQty

  );

}