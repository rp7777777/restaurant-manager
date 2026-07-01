// ============================================
// SERVORA ERP — Translation Types
// ✅ Single source of truth for all keys
// ✅ TypeScript enforced — no missing keys
// ✅ LANGUAGE_CODES — derived type
// ✅ Translation = Readonly — no mutation
// FROZEN
// ============================================

export interface TranslationKeys {
  // ── App ──────────────────────────────────
  appName:            string;
  appSubtitle:        string;

  // ── Navigation ───────────────────────────
  dashboard:          string;
  salesEntry:         string;
  salesList:          string;
  expenses:           string;
  inventory:          string;
  billing:            string;
  kitchen:            string;
  reports:            string;
  payroll:            string;
  employees:          string;
  suppliers:          string;
  customers:          string;
  purchaseOrders:     string;
  settings:           string;
  users:              string;
  auditLog:           string;
  backup:             string;
  store:              string;
  schedule:           string;
  attendance:         string;
  labourCost:         string;
  reservations:       string;
  delivery:           string;
  restaurants:        string;
  branches:           string;
  analytics:          string;
  pos:                string;
  
  // ── Sales Entry ───────────────────────────
  dailySales:          string;
  history:             string;
  editSale:            string;
  newEntry:            string;
  shift:               string;
  amount:              string;
  noteOptional:        string;
  updateSale:          string;
  saveSale:            string;
  cancelEdit:          string;
  todaysTotal:         string;
  fullHistory:         string;
  todaysEntries:       string;
  noSalesToday:        string;
  selectShift:         string;
  lockShift:           string;
  locked:              string;
  lock:                string;
  addNote:             string;
  paymentMethod:       string;
  // ── Auth ─────────────────────────────────
  login:              string;
  logout:             string;
  register:           string;
  email:              string;
  password:           string;
  forgotPassword:     string;
  createAccount:      string;
  loginToContinue:    string;
  welcomeBack:        string;
  openApp:            string;

  // ── Theme / Language ──────────────────────
  theme:              string;
  language:           string;

  // ── Dashboard ────────────────────────────
  dashboardOverview:     string;
  downloadReport:        string;
  loadingDashboard:      string;
  salesExpensesOverview: string;
  monthly:               string;
  yearly:                string;
  sales:                 string;
  noDataFor:             string;
  todaysAlerts:          string;
  recentActivities:      string;
  viewAll:               string;
  quickActions:          string;

  // ── KPI ──────────────────────────────────
  totalSales:         string;
  totalExpenses:      string;
  netProfit:          string;
  profitMargin:       string;
  todaySales:         string;
  thisYear:           string;
  labourCostPct:      string;
  ofTotalSales:       string;
  staffPresent:       string;
  absent:             string;
  allPresent:         string;

  // ── Monthly Summary ───────────────────────
  monthlySummary:     string;
  month:              string;
  actions:            string;
  totalThisYear:      string;

  // ── Daily Details ─────────────────────────
  dailyDetails:       string;
  report:             string;
  date:               string;
  total:              string;

  // ── General ──────────────────────────────
  management:         string;
  operations:         string;
  finance:            string;
  system:             string;
  main:               string;
  profitLoss:         string;
  monthlyReport:      string;
  executiveDashboard: string;
}

// ✅ LANGUAGE_CODES — single source of truth
export const LANGUAGE_CODES = [
  "en", "ne", "pt", "es",
  "fr", "ar", "zh", "hi",
  "de", "it", "no", "da",
  "ja", "ko",
] as const;

// ✅ Derived type — no duplication
export type LanguageCode = typeof LANGUAGE_CODES[number];

// ✅ Readonly — no accidental mutation
export type Translation = Readonly<TranslationKeys>;