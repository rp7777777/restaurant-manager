import {
useEffect,
useState,
} from "react"

import {
collection,
addDoc,
onSnapshot,
deleteDoc,
doc,
} from "firebase/firestore"

import {
db,
} from "../firebase"

export default function InventoryPage({

currency,

}) {

const [
itemName,
setItemName,
] = useState("")

const [
category,
setCategory,
] = useState("Vegetable")

const [
openingStock,
setOpeningStock,
] = useState("")

const [
receivedStock,
setReceivedStock,
] = useState("")

const [
closingStock,
setClosingStock,
] = useState("")

const [
minimumLevel,
setMinimumLevel,
] = useState("5")

const [
price,
setPrice,
] = useState("")

const [
inventory,
setInventory,
] = useState([])

useEffect(() => {


const unsubscribe =
  onSnapshot(

    collection(
      db,
      "inventory"
    ),

    (
      snapshot
    ) => {

      const inventoryData =
        snapshot.docs.map(
          (
            item
          ) => ({

            id:
              item.id,

            ...item.data(),

          })
        )

      setInventory(
        inventoryData
      )

    }

  )

return () =>
  unsubscribe()


}, [])

const addInventory =
async () => {


  if (
    !itemName
  ) return

  const tomorrowOrder =

    Number(
      openingStock || 0
    )

    +

    Number(
      receivedStock || 0
    )

    -

    Number(
      closingStock || 0
    )

  await addDoc(

    collection(
      db,
      "inventory"
    ),

    {

      itemName,

      category,

      openingStock:
        Number(
          openingStock
        ),

      receivedStock:
        Number(
          receivedStock
        ),

      closingStock:
        Number(
          closingStock
        ),

      minimumLevel:
        Number(
          minimumLevel
        ),

      tomorrowOrder,

      price:
        Number(
          price
        ),

      createdAt:
        Date.now(),

      date:
        new Date()
        .toLocaleDateString(),

    }

  )

  setItemName("")
  setOpeningStock("")
  setReceivedStock("")
  setClosingStock("")
  setPrice("")

}


const deleteItem =
async (
id
) => {


  await deleteDoc(

    doc(
      db,
      "inventory",
      id
    )

  )

}


return (


<div
  style={{
    padding:
      "30px",
  }}
>

  <div
    style={{
      background:
        "white",

      padding:
        "35px",

      borderRadius:
        "28px",

      boxShadow:
        "0 10px 30px rgba(0,0,0,0.08)",
    }}
  >

    <h1
      style={{
        marginBottom:
          "30px",

        fontSize:
          "38px",
      }}
    >
      Inventory Entry
    </h1>

    <div
      style={{
        display:
          "grid",

        gridTemplateColumns:
          "repeat(auto-fit,minmax(250px,1fr))",

        gap:
          "20px",
      }}
    >

      <input

        placeholder="Ingredient Name"

        value={
          itemName
        }

        onChange={(e) =>
          setItemName(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      />

      <select

        value={
          category
        }

        onChange={(e) =>
          setCategory(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      >

        <option>
          Vegetable
        </option>

        <option>
          Meat
        </option>

        <option>
          Drinks
        </option>

        <option>
          Dairy
        </option>

        <option>
          Dry Food
        </option>

      </select>

      <input

        type="number"

        placeholder="Opening Stock"

        value={
          openingStock
        }

        onChange={(e) =>
          setOpeningStock(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      />

      <input

        type="number"

        placeholder="Received Stock"

        value={
          receivedStock
        }

        onChange={(e) =>
          setReceivedStock(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      />

      <input

        type="number"

        placeholder="Closing Stock"

        value={
          closingStock
        }

        onChange={(e) =>
          setClosingStock(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      />

      <input

        type="number"

        placeholder="Minimum Level"

        value={
          minimumLevel
        }

        onChange={(e) =>
          setMinimumLevel(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      />

      <input

        type="number"

        placeholder="Price"

        value={
          price
        }

        onChange={(e) =>
          setPrice(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      />

    </div>

    <button

      onClick={
        addInventory
      }

      style={{
        marginTop:
          "25px",

        background:
          "#2563eb",

        color:
          "white",

        border:
          "none",

        padding:
          "18px 35px",

        borderRadius:
          "18px",

        fontSize:
          "18px",

        cursor:
          "pointer",

        fontWeight:
          "bold",
      }}
    >
      Add Inventory
    </button>

  </div>

  <div
    style={{
      background:
        "white",

      marginTop:
        "35px",

      padding:
        "35px",

      borderRadius:
        "28px",

      boxShadow:
        "0 10px 30px rgba(0,0,0,0.08)",
    }}
  >

    <h1
      style={{
        marginBottom:
          "25px",
      }}
    >
      Inventory Records
    </h1>

    <table
      style={{
        width:
          "100%",

        borderCollapse:
          "collapse",
      }}
    >

      <thead>

        <tr
          style={{
            background:
              "#f8fafc",
          }}
        >

          <th style={tableHead}>
            Item
          </th>

          <th style={tableHead}>
            Closing
          </th>

          <th style={tableHead}>
            Tomorrow Order
          </th>

          <th style={tableHead}>
            Price
          </th>

          <th style={tableHead}>
            Action
          </th>

        </tr>

      </thead>

      <tbody>

        {
          inventory.map(
            (
              item
            ) => (

              <tr
                key={
                  item.id
                }
              >

                <td style={tableData}>
                  {
                    item.itemName
                  }
                </td>

                <td style={tableData}>
                  {
                    item.closingStock
                  }
                </td>

                <td style={tableData}>
                  {
                    item.tomorrowOrder
                  }
                </td>

                <td style={tableData}>
                  {
                    item.price
                  }
                  {" "}
                  {
                    currency
                  }
                </td>

                <td style={tableData}>

                  <button

                    onClick={() =>
                      deleteItem(
                        item.id
                      )
                    }

                    style={{
                      background:
                        "#ef4444",

                      color:
                        "white",

                      border:
                        "none",

                      padding:
                        "10px 16px",

                      borderRadius:
                        "12px",

                      cursor:
                        "pointer",
                    }}
                  >
                    Delete
                  </button>

                </td>

              </tr>

            )
          )
        }

      </tbody>

    </table>

  </div>

</div>


)

}

const inputStyle = {

width:
"100%",

padding:
"18px",

borderRadius:
"16px",

border:
"1px solid #cbd5e1",

fontSize:
"18px",
}

const tableHead = {

padding:
"18px",

textAlign:
"left",

fontSize:
"20px",
}

const tableData = {

padding:
"18px",

borderBottom:
"1px solid #e2e8f0",

fontSize:
"18px",
}
