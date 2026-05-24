import {
useState,
useEffect,
} from "react"

import {
doc,
setDoc,
getDoc,
} from "firebase/firestore"

import {
db,
} from "../firebase"

export default function SettingsPage() {

const [restaurantName, setRestaurantName] =
useState(
"SERVORA RESTAURANT"
)

const [currency, setCurrency] =
useState("€")

const [address, setAddress] =
useState(
"Rua Brito Capelo"
)

const [vatNumber, setVatNumber] =
useState(
"502552345"
)

const [managerName, setManagerName] =
useState(
"Manager"
)

const [logoUrl, setLogoUrl] =
useState("")

useEffect(() => {

loadSettings()

}, [])

const loadSettings = async () => {

const docRef =
  doc(
    db,
    "settings",
    "global"
  )

const docSnap =
  await getDoc(docRef)

if (docSnap.exists()) {

  const data =
    docSnap.data()

  setRestaurantName(
    data.restaurantName || ""
  )

  setCurrency(
    data.currency || "€"
  )

  setAddress(
    data.address || ""
  )

  setVatNumber(
    data.vatNumber || ""
  )

  setManagerName(
    data.managerName || ""
  )

  setLogoUrl(
    data.logoUrl || ""
  )

}

}

const saveSettings = async () => {

await setDoc(

  doc(
    db,
    "settings",
    "global"
  ),

  {

    restaurantName,

    currency,

    address,

    vatNumber,

    managerName,

    logoUrl,

  }

)

alert(
  "Settings Saved Successfully"
)

}

return (

<div
  style={{
    padding: "30px",
    background: "#f1f5f9",
    minHeight: "100vh",
  }}
>

  <div
    style={{
      background: "white",
      padding: "35px",
      borderRadius: "24px",
      boxShadow:
        "0 10px 30px rgba(0,0,0,0.08)",
      maxWidth: "900px",
    }}
  >

    <h1
      style={{
        fontSize: "42px",
        marginBottom: "10px",
      }}
    >
      System Settings
    </h1>

    <p
      style={{
        color: "#64748b",
        marginBottom: "30px",
      }}
    >
      Restaurant Global Configuration
    </p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(300px,1fr))",
        gap: "20px",
      }}
    >

      <div>

        <label style={labelStyle}>
          Restaurant Name
        </label>

        <input

          value={restaurantName}

          onChange={(e) =>
            setRestaurantName(
              e.target.value
            )
          }

          style={inputStyle}
        />

      </div>

      <div>

        <label style={labelStyle}>
          Currency
        </label>

        <select

          value={currency}

          onChange={(e) =>
            setCurrency(
              e.target.value
            )
          }

          style={inputStyle}
        >

          <option>
            €
          </option>

          <option>
            $
          </option>

          <option>
            NPR
          </option>

          <option>
            INR
          </option>

        </select>

      </div>

      <div>

        <label style={labelStyle}>
          Address
        </label>

        <input

          value={address}

          onChange={(e) =>
            setAddress(
              e.target.value
            )
          }

          style={inputStyle}
        />

      </div>

      <div>

        <label style={labelStyle}>
          VAT / TAX Number
        </label>

        <input

          value={vatNumber}

          onChange={(e) =>
            setVatNumber(
              e.target.value
            )
          }

          style={inputStyle}
        />

      </div>

      <div>

        <label style={labelStyle}>
          Manager Name
        </label>

        <input

          value={managerName}

          onChange={(e) =>
            setManagerName(
              e.target.value
            )
          }

          style={inputStyle}
        />

      </div>

      <div>

        <label style={labelStyle}>
          Logo URL
        </label>

        <input

          placeholder="https://"

          value={logoUrl}

          onChange={(e) =>
            setLogoUrl(
              e.target.value
            )
          }

          style={inputStyle}
        />

      </div>

    </div>

    {
      logoUrl && (

        <img

          src={logoUrl}

          alt="logo"

          style={{
            width: "120px",
            height: "120px",
            objectFit: "cover",
            borderRadius: "18px",
            marginTop: "30px",
            border:
              "1px solid #cbd5e1",
          }}
        />

      )
    }

    <button

      onClick={saveSettings}

      style={{
        marginTop: "35px",
        background: "#2563eb",
        color: "white",
        border: "none",
        padding: "16px 28px",
        borderRadius: "14px",
        fontSize: "17px",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      Save Settings
    </button>

  </div>

</div>

)

}

const labelStyle = {

display: "block",

marginBottom: "8px",

fontWeight: "bold",

color: "#334155",
}

const inputStyle = {

width: "100%",

padding: "15px",

borderRadius: "14px",

border:
"1px solid #cbd5e1",

fontSize: "16px",
}