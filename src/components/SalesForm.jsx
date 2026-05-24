import { useState } from "react"

import { gl } from "../styles/theme"

import { db } from "../firebase"

import {
  collection,
  addDoc,
} from "firebase/firestore"

export default function SalesForm({
  sales,
  setSales,
}) {
  const [amount, setAmount] =
    useState("")

  const [customer, setCustomer] =
    useState("")

  const addSale = async () => {
    if (!amount || !customer) return

    const newSale = {
      customer,
      amount,
      date:
        new Date().toLocaleDateString(),

      createdAt: Date.now(),
    }

    try {
      // FIREBASE SAVE
      const docRef = await addDoc(
        collection(db, "sales"),
        newSale
      )

      // LOCAL UI UPDATE
      setSales([
        {
          id: docRef.id,
          ...newSale,
        },
        ...sales,
      ])

      setAmount("")
      setCustomer("")

      alert(
        "Sale added successfully!"
      )
    } catch (error) {
      console.error(error)

      alert("Error saving sale")
    }
  }

  return (
    <div style={gl.card}>
      <h2>💶 Add Sale</h2>

      <div style={{ marginTop: "15px" }}>
        <input
          style={gl.input}
          placeholder="Customer Name"
          value={customer}
          onChange={(e) =>
            setCustomer(
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
        onClick={addSale}
      >
        Add Sale
      </button>
    </div>
  )
}