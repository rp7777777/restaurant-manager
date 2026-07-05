// ============================================
// SERVORA ERP — Hindi Translations (hi)
// ============================================

import { Translation } from "../translation-types";

const hi: Translation = {
  // ── App ──────────────────────────────────
  appName:            "सर्वोरा ERP",
  appSubtitle:        "रेस्तरां प्रबंधन प्रणाली",

  // ── Navigation ───────────────────────────
  dashboard:          "डैशबोर्ड",
  salesEntry:         "बिक्री प्रविष्टि",
  salesList:          "बिक्री सूची",
  expenses:           "खर्च",
  inventory:          "सूची",
  billing:            "बिलिंग",
  kitchen:            "रसोई",
  reports:            "रिपोर्ट",
  payroll:            "वेतन",
  employees:          "कर्मचारी",
  suppliers:          "आपूर्तिकर्ता",
  customers:          "ग्राहक",
  purchaseOrders:     "खरीद आदेश",
  settings:           "सेटिंग्स",
  users:              "उपयोगकर्ता",
  auditLog:           "ऑडिट लॉग",
  backup:             "बैकअप",
  store:              "स्टोर",
  schedule:           "अनुसूची",
  attendance:         "उपस्थिति",
  labourCost:         "श्रम लागत",
  reservations:       "आरक्षण",
  delivery:           "डिलीवरी",
  restaurants:        "रेस्तरां",
  branches:           "शाखाएं",
  analytics:          "विश्लेषण",
  pos:                "POS प्रणाली",

  // ── Auth ─────────────────────────────────
  login:              "लॉग इन",
  logout:             "लॉग आउट",
  register:           "पंजीकरण",
  email:              "ईमेल",
  password:           "पासवर्ड",
  forgotPassword:     "पासवर्ड भूल गए?",
  createAccount:      "नया खाता बनाएं",
  loginToContinue:    "जारी रखने के लिए लॉगिन करें",
  welcomeBack:        "वापस स्वागत है",
  openApp:            "ऐप खोलें",

  // ── Theme / Language ──────────────────────
  theme:              "थीम",
  language:           "भाषा",

  // ── Dashboard ────────────────────────────
  dashboardOverview:     "डैशबोर्ड अवलोकन",
  downloadReport:        "रिपोर्ट डाउनलोड करें",
  loadingDashboard:      "डैशबोर्ड लोड हो रहा है...",
  salesExpensesOverview: "बिक्री और खर्च अवलोकन",
  monthly:               "मासिक",
  yearly:                "वार्षिक",
  sales:                 "बिक्री",
  noDataFor:             "के लिए कोई डेटा नहीं",
  todaysAlerts:          "आज की सूचनाएं",
  recentActivities:      "हाल की गतिविधियां",
  viewAll:               "सभी देखें",
  quickActions:          "त्वरित क्रियाएं",

  // ── KPI ──────────────────────────────────
  totalSales:         "कुल बिक्री",
  totalExpenses:      "कुल खर्च",
  netProfit:          "शुद्ध लाभ",
  profitMargin:       "लाभ मार्जिन",
  todaySales:         "आज की बिक्री",
  thisYear:           "इस वर्ष",
  labourCostPct:      "श्रम लागत %",
  ofTotalSales:       "कुल बिक्री का",
  staffPresent:       "उपस्थित कर्मचारी",
  absent:             "अनुपस्थित",
  allPresent:         "सभी उपस्थित",

  // ── Monthly Summary ───────────────────────
  monthlySummary:     "मासिक सारांश",
  month:              "महीना",
  actions:            "क्रियाएं",
  totalThisYear:      "इस वर्ष का कुल",

  // ── Daily Details ─────────────────────────
  dailyDetails:       "दैनिक विवरण",
  report:             "रिपोर्ट",
  date:               "तारीख",
  total:              "कुल",

  // ── General ──────────────────────────────
  management:         "प्रबंधन",
  operations:         "संचालन",
  finance:            "वित्त",
  system:             "प्रणाली",
  main:               "मुख्य",
  profitLoss:         "लाभ और हानि",
  monthlyReport:      "मासिक रिपोर्ट",
  executiveDashboard: "कार्यकारी डैशबोर्ड",

  // ── Sales Entry ───────────────────────────
  dailySales:          "दैनिक बिक्री",
  history:             "इतिहास",
  editSale:            "बिक्री संपादित करें",
  newEntry:            "नई प्रविष्टि",
  shift:               "शिफ्ट",
  amount:              "राशि",
  noteOptional:        "नोट (वैकल्पिक)",
  updateSale:          "बिक्री अपडेट करें",
  saveSale:            "बिक्री सहेजें",
  cancelEdit:          "संपादन रद्द करें",
  todaysTotal:         "आज का कुल",
  fullHistory:         "पूरा इतिहास",
  todaysEntries:       "आज की प्रविष्टियां",
  noSalesToday:        "आज कोई बिक्री नहीं",
  selectShift:         "शिफ्ट चुनें",
  lockShift:           "शिफ्ट लॉक करें",
  locked:              "लॉक है",
  lock:                "लॉक",
  addNote:             "नोट जोड़ें...",
  paymentMethod:       "भुगतान विधि",

  // ── Sales Entry (Add Sale module) ─────────
  editEntry:            "प्रविष्टि संपादित करें",
  entryName:            "प्रविष्टि नाम",
  entryNamePlaceholder: "जैसे: लंच रश, डिलीवरी बैच...",
  entry:                "प्रविष्टि",
  entries:              "प्रविष्टियाँ",
  noEntriesYet:         "अभी तक कोई प्रविष्टि नहीं",
  saving:               "सहेजा जा रहा है...",
  cancel:               "रद्द करें",
  deleteEntry:          "प्रविष्टि हटाएं",
  deleteEntryConfirm:   "क्या आप वाकई इस प्रविष्टि को हटाना चाहते हैं?",
  delete:               "हटाएं",
  unlockShift:          "शिफ्ट अनलॉक करें",
  unlockShiftConfirm:   "संपादन के लिए इस शिफ्ट को अनलॉक करें?",
  lockShiftConfirm:     "इस शिफ्ट को लॉक करें? लॉक करने के बाद प्रविष्टियाँ संपादित नहीं की जा सकतीं।",
  error:                "त्रुटि",
};

export default hi;