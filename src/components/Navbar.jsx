import {
Moon,
Sun,
} from "lucide-react"

export default function Navbar({
darkMode,
setDarkMode,
}) {

return (

<div
  style={{
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    marginBottom:
      "30px",
  }}
>

  <div>

    <h1
      style={{
        margin: 0,
      }}
    >
      SERVORA
    </h1>

    <p
      style={{
        color:
          "gray",
      }}
    >
      Luxury Restaurant ERP
    </p>

  </div>

  <button

    onClick={() =>
      setDarkMode(
        !darkMode
      )
    }

    style={{
      border:
        "none",

      background:
        darkMode
          ? "#1e293b"
          : "#facc15",

      width:
        "55px",

      height:
        "55px",

      borderRadius:
        "16px",

      cursor:
        "pointer",

      color:
        darkMode
          ? "white"
          : "black",
    }}
  >

    {
      darkMode
        ? <Sun />
        : <Moon />
    }

  </button>

</div>

)
}
