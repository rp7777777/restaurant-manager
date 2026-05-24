import {
Bell,
Search,
} from "lucide-react"

export default function Header() {

const today =
new Date()

const hour =
today.getHours()

let greeting =
"Good Evening"

if (hour < 12) {
greeting =
"Good Morning"
}

else if (
hour < 18
) {
greeting =
"Good Afternoon"
}

const currentTime =
today.toLocaleTimeString()

return (

<div
  style={{
    background:
      "white",

    padding:
      "20px",

    borderRadius:
      "20px",

    marginBottom:
      "25px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    boxShadow:
      "0 10px 25px rgba(0,0,0,0.08)",
  }}
>

  <div>

    <h1
      style={{
        margin: 0,
        fontSize:
          "30px",
      }}
    >
      {greeting},
      Chopstick &
      Spoon 👋
    </h1>

    <p
      style={{
        marginTop:
          "5px",

        color:
          "gray",
      }}
    >
      {
        today.toDateString()
      }

      {" • "}

      {currentTime}
    </p>

  </div>

  <div
    style={{
      display:
        "flex",

      alignItems:
        "center",

      gap:
        "20px",
    }}
  >

    <div
      style={{
        display:
          "flex",

        alignItems:
          "center",

        background:
          "#f1f5f9",

        padding:
          "10px 15px",

        borderRadius:
          "12px",
      }}
    >

      <Search
        size={18}
      />

      <input
        placeholder="Search..."

        style={{
          border:
            "none",

          outline:
            "none",

          background:
            "transparent",

          marginLeft:
            "10px",
        }}
      />

    </div>

    <Bell />

    <div
      style={{
        width:
          "45px",

        height:
          "45px",

        borderRadius:
          "50%",

        background:
          "#facc15",
      }}
    />

  </div>

</div>

)
}
