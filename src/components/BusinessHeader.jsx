import React from "react"

export default function BusinessHeader() {
const settings =
JSON.parse(
localStorage.getItem(
"servora-settings"
)
) || {}

return (
<div
style={{
background: "white",
padding: "20px 0",
marginBottom: "30px",
borderBottom:
"2px solid #e5e7eb",
}}
>
<div
style={{
display: "flex",
alignItems: "flex-start",
gap: "25px",
flexWrap: "wrap",
}}
>
{settings.logo && (
<img
src={settings.logo}
alt="logo"
style={{
width: "120px",
height: "120px",
objectFit: "cover",
borderRadius: "20px",
border:
"3px solid #b58900",
background: "white",
padding: "6px",
}}
/>
)}

    <div>
      <h1
        style={{
          color: "#b58900",
          fontSize: "42px",
          margin: 0,
          textTransform:
            "capitalize",
          lineHeight: "50px",
        }}
      >
        {
          settings.restaurantName
        }
      </h1>

      <div
        style={{
          marginTop: "15px",
          color: "#4b5563",
          fontSize: "18px",
          lineHeight: "32px",
        }}
      >
        <div>
          📞 {
            settings.phone
          }
        </div>

        <div>
          📧 {
            settings.email
          }
        </div>

        <div>
          🧾 VAT:
          {" "}
          {settings.vat}
        </div>

        <div>
          📍 {
            settings.address
          }
        </div>
      </div>
    </div>
  </div>
</div>

)
}
