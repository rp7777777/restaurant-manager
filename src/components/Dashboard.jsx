import { useEffect, useState } from "react"
import { ShoppingCart, Users, AlertTriangle } from "lucide-react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../firebase"

export default function Dashboard({ currency }) {

const [sales, setSales] = useState([])

useEffect(() => {

const unsubscribe = onSnapshot(
  collection(db, "sales"),
  (snapshot) => {

    const salesData = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setSales(salesData)

  }
)

return () => unsubscribe()


}, [])

const totalSales = sales.reduce(
(total, sale) => total + Number(sale.amount || 0),
0
)

return (
<div
style={{
padding: "30px",
}}
>


  <h1
    style={{
      fontSize: "42px",
      marginBottom: "30px",
    }}
  >
    Dashboard
  </h1>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
      gap: "25px",
    }}
  >

    <div style={cardStyle}>

      <div>

        <h3 style={titleStyle}>
          Total Sales
        </h3>

        <h1
          style={{
            fontSize: "50px",
            color: "#22c55e",
            marginTop: "10px",
          }}
        >
          {totalSales} {currency}
        </h1>

      </div>

      <div style={greenBox}>
        S
      </div>

    </div>

    <div style={cardStyle}>

      <div>

        <h3 style={titleStyle}>
          Orders
        </h3>

        <h1
          style={{
            fontSize: "50px",
            marginTop: "10px",
          }}
        >
          {sales.length}
        </h1>

      </div>

      <div style={blueBox}>
        <ShoppingCart size={40} color="white" />
      </div>

    </div>

    <div style={cardStyle}>

      <div>

        <h3 style={titleStyle}>
          Staff
        </h3>

        <h1
          style={{
            fontSize: "50px",
            marginTop: "10px",
          }}
        >
          24
        </h1>

      </div>

      <div style={orangeBox}>
        <Users size={40} color="white" />
      </div>

    </div>

    <div style={cardStyle}>

      <div>

        <h3 style={titleStyle}>
          Low Stock
        </h3>

        <h1
          style={{
            fontSize: "50px",
            marginTop: "10px",
          }}
        >
          7
        </h1>

      </div>

      <div style={redBox}>
        <AlertTriangle size={40} color="white" />
      </div>

    </div>

  </div>

</div>


)

}

const cardStyle = {
background: "white",
padding: "30px",
borderRadius: "25px",
display: "flex",
justifyContent: "space-between",
alignItems: "center",
boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const titleStyle = {
fontSize: "22px",
color: "#64748b",
}

const greenBox = {
width: "90px",
height: "90px",
borderRadius: "20px",
background: "#22c55e",
color: "white",
display: "flex",
justifyContent: "center",
alignItems: "center",
fontSize: "42px",
fontWeight: "bold",
}

const blueBox = {
width: "90px",
height: "90px",
borderRadius: "20px",
background: "#3b82f6",
display: "flex",
justifyContent: "center",
alignItems: "center",
}

const orangeBox = {
width: "90px",
height: "90px",
borderRadius: "20px",
background: "#f59e0b",
display: "flex",
justifyContent: "center",
alignItems: "center",
}

const redBox = {
width: "90px",
height: "90px",
borderRadius: "20px",
background: "#ef4444",
display: "flex",
justifyContent: "center",
alignItems: "center",
}
