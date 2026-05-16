import { useState, useEffect, useRef } from "react"
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "firebase/auth"
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  updateDoc, query, orderBy, serverTimestamp, onSnapshot, where
} from "firebase/firestore"
import { auth, db } from "./firebase"

// ─── THEME ─────────────────────────────────────────────────────────────────
const C = {
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

const font = "'Georgia', 'Times New Roman', serif"
const fontSans = "'Trebuchet MS', 'Segoe UI', sans-serif"

const gl = {
  app: { fontFamily: fontSans, background: C.bg, minHeight: "100vh", color: C.text },
  nav: { background: C.card, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px", position: "sticky", top: 0, zIndex: 200 },
  navBrand: { fontFamily: font, fontSize: "20px", fontWeight: 700, color: C.accent, display: "flex", alignItems: "center", gap: "10px" },
  main: { padding: "28px", maxWidth: "1300px", margin: "0 auto" },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "22px" },
  input: { width: "100%", padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", color: C.text, fontSize: "14px", boxSizing: "border-box", outline: "none", fontFamily: fontSans },
  select: { width: "100%", padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", color: C.text, fontSize: "14px", boxSizing: "border-box", fontFamily: fontSans },
  btn: (bg = C.accent, color = C.bg) => ({ padding: "10px 22px", background: bg, color, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, fontFamily: fontSans, transition: "opacity 0.2s" }),
  btnSm: (bg = C.accent) => ({ padding: "5px 12px", background: bg, color: bg === C.surface ? C.text : C.bg, border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }),
  badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: color + "28", color, border: `1px solid ${color}44` }),
  label: { fontSize: "12px", color: C.muted, marginBottom: "5px", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" },
  h2: { fontFamily: font, fontSize: "22px", fontWeight: 700, color: C.accent, marginBottom: "20px" },
  th: { padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: `1px solid ${C.border}`, textAlign: "left" },
  td: { padding: "10px 14px", fontSize: "13px", borderBottom: `1px solid ${C.border}22` },
}

// ─── UTILS ─────────────────────────────────────────────────────────────────
const fmt = (n) => `€${Number(n || 0).toFixed(2)}`
const today = () => new Date().toISOString().split("T")[0]
const toDate = (ts) => ts?.toDate ? ts.toDate() : new Date(ts || Date.now())

// ─── LOGIN ─────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError("Por favor preencha todos os campos"); return }
    setLoading(true)
    try {
      const r = await signInWithEmailAndPassword(auth, email, password)
      onLogin(r.user)
    } catch { setError("Email ou password incorretos!") }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.bg} 0%, #1a1208 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.card, padding: "52px 44px", borderRadius: "20px", width: "380px", border: `1px solid ${C.border}`, boxShadow: `0 30px 80px rgba(0,0,0,0.6)` }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontFamily: font, fontSize: "15px", color: C.muted, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "8px" }}>Restaurant Management</div>
          <div style={{ fontFamily: font, fontSize: "28px", fontWeight: 700, color: C.accent }}>Chopstick & Spoon</div>
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>Porto, Portugal 🇵🇹</div>
        </div>
        {error && <div style={{ background: C.red + "22", border: `1px solid ${C.red}44`, borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", color: C.red, fontSize: "13px" }}>{error}</div>}
        <div style={{ marginBottom: "14px" }}>
          <label style={gl.label}>Email</label>
          <input style={gl.input} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="admin@chopstickspoon.com" />
        </div>
        <div style={{ marginBottom: "28px" }}>
          <label style={gl.label}>Password</label>
          <input style={gl.input} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••" />
        </div>
        <button style={{ ...gl.btn(), width: "100%", padding: "14px", fontSize: "15px" }} onClick={handleLogin} disabled={loading}>
          {loading ? "A entrar..." : "Entrar / Login"}
        </button>
      </div>
    </div>
  )
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ sales, expenses }) {
  const todaySales = sales.filter(s => s.date === today())
  const totalRevenue = todaySales.reduce((sum, s) => sum + (s.amount || 0), 0)
  const totalExpenses = expenses.filter(e => e.date === today()).reduce((sum, e) => sum + (e.amount || 0), 0)
  const profit = totalRevenue - totalExpenses

  const monthly = {}
  sales.forEach(s => {
    const m = s.date?.slice(0, 7) || ""
    if (m) monthly[m] = (monthly[m] || 0) + s.amount
  })
  const monthlyArr = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)

  const weekSales = {}
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  sales.filter(s => {
    const d = new Date(s.date)
    const now = new Date()
    return (now - d) / 86400000 <= 7
  }).forEach(s => {
    const day = days[new Date(s.date).getDay()]
    weekSales[day] = (weekSales[day] || 0) + s.amount
  })

  const maxBar = Math.max(...monthlyArr.map(m => m[1]), 1)

  return (
    <div>
      <div style={gl.h2}>📊 Dashboard</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Receita Hoje", value: fmt(totalRevenue), color: C.green, icon: "💶" },
          { label: "Despesas Hoje", value: fmt(totalExpenses), color: C.red, icon: "📤" },
          { label: "Lucro Hoje", value: fmt(profit), color: profit >= 0 ? C.green : C.red, icon: "📈" },
          { label: "Vendas Hoje", value: todaySales.length, color: C.accent, icon: "🧾" },
        ].map((s, i) => (
          <div key={i} style={{ ...gl.card, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: "26px", marginBottom: "8px" }}>{s.icon}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: s.color, fontFamily: font }}>{s.value}</div>
            <div style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div style={gl.card}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: C.accent, marginBottom: "16px" }}>📅 Vendas Mensais (últimos 6 meses)</div>
          {monthlyArr.length === 0 && <p style={{ color: C.muted, fontSize: "13px" }}>Sem dados ainda</p>}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "120px" }}>
            {monthlyArr.map(([month, val]) => (
              <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <div style={{ fontSize: "11px", color: C.accent }}>{fmt(val)}</div>
                <div style={{ width: "100%", background: C.accent, borderRadius: "4px 4px 0 0", height: `${(val / maxBar) * 90}px`, minHeight: "4px" }} />
                <div style={{ fontSize: "10px", color: C.muted }}>{month.slice(5)}/{month.slice(0, 4)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={gl.card}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: C.accent, marginBottom: "16px" }}>📊 Lucro/Perda</div>
          {[
            { label: "Total Receitas", val: sales.reduce((s, i) => s + i.amount, 0), color: C.green },
            { label: "Total Despesas", val: expenses.reduce((s, i) => s + i.amount, 0), color: C.red },
            { label: "Lucro Total", val: sales.reduce((s, i) => s + i.amount, 0) - expenses.reduce((s, i) => s + i.amount, 0), color: C.accent },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: "13px", color: C.muted }}>{r.label}</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: r.color }}>{fmt(r.val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── DAILY SALES ───────────────────────────────────────────────────────────
function SalesPage({ sales, setSales, expenses, setExpenses }) {
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const [type, setType] = useState("sale")
  const [date, setDate] = useState(today())
  const [loading, setLoading] = useState(false)
  const [filterDate, setFilterDate] = useState(today())

  const addEntry = async () => {
    if (!amount || !desc) return
    setLoading(true)
    const data = { amount: Number(amount), description: desc, date, type, createdAt: serverTimestamp() }
    const col = type === "sale" ? "sales" : "expenses"
    const ref = await addDoc(collection(db, col), data)
    const entry = { id: ref.id, ...data }
    if (type === "sale") setSales(p => [entry, ...p])
    else setExpenses(p => [entry, ...p])
    setAmount(""); setDesc("")
    setLoading(false)
  }

  const deleteEntry = async (id, type) => {
    await deleteDoc(doc(db, type === "sale" ? "sales" : "expenses", id))
    if (type === "sale") setSales(p => p.filter(i => i.id !== id))
    else setExpenses(p => p.filter(i => i.id !== id))
  }

  const filtered = [
    ...sales.filter(s => s.date === filterDate).map(s => ({ ...s, type: "sale" })),
    ...expenses.filter(e => e.date === filterDate).map(e => ({ ...e, type: "expense" }))
  ].sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt))

  const dayTotal = filtered.filter(f => f.type === "sale").reduce((s, i) => s + i.amount, 0)
  const dayExp = filtered.filter(f => f.type === "expense").reduce((s, i) => s + i.amount, 0)

  return (
    <div>
      <div style={gl.h2}>💶 Vendas & Despesas Diárias</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
        <div style={gl.card}>
          <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Adicionar Entrada</div>
          <div style={{ marginBottom: "12px" }}>
            <label style={gl.label}>Tipo / Type</label>
            <select style={gl.select} value={type} onChange={e => setType(e.target.value)}>
              <option value="sale">💶 Venda (Sale)</option>
              <option value="expense">📤 Despesa (Expense)</option>
            </select>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={gl.label}>Data / Date</label>
            <input style={gl.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={gl.label}>Valor (€) / Amount</label>
            <input style={gl.input} type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={gl.label}>Descrição / Description</label>
            <input style={gl.input} placeholder="ex: Almoço, Jantar, Ingredientes..." value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <button style={{ ...gl.btn(), width: "100%" }} onClick={addEntry} disabled={loading}>
            {loading ? "A guardar..." : "➕ Adicionar"}
          </button>
        </div>

        <div style={gl.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>Registos do Dia</div>
            <input style={{ ...gl.input, width: "160px" }} type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
            <div style={{ background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: "8px", padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: "11px", color: C.muted }}>Receitas</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: C.green }}>{fmt(dayTotal)}</div>
            </div>
            <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: "8px", padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: "11px", color: C.muted }}>Despesas</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: C.red }}>{fmt(dayExp)}</div>
            </div>
            <div style={{ background: C.accent + "18", border: `1px solid ${C.accent}44`, borderRadius: "8px", padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: "11px", color: C.muted }}>Lucro</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: C.accent }}>{fmt(dayTotal - dayExp)}</div>
            </div>
          </div>
          <div style={{ maxHeight: "340px", overflowY: "auto" }}>
            {filtered.length === 0 && <p style={{ color: C.muted, fontSize: "13px" }}>Sem registos para este dia</p>}
            {filtered.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{item.description}</div>
                  <span style={gl.badge(item.type === "sale" ? C.green : C.red)}>{item.type === "sale" ? "Venda" : "Despesa"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: item.type === "sale" ? C.green : C.red }}>
                    {item.type === "sale" ? "+" : "-"}{fmt(item.amount)}
                  </span>
                  <button style={gl.btnSm(C.red + "44")} onClick={() => deleteEntry(item.id, item.type)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DUTY SCHEDULE ─────────────────────────────────────────────────────────
function DutyPage({ workers, setWorkers }) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("Cozinheiro(a) 3ª")
  const [empNo, setEmpNo] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [schedules, setSchedules] = useState({})
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d.toISOString().split("T")[0]
  })
  const printRef = useRef()

  const roles = ["Cozinheiro(a) 3ª", "Cozinheiro(a) 2ª", "Empregado(a) Mesa", "Gerente", "Ajudante Cozinha", "Bar", "Limpeza"]
  const daysPT = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

  const getWeekDates = () => {
    return daysPT.map((_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
    })
  }

  const addWorker = async () => {
    if (!name || !empNo) return
    const data = { name, role, empNo, createdAt: serverTimestamp() }
    const ref = await addDoc(collection(db, "workers"), data)
    setWorkers(p => [...p, { id: ref.id, ...data }])
    setName(""); setEmpNo(""); setShowAdd(false)
  }

  const deleteWorker = async (id) => {
    if (!confirm("Remover trabalhador?")) return
    await deleteDoc(doc(db, "workers", id))
    setWorkers(p => p.filter(w => w.id !== id))
  }

  const updateSchedule = (wId, dayIdx, value) => {
    setSchedules(p => ({ ...p, [wId]: { ...(p[wId] || {}), [dayIdx]: value } }))
  }

  const getCell = (wId, dayIdx) => schedules[wId]?.[dayIdx] || ""

  const STATUS = { "DO": { bg: "#c8a96e", label: "DO" }, "DC": { bg: "#e05555", label: "DC" }, "": { bg: "transparent", label: "" } }

  const handlePrint = () => {
    const dates = getWeekDates()
    const printContent = `
      <html><head><title>Horário - Chopstick & Spoon</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
        h2 { font-size: 14px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 5px 8px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        .do { background: #c8a96e; font-weight: bold; }
        .dc { background: #e05555; color: white; font-weight: bold; }
        .info { margin-bottom: 10px; font-size: 10px; }
      </style></head><body>
      <div class="info">
        <strong>Firma:</strong> Chopstick and Spoon Restaurant Bar &nbsp;&nbsp;
        <strong>Semana de:</strong> ${weekStart}
      </div>
      <table>
        <tr>
          <th>Nº</th><th>Nome</th><th>Categoria</th>
          ${daysPT.map((d, i) => `<th>${d}<br/>${dates[i]}</th>`).join("")}
        </tr>
        ${workers.map(w => `
          <tr>
            <td>${w.empNo}</td>
            <td>${w.name}</td>
            <td>${w.role}</td>
            ${daysPT.map((_, i) => {
              const val = getCell(w.id, i)
              const cls = val === "DO" ? "do" : val === "DC" ? "dc" : ""
              return `<td class="${cls}">${val}</td>`
            }).join("")}
          </tr>
        `).join("")}
      </table>
      <br/>
      <table style="width:200px">
        <tr><td class="do">DO</td><td>Descanso Obrigatório</td></tr>
        <tr><td class="dc">DC</td><td>Descanso Complementar</td></tr>
      </table>
      </body></html>
    `
    const win = window.open("", "_blank")
    win.document.write(printContent)
    win.document.close()
    win.print()
  }

  const weekDates = getWeekDates()

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={gl.h2}>👥 Horário de Trabalho</div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input style={{ ...gl.input, width: "170px" }} type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
          <button style={gl.btn(C.blue)} onClick={() => setShowAdd(!showAdd)}>➕ Trabalhador</button>
          <button style={gl.btn(C.green)} onClick={handlePrint}>🖨️ Imprimir PDF</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ ...gl.card, marginBottom: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "12px", alignItems: "flex-end" }}>
          <div>
            <label style={gl.label}>Nº Empregado</label>
            <input style={gl.input} placeholder="23006" value={empNo} onChange={e => setEmpNo(e.target.value)} />
          </div>
          <div>
            <label style={gl.label}>Nome Completo</label>
            <input style={gl.input} placeholder="Nome..." value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={gl.label}>Categoria / Role</label>
            <select style={gl.select} value={role} onChange={e => setRole(e.target.value)}>
              {roles.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <button style={gl.btn()} onClick={addWorker}>Guardar</button>
        </div>
      )}

      <div style={{ ...gl.card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
          <thead>
            <tr>
              <th style={{ ...gl.th, width: "60px" }}>Nº</th>
              <th style={{ ...gl.th, width: "160px" }}>Nome</th>
              <th style={{ ...gl.th, width: "140px" }}>Categoria</th>
              {daysPT.map((d, i) => (
                <th key={d} style={{ ...gl.th, textAlign: "center" }}>
                  <div>{d}</div>
                  <div style={{ fontSize: "10px", fontWeight: 400, color: C.muted }}>{weekDates[i]}</div>
                </th>
              ))}
              <th style={gl.th}></th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr><td colSpan={11} style={{ ...gl.td, textAlign: "center", color: C.muted, padding: "30px" }}>
                Nenhum trabalhador adicionado
              </td></tr>
            )}
            {workers.map(w => (
              <tr key={w.id}>
                <td style={{ ...gl.td, fontWeight: 600, color: C.accent }}>{w.empNo}</td>
                <td style={{ ...gl.td, fontWeight: 600 }}>{w.name}</td>
                <td style={{ ...gl.td, fontSize: "12px", color: C.muted }}>{w.role}</td>
                {daysPT.map((_, i) => {
                  const val = getCell(w.id, i)
                  const isSpecial = val === "DO" || val === "DC"
                  return (
                    <td key={i} style={{ ...gl.td, textAlign: "center", padding: "4px" }}>
                      <select
                        value={val}
                        onChange={e => updateSchedule(w.id, i, e.target.value)}
                        style={{
                          background: val === "DO" ? C.accent : val === "DC" ? C.red : C.surface,
                          color: isSpecial ? C.bg : C.text,
                          border: "none", borderRadius: "4px", padding: "4px 6px", fontSize: "12px",
                          fontWeight: isSpecial ? 700 : 400, cursor: "pointer", width: "80px"
                        }}
                      >
                        <option value="">-- hora --</option>
                        <option value="DO">DO</option>
                        <option value="DC">DC</option>
                        <option value="11:00/20:30">11:00/20:30</option>
                        <option value="10:30/20:00">10:30/20:00</option>
                        <option value="12:00/21:30">12:00/21:30</option>
                        <option value="08:00/17:00">08:00/17:00</option>
                        <option value="09:00/18:00">09:00/18:00</option>
                        <option value="13:00/22:00">13:00/22:00</option>
                        <option value="14:00/23:00">14:00/23:00</option>
                      </select>
                    </td>
                  )
                })}
                <td style={gl.td}>
                  <button style={gl.btnSm(C.red + "44")} onClick={() => deleteWorker(w.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
          {[["DO", C.accent, "Descanso Obrigatório"], ["DC", C.red, "Descanso Complementar"]].map(([k, c, l]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
              <div style={{ background: c, color: C.bg, padding: "2px 8px", borderRadius: "4px", fontWeight: 700, fontSize: "11px" }}>{k}</div>
              <span style={{ color: C.muted }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── INVENTORY ─────────────────────────────────────────────────────────────
function InventoryPage({ inventory, setInventory }) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("kg")
  const [closing, setClosing] = useState("")
  const [minLevel, setMinLevel] = useState("")
  const [orderQty, setOrderQty] = useState("")
  const [responsible, setResponsible] = useState("RABI PAUDEL")
  const [reqDate, setReqDate] = useState(today())
  const [loading, setLoading] = useState(false)

  const units = ["kg", "lit.", "pac.", "pcs.", "BAG", "cx.", "un."]

  const addItem = async () => {
    if (!name) return
    setLoading(true)
    const data = {
      name: name.toUpperCase(), unit, closing: Number(closing) || 0,
      minLevel: Number(minLevel) || 0, orderQty: Number(orderQty) || 0,
      responsible, date: reqDate, reqDate, createdAt: serverTimestamp()
    }
    const ref = await addDoc(collection(db, "inventory"), data)
    setInventory(p => [...p, { id: ref.id, ...data }])
    setName(""); setClosing(""); setMinLevel(""); setOrderQty("")
    setLoading(false)
  }

  const updateField = async (id, field, value) => {
    await updateDoc(doc(db, "inventory", id), { [field]: isNaN(value) ? value : Number(value) })
    setInventory(p => p.map(i => i.id === id ? { ...i, [field]: isNaN(value) ? value : Number(value) } : i))
  }

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, "inventory", id))
    setInventory(p => p.filter(i => i.id !== id))
  }

  const handlePrint = () => {
    const printContent = `
      <html><head><title>Inventory - Chopstick & Spoon</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
        h2 { font-size: 13px; text-align: center; }
        .header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 5px 8px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        .low { color: red; font-weight: bold; }
        .ok { color: green; }
        .req { background: #fff3cd; }
      </style></head><body>
      <h2>CHOPSTICK AND SPOON RESTAURANT BAR &nbsp;&nbsp;&nbsp; SUSHI</h2>
      <h3 style="text-align:center">INGRIDANCE REQUEST PAPER</h3>
      <table style="width:300px;margin:0 auto 10px auto;border-collapse:collapse">
        <tr><th>RESPONIBLE REQUEST</th><th>DATE</th></tr>
        <tr><td style="text-align:center">${inventory[0]?.responsible || responsible}</td>
            <td style="text-align:center">${new Date(reqDate).toLocaleDateString("pt-PT")}</td></tr>
      </table>
      <table>
        <tr>
          <th>DATE</th><th>ITEMS NAME</th>
          <th style="color:red">CLOSING STOCK</th>
          <th style="color:green">MINIMUM LEVEL</th>
          <th>ORDER QUANTITY</th><th>UNIT</th>
          <th>REQUIRED DATE</th><th>REQUESTED BY</th>
        </tr>
        ${inventory.map(item => `
          <tr class="${item.orderQty > 0 ? 'req' : ''}">
            <td>${item.date || reqDate}</td>
            <td style="text-align:left;font-weight:bold">${item.name}</td>
            <td class="${item.closing <= item.minLevel ? 'low' : 'ok'}">${item.closing}</td>
            <td>${item.minLevel}</td>
            <td style="font-weight:bold">${item.orderQty}</td>
            <td>${item.unit}</td>
            <td>${item.reqDate || ""}</td>
            <td>${item.responsible || ""}</td>
          </tr>
        `).join("")}
      </table>
      </body></html>
    `
    const win = window.open("", "_blank")
    win.document.write(printContent)
    win.document.close()
    win.print()
  }

  const lowStock = inventory.filter(i => i.closing <= i.minLevel)

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={gl.h2}>📦 Inventário / Ingredientes</div>
        <button style={gl.btn(C.green)} onClick={handlePrint}>🖨️ Imprimir Ingridance Request</button>
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: "10px", padding: "12px 16px", marginBottom: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: C.red, marginBottom: "6px" }}>⚠️ Stock Baixo! ({lowStock.length} itens)</div>
          <div style={{ fontSize: "12px", color: C.muted }}>{lowStock.map(i => i.name).join(", ")}</div>
        </div>
      )}

      <div style={{ ...gl.card, marginBottom: "20px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "14px" }}>Adicionar Item</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr auto", gap: "10px", alignItems: "flex-end" }}>
          <div>
            <label style={gl.label}>Nome do Item</label>
            <input style={gl.input} placeholder="ex: SALMON" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={gl.label}>Unidade</label>
            <select style={gl.select} value={unit} onChange={e => setUnit(e.target.value)}>
              {units.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={gl.label}>Closing Stock</label>
            <input style={gl.input} type="number" step="0.5" placeholder="0" value={closing} onChange={e => setClosing(e.target.value)} />
          </div>
          <div>
            <label style={gl.label}>Min Level</label>
            <input style={gl.input} type="number" placeholder="0" value={minLevel} onChange={e => setMinLevel(e.target.value)} />
          </div>
          <div>
            <label style={gl.label}>Order Qty</label>
            <input style={gl.input} type="number" step="0.5" placeholder="0" value={orderQty} onChange={e => setOrderQty(e.target.value)} />
          </div>
          <div>
            <label style={gl.label}>Responsável</label>
            <input style={gl.input} placeholder="Nome..." value={responsible} onChange={e => setResponsible(e.target.value)} />
          </div>
          <button style={{ ...gl.btn(), marginTop: "0" }} onClick={addItem} disabled={loading}>➕</button>
        </div>
      </div>

      <div style={{ ...gl.card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
          <thead>
            <tr>
              {["Data", "Item Name", "Closing Stock", "Min Level", "Order Qty", "Unit", "Req. Date", "Requested By", ""].map(h => (
                <th key={h} style={gl.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inventory.length === 0 && (
              <tr><td colSpan={9} style={{ ...gl.td, textAlign: "center", color: C.muted, padding: "30px" }}>
                Nenhum item. Adicione ingredientes acima.
              </td></tr>
            )}
            {inventory.map(item => (
              <tr key={item.id} style={{ background: item.closing <= item.minLevel ? C.red + "0a" : "transparent" }}>
                <td style={gl.td}>{item.date}</td>
                <td style={{ ...gl.td, fontWeight: 600 }}>{item.name}</td>
                <td style={{ ...gl.td, textAlign: "center" }}>
                  <input
                    type="number" step="0.5" value={item.closing}
                    onChange={e => updateField(item.id, "closing", e.target.value)}
                    style={{ width: "60px", background: "transparent", border: "none", color: item.closing <= item.minLevel ? C.red : C.green, fontWeight: 700, textAlign: "center", fontSize: "13px" }}
                  />
                </td>
                <td style={{ ...gl.td, textAlign: "center", color: C.muted }}>{item.minLevel}</td>
                <td style={{ ...gl.td, textAlign: "center", fontWeight: 700, color: item.orderQty > 0 ? C.accent : C.muted }}>{item.orderQty}</td>
                <td style={{ ...gl.td, textAlign: "center", color: C.muted }}>{item.unit}</td>
                <td style={{ ...gl.td, fontSize: "12px" }}>{item.reqDate}</td>
                <td style={{ ...gl.td, fontSize: "12px", color: C.muted }}>{item.responsible}</td>
                <td style={gl.td}>
                  <button style={gl.btnSm(C.red + "44")} onClick={() => deleteItem(item.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── WORKERS MANAGEMENT ────────────────────────────────────────────────────
function WorkersPage({ workers, setWorkers }) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("Cozinheiro(a) 3ª")
  const [empNo, setEmpNo] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const roles = ["Cozinheiro(a) 3ª", "Cozinheiro(a) 2ª", "Empregado(a) Mesa", "Gerente", "Ajudante Cozinha", "Bar", "Limpeza"]

  const addWorker = async () => {
    if (!name || !empNo) return
    setLoading(true)
    const data = { name, role, empNo, phone, email, createdAt: serverTimestamp() }
    const ref = await addDoc(collection(db, "workers"), data)
    setWorkers(p => [...p, { id: ref.id, ...data }])
    setName(""); setEmpNo(""); setPhone(""); setEmail("")
    setLoading(false)
  }

  const deleteWorker = async (id) => {
    if (!confirm("Remover trabalhador?")) return
    await deleteDoc(doc(db, "workers", id))
    setWorkers(p => p.filter(w => w.id !== id))
  }

  return (
    <div>
      <div style={gl.h2}>👤 Gestão de Trabalhadores</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
        <div style={gl.card}>
          <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Adicionar Trabalhador</div>
          {[
            { label: "Nº Empregado", val: empNo, set: setEmpNo, ph: "23006" },
            { label: "Nome Completo", val: name, set: setName, ph: "Nome..." },
            { label: "Telefone", val: phone, set: setPhone, ph: "+351 9xx xxx xxx" },
            { label: "Email", val: email, set: setEmail, ph: "email@..." },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: "12px" }}>
              <label style={gl.label}>{f.label}</label>
              <input style={gl.input} placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
            </div>
          ))}
          <div style={{ marginBottom: "20px" }}>
            <label style={gl.label}>Categoria</label>
            <select style={gl.select} value={role} onChange={e => setRole(e.target.value)}>
              {roles.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <button style={{ ...gl.btn(), width: "100%" }} onClick={addWorker} disabled={loading}>
            {loading ? "A guardar..." : "➕ Adicionar"}
          </button>
        </div>

        <div style={gl.card}>
          <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Equipa ({workers.length} pessoas)</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Nº", "Nome", "Categoria", "Telefone", ""].map(h => <th key={h} style={gl.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 && (
                <tr><td colSpan={5} style={{ ...gl.td, textAlign: "center", color: C.muted, padding: "30px" }}>
                  Nenhum trabalhador adicionado
                </td></tr>
              )}
              {workers.map(w => (
                <tr key={w.id}>
                  <td style={{ ...gl.td, color: C.accent, fontWeight: 700 }}>{w.empNo}</td>
                  <td style={{ ...gl.td, fontWeight: 600 }}>{w.name}</td>
                  <td style={{ ...gl.td, fontSize: "12px" }}><span style={gl.badge(C.blue)}>{w.role}</span></td>
                  <td style={{ ...gl.td, fontSize: "12px", color: C.muted }}>{w.phone}</td>
                  <td style={gl.td}>
                    <button style={gl.btnSm(C.red + "44")} onClick={() => deleteWorker(w.id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "sales", label: "💶 Vendas" },
  { id: "duty", label: "📅 Horário" },
  { id: "inventory", label: "📦 Inventário" },
  { id: "workers", label: "👥 Equipa" },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState("dashboard")
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [inventory, setInventory] = useState([])
  const [workers, setWorkers] = useState([])

  useEffect(() => {
    if (!user) return
    const loads = [
      { col: "sales", set: setSales },
      { col: "expenses", set: setExpenses },
      { col: "inventory", set: setInventory },
      { col: "workers", set: setWorkers },
    ]
    const unsubs = loads.map(({ col, set }) => {
      const q = query(collection(db, col), orderBy("createdAt", "desc"))
      return onSnapshot(q, snap => set(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    })
    return () => unsubs.forEach(u => u())
  }, [user])

  const handleLogout = async () => { await signOut(auth); setUser(null) }

  if (!user) return <LoginPage onLogin={setUser} />

  return (
    <div style={gl.app}>
      <nav style={gl.nav}>
        <div style={gl.navBrand}>
          🍣 <span>Chopstick & Spoon</span>
          <span style={{ fontSize: "11px", color: C.muted, fontFamily: fontSans, fontWeight: 400 }}>Porto 🇵🇹</span>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: 600, fontFamily: fontSans,
              background: tab === t.id ? C.accent : "transparent",
              color: tab === t.id ? C.bg : C.muted, transition: "all 0.2s"
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: C.muted }}>
          <span>👤 {user.email}</span>
          <button style={{ ...gl.btn(C.surface, C.text), padding: "7px 14px", fontSize: "12px" }} onClick={handleLogout}>Sair</button>
        </div>
      </nav>
      <main style={gl.main}>
        {tab === "dashboard" && <Dashboard sales={sales} expenses={expenses} />}
        {tab === "sales" && <SalesPage sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} />}
        {tab === "duty" && <DutyPage workers={workers} setWorkers={setWorkers} />}
        {tab === "inventory" && <InventoryPage inventory={inventory} setInventory={setInventory} />}
        {tab === "workers" && <WorkersPage workers={workers} setWorkers={setWorkers} />}
      </main>
    </div>
  )
}