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

export default function ExpensePage({
currency,
}) {

const [
expenseName,
setExpenseName,
] = useState("")

const [
amount,
setAmount,
] = useState("")

const [
category,
setCategory,
] = useState("Food")

const [
expenses,
setExpenses,
] = useState([])

useEffect(() => {


const unsubscribe =
  onSnapshot(

    collection(
      db,
      "expenses"
    ),

    (
      snapshot
    ) => {

      const expenseData =
        snapshot.docs.map(
          (
            item
          ) => ({

            id:
              item.id,

            ...item.data(),

          })
        )

      setExpenses(
        expenseData
      )

    }

  )

return () =>
  unsubscribe()


}, [])

const addExpense =
async () => {


  if (
    !expenseName ||
    !amount
  ) return

  await addDoc(

    collection(
      db,
      "expenses"
    ),

    {

      expenseName,

      category,

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

  setExpenseName("")
  setAmount("")

}


const deleteExpense =
async (
id
) => {


  await deleteDoc(

    doc(
      db,
      "expenses",
      id
    )

  )

}


const totalExpense =
expenses.reduce(


  (
    total,
    expense
  ) =>

    total +
    Number(
      expense.amount || 0
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
      Expense Entry
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

        placeholder="Expense Name"

        value={
          expenseName
        }

        onChange={(e) =>
          setExpenseName(
            e.target.value
          )
        }

        style={
          inputStyle
        }
      />

      <input

        type="number"

        placeholder="Expense Amount"

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
          Food
        </option>

        <option>
          Salary
        </option>

        <option>
          Electricity
        </option>

        <option>
          Transport
        </option>

        <option>
          Maintenance
        </option>

      </select>

    </div>

    <button

      onClick={
        addExpense
      }

      style={{
        marginTop:
          "25px",

        background:
          "#ef4444",

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
      Add Expense
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
        Total Expense
      </h2>

      <h1
        style={{
          fontSize:
            "60px",

          color:
            "#ef4444",
        }}
      >
        {
          totalExpense
        }
        {" "}
        {
          currency
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
      Expense Records
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
            Expense
          </th>

          <th
            style={
              tableHead
            }
          >
            Category
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
          expenses.map(
            (
              expense
            ) => (

              <tr
                key={
                  expense.id
                }
              >

                <td
                  style={
                    tableData
                  }
                >
                  {
                    expense.expenseName
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >
                  {
                    expense.category
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >
                  {
                    expense.amount
                  }
                  {" "}
                  {
                    currency
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >
                  {
                    expense.date
                  }
                </td>

                <td
                  style={
                    tableData
                  }
                >

                  <button

                    onClick={() =>
                      deleteExpense(
                        expense.id
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
