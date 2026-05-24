import {
LayoutDashboard,
DollarSign,
Receipt,
Users,
Boxes,
Settings,
} from "lucide-react"

export default function Sidebar({
page,
setPage,
}) {

const menu = [

{
  name:
    "dashboard",

  label:
    "Dashboard",

  icon:
    <LayoutDashboard />,
},

{
  name:
    "sales",

  label:
    "Sales",

  icon:
    <DollarSign />,
},

{
  name:
    "expenses",

  label:
    "Expenses",

  icon:
    <Receipt />,
},

{
  name:
    "inventory",

  label:
    "Inventory",

  icon:
    <Boxes />,
},

{
  name:
    "duty",

  label:
    "Duty Schedule",

  icon:
    <Users />,
},

{
  name:
    "settings",

  label:
    "Settings",

  icon:
    <Settings />,
},

]

return (

<div
  style={{
    width:
      "260px",

    minWidth:
      "260px",

    height:
      "100vh",

    background:
      "#020b2d",

    padding:
      "30px 20px",

    position:
      "sticky",

    top: 0,
  }}
>

  <h1
    style={{
      color:
        "#facc15",

      marginBottom:
        "60px",

      fontSize:
        "50px",
    }}
  >
    SERVORA
  </h1>

  {
    menu.map(
      (
        item
      ) => (

        <button

          key={
            item.name
          }

          onClick={() =>
            setPage(
              item.name
            )
          }

          style={{
            width:
              "100%",

            display:
              "flex",

            alignItems:
              "center",

            gap:
              "18px",

            padding:
              "20px",

            marginBottom:
              "18px",

            border:
              "none",

            borderRadius:
              "20px",

            cursor:
              "pointer",

            background:
              page === item.name
                ? "#facc15"
                : "transparent",

            color:
              page === item.name
                ? "black"
                : "white",

            fontSize:
              "18px",

            fontWeight:
              "600",

            transition:
              "0.3s",
          }}
        >

          {
            item.icon
          }

          {
            item.label
          }

        </button>

      )
    )
  }

</div>

)
}