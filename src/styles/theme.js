export const C = {
  bg: "#0c0e0f",
  card: "#141618",
  surface: "#1a1d1f",
  border: "#252829",

  accent: "#c8a96e",
  accentDark: "#a8893e",

  red: "#e05555",
  green: "#4caf7d",
  blue: "#5b9bd5",
  orange: "#e07d3c",

  text: "#f0ede8",
  muted: "#7a7671",
  white: "#ffffff",
}

export const font = "'Georgia', 'Times New Roman', serif"

export const fontSans =
  "'Trebuchet MS', 'Segoe UI', sans-serif"

export const gl = {
  app: {
    fontFamily: fontSans,
    background: C.bg,
    minHeight: "100vh",
    color: C.text,
  },

  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: "14px",
    padding: "22px",
  },

  input: {
    width: "100%",
    padding: "10px 14px",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    color: C.text,
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    fontFamily: fontSans,
  },

  button: {
    padding: "10px 20px",
    background: C.accent,
    color: C.bg,
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  title: {
    fontFamily: font,
    color: C.accent,
    fontSize: "28px",
    fontWeight: "700",
  },

  subtitle: {
    color: C.muted,
    fontSize: "14px",
  },
}