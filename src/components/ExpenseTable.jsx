import { useState } from "react"

import { gl, C } from "../styles/theme"

import { db } from "../firebase"

import {
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore"

export default function ExpenseTable({
  expenses,
  setExpenses,
}) {
  const [editingId, setEditingId] =
    useState(null)

  const [editReason, setEditReason] =
    useState("")

  const [editAmount, setEditAmount] =
    useState("")

  // DELETE
  const deleteExpense = async (
    id
  ) => {
    try {
      await deleteDoc(
        doc(db, "expenses", id)
      )

      setExpenses(
        expenses.filter(
          (expense) =>
            expense.id !== id
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
        doc(db, "expenses", id),
        {
          reason: editReason,
          amount: editAmount,
        }
      )

      setExpenses(
        expenses.map((expense) =>
          expense.id === id
            ? {
                ...expense,
                reason:
                  editReason,
                amount:
                  editAmount,
              }
            : expense
        )
      )

      setEditingId(null)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div style={gl.card}>
      <h2>📤 Expense Records</h2>

      {expenses.length === 0 && (
        <p>No expenses added</p>
      )}

      {expenses.map((expense) => (
        <div
          key={expense.id}
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
            expense.id ? (
              <input
                value={editReason}

                onChange={(e) =>
                  setEditReason(
                    e.target.value
                  )
                }

                style={gl.input}
              />
            ) : (
              <h4>
                {expense.reason}
              </h4>
            )}

            <small>
              {expense.date}
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
            expense.id ? (
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
                  color: C.red,
                }}
              >
                €{expense.amount}
              </strong>
            )}

            {editingId ===
            expense.id ? (
              <button
                style={
                  gl.button
                }

                onClick={() =>
                  saveEdit(
                    expense.id
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
                    expense.id
                  )

                  setEditReason(
                    expense.reason
                  )

                  setEditAmount(
                    expense.amount
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
                deleteExpense(
                  expense.id
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