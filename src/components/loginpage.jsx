import {
useState,
} from "react"

import {
signInWithEmailAndPassword,
} from "firebase/auth"

import {
auth,
} from "../firebase"

export default function LoginPage({

setIsLoggedIn,

}) {

const [email, setEmail] =
useState("")

const [password, setPassword] =
useState("")

const [loading, setLoading] =
useState(false)

const login = async () => {

if (
  !email ||
  !password
) return

try {

  setLoading(true)

  await signInWithEmailAndPassword(

    auth,

    email,

    password

  )

  setIsLoggedIn(true)

}

catch (error) {

  alert(
    error.message
  )

}

finally {

  setLoading(false)

}

}

return (

<div
  style={{
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0f172a",
  }}
>

  <div
    style={{
      width: "420px",
      background: "white",
      padding: "40px",
      borderRadius: "24px",
      boxShadow:
        "0 10px 40px rgba(0,0,0,0.2)",
    }}
  >

    <h1
      style={{
        fontSize: "42px",
        marginBottom: "10px",
      }}
    >
      SERVORA
    </h1>

    <p
      style={{
        color: "#64748b",
        marginBottom: "30px",
      }}
    >
      Restaurant ERP Login
    </p>

    <input

      type="email"

      placeholder="Email"

      value={email}

      onChange={(e) =>
        setEmail(
          e.target.value
        )
      }

      style={inputStyle}
    />

    <input

      type="password"

      placeholder="Password"

      value={password}

      onChange={(e) =>
        setPassword(
          e.target.value
        )
      }

      style={inputStyle}
    />

    <button

      onClick={login}

      style={{
        width: "100%",
        padding: "16px",
        background: "#2563eb",
        color: "white",
        border: "none",
        borderRadius: "14px",
        fontSize: "18px",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >

      {
        loading
          ? "Loading..."
          : "Login"
      }

    </button>

  </div>

</div>

)

}

const inputStyle = {

width: "100%",

padding: "16px",

marginBottom: "20px",

borderRadius: "14px",

border:
"1px solid #cbd5e1",

fontSize: "16px",
}