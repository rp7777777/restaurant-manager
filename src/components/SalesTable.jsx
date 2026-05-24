import { useState } from "react"

import { gl, C } from "../styles/theme"

import { db } from "../firebase"

import {
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore"

export default function SalesTable({
  sales,
  setSales,
}) {
  const [editingId, setEditingId] =
    useState(null)

  const [editCustomer, setEditCustomer] =
    useState("")

  const [editAmount, setEditAmount] =
    useState("")

  // DELETE
  const deleteSale = async (id) => {
    try {
      await deleteDoc(
        doc(db, "sales", id)
      )

      setSales(
        sales.filter(
          (sale) => sale.id !== id
        )
      )
    } catch (error) {
      console.error(error)
    }
  }

  // SAVE EDIT
  const saveEdit = async (id) => {
    try {
      await updateDoc(
        doc(db, "sales", id),
        {
          customer: editCustomer,
          amount: editAmount,
        }
      )

      setSales(
        sales.map((sale) =>
          sale.id === id
            ? {
                ...sale,
                customer:
                  editCustomer,
                amount:
                  editAmount,
              }
            : sale
        )
      )

      setEditingId(null)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div style={gl.card}>
      <h2>📋 Sales Records</h2>

      {sales.length === 0 && (
        <p>No sales added</p>
      )}

      {sales.map((sale) => (
        <div
          key={sale.id}
          style={{
            display: "flex",
            justifyContent:
              "space-between",

            alignItems: "center",

            padding: "12px 0",

            borderBottom:
              `1px solid ${C.border}`,
          }}
        >
          <div>
            {editingId ===
            sale.id ? (
              <input
                value={
                  editCustomer
                }

                onChange={(e) =>
                  setEditCustomer(
                    e.target.value
                  )
                }

                style={gl.input}
              />
            ) : (
              <h4>
                {sale.customer}
              </h4>
            )}

            <small>
              {sale.date}
            </small>
          </div>

          <div
            style={{
              display: "flex",

              alignItems:
                "center",

              gap: "10px",
            }}
          >
            {editingId ===
            sale.id ? (
              <input
                type="number"

                value={
                  editAmount
                }

                onChange={(e) =>
                  setEditAmount(
                    e.target.value
                  )
                }

                style={{
                  ...gl.input,
                  width: "100px",
                }}
              />
            ) : (
              <strong
                style={{
                  color:
                    C.green,
                }}
              >
                €{sale.amount}
              </strong>
            )}

            {editingId ===
            sale.id ? (
              <button
                style={
                  gl.button
                }

                onClick={() =>
                  saveEdit(
                    sale.id
                  )
                }
              >
                Save
              </button>
            ) : (
              <button
                style={
                  gl.button
                }

                onClick={() => {
                  setEditingId(
                    sale.id
                  )

                  setEditCustomer(
                    sale.customer
                  )

                  setEditAmount(
                    sale.amount
                  )
                }}
              >
                Edit
              </button>
            )}

            <button
              style={{
                background:
                  C.red,

                color: "white",

                border: "none",

                padding:
                  "6px 10px",

                borderRadius:
                  "6px",

                cursor:
                  "pointer",
              }}

              onClick={() =>
                deleteSale(
                  sale.id
                )
              }
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}