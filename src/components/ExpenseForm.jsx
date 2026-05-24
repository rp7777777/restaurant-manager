import { useState } from "react"

import { gl } from "../styles/theme"

import { db } from "../firebase"

import {
  collection,
  addDoc,
} from "firebase/firestore"

export default function ExpenseForm({
  expenses,
  setExpenses,
}) {
  const [amount, setAmount] =
    useState("")

  const [reason, setReason] =
    useState("")

  const addExpense = async () => {
    if (!amount || !reason) return

    const newExpense = {
      reason,
      amount,
      date:
        new Date().toLocaleDateString(),

      createdAt: Date.now(),
    }

    try {
      // FIREBASE SAVE
      const docRef = await addDoc(
        collection(db, "expenses"),
        newExpense
      )

      // UI UPDATE
      setExpenses([
        {
          id: docRef.id,
          ...newExpense,
        },
        ...expenses,
      ])

      setAmount("")
      setReason("")

      alert(
        "Expense added successfully!"
      )
    } catch (error) {
      console.error(error)

      alert(
        "Error saving expense"
      )
    }
  }

  return (
    <div style={gl.card}>
      <h2>📤 Add Expense</h2>

      <div style={{ marginTop: "15px" }}>
        <input
          style={gl.input}
          placeholder="Expense Reason"
          value={reason}
          onChange={(e) =>
            setReason(
              e.target.value
            )
          }
        />
      </div>

      <div style={{ marginTop: "15px" }}>
        <input
          style={gl.input}
          type="number"
          placeholder="Amount €"
          value={amount}
          onChange={(e) =>
            setAmount(
              e.target.value
            )
          }
        />
      </div>

      <button
        style={{
          ...gl.button,
          marginTop: "20px",
          width: "100%",
        }}
        onClick={addExpense}
      >
        Add Expense
      </button>
    </div>
  )
}