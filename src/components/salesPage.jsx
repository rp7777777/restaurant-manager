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

export default function SalesPage({
currency,
}) {

const [
amount,
setAmount,
] = useState("")

const [
branch,
setBranch,
] = useState("Branch 1")

const [
shift,
setShift,
] = useState("Morning")

const [
sales,
setSales,
] = useState([])

useEffect(() => {


const unsubscribe =
  onSnapshot(

    collection(
      db,
      "sales"
    ),

    (
      snapshot
    ) => {

      const salesData =
        snapshot.docs.map(
          (
            item
          ) => ({

            id:
              item.id,

            ...item.data(),

          })
        )

      setSales(
        salesData
      )

    }

  )

return () =>
  unsubscribe()


}, [])

const addSale =
async () => {


  if (
    !amount
  ) return

  await addDoc(

    collection(
      db,
      "sales"
    ),

    {

      branch,

      shift,

      amount:
        Number(
          amount
        ),

      date:
        new Date()
        .toLocaleDateString(),

      createdAt:
        Date.now(),

    }

  )

  setAmount("")

}


const deleteSale =
async (
id
) => {


  await deleteDoc(

    doc(
      db,
      "sales",
      id
    )

  )

}


const totalSales =
sales.reduce(


  (
    total,
    sale
  ) =>

    total +
    Number(
      sale.amount
    ),

  0

)


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
      Sales Entry
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

      <select

        value={
          branch
        }

        onChange={(e) =>
          setBranch(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      >

        <option>
          Branch 1
        </option>

        <option>
          Branch 2
        </option>

        <option>
          Branch 3
        </option>

        <option>
          Branch 4
        </option>

        <option>
          Branch 5
        </option>

        <option>
          Branch 6
        </option>

        <option>
          Branch 7
        </option>

        <option>
          Branch 8
        </option>

        <option>
          Branch 9
        </option>

        <option>
          Branch 10
        </option>

      </select>

      <select

        value={
          shift
        }

        onChange={(e) =>
          setShift(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      >

        <option>
          Morning
        </option>

        <option>
          Day
        </option>

        <option>
          Night
        </option>

      </select>

      <input

        type="number"

        placeholder="Sale Amount"

        value={
          amount
        }

        onChange={(e) =>
          setAmount(
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
        addSale
      }

      style={{
        marginTop:
          "25px",

        background:
          "#22c55e",

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
      Add Sale
    </button>

  </div>

  <div
    style={{
      marginTop:
        "35px",
    }}
  >

    <div
      style={{
        background:
          "white",

        padding:
          "30px",

        borderRadius:
          "24px",

        boxShadow:
          "0 10px 30px rgba(0,0,0,0.08)",
      }}
    >

      <h2>
        Total Sales
      </h2>

      <h1
        style={{
          fontSize:
            "60px",

          color:
            "#22c55e",
        }}
      >
        {
          currency
        }
        {
          totalSales
        }
      </h1>

    </div>

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
      Sales Records
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

          <th
            style={
              tableHead
            }
          >
            Branch
          </th>

          <th
            style={
              tableHead
            }
          >
            Shift
          </th>

          <th
            style={
              tableHead
            }
          >
            Amount
          </th>

          <th
            style={
              tableHead
            }
          >
            Date
          </th>

          <th
            style={
              tableHead
            }
          >
            Action
          </th>

        </tr>

      </thead>

      <tbody>

        {
          sales.map(
            (
              sale
            ) => (

              <tr
                key={
                  sale.id
                }
              >

                <td
                  style={
                    tableData
                  }
                >
                  {
                    sale.branch
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >
                  {
                    sale.shift
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >
                  {
                    currency
                  }
                  {
                    sale.amount
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >
                  {
                    sale.date
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >

                  <button

                    onClick={() =>
                      deleteSale(
                        sale.id
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