import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const today = () => new Date().toISOString().split("T")[0];

export default function Sales({ sales, setSales }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const add = async () => {
    const ref = await addDoc(collection(db, "sales"), {
      amount: Number(amount),
      desc,
      date: today(),
      createdAt: serverTimestamp(),
    });

    setSales((p) => [{ id: ref.id, amount: Number(amount), desc }, ...p]);
    setAmount("");
    setDesc("");
  };

  return (
    <div>
      <h2>Sales</h2>

      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="amount" />
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="desc" />
      <button onClick={add}>Add</button>

      {sales.map((s) => (
        <div key={s.id}>{s.desc} - {s.amount}</div>
      ))}
    </div>
  );
}