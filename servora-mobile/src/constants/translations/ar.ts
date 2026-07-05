// ============================================
// SERVORA ERP — Arabic Translations (ar)
// ✅ RTL language
// ============================================

import { Translation } from "../translation-types";

const ar: Translation = {
  // ── App ──────────────────────────────────
  appName:            "سيرفورا ERP",
  appSubtitle:        "نظام إدارة المطاعم",

  // ── Navigation ───────────────────────────
  dashboard:          "لوحة التحكم",
  salesEntry:         "إدخال المبيعات",
  salesList:          "قائمة المبيعات",
  expenses:           "المصروفات",
  inventory:          "المخزون",
  billing:            "الفواتير",
  kitchen:            "المطبخ",
  reports:            "التقارير",
  payroll:            "الرواتب",
  employees:          "الموظفون",
  suppliers:          "الموردون",
  customers:          "العملاء",
  purchaseOrders:     "أوامر الشراء",
  settings:           "الإعدادات",
  users:              "المستخدمون",
  auditLog:           "سجل المراجعة",
  backup:             "نسخ احتياطي",
  store:              "المخزن",
  schedule:           "الجدول الزمني",
  attendance:         "الحضور",
  labourCost:         "تكلفة العمالة",
  reservations:       "الحجوزات",
  delivery:           "التوصيل",
  restaurants:        "المطاعم",
  branches:           "الفروع",
  analytics:          "التحليلات",
  pos:                "نظام نقاط البيع",

  // ── Auth ─────────────────────────────────
  login:              "تسجيل الدخول",
  logout:             "تسجيل الخروج",
  register:           "تسجيل",
  email:              "البريد الإلكتروني",
  password:           "كلمة المرور",
  forgotPassword:     "نسيت كلمة المرور؟",
  createAccount:      "إنشاء حساب جديد",
  loginToContinue:    "سجّل دخولك للمتابعة",
  welcomeBack:        "مرحباً بعودتك",
  openApp:            "فتح التطبيق",

  // ── Theme / Language ──────────────────────
  theme:              "المظهر",
  language:           "اللغة",

  // ── Dashboard ────────────────────────────
  dashboardOverview:     "نظرة عامة على لوحة التحكم",
  downloadReport:        "تنزيل التقرير",
  loadingDashboard:      "جارٍ تحميل لوحة التحكم...",
  salesExpensesOverview: "نظرة عامة على المبيعات والمصروفات",
  monthly:               "شهري",
  yearly:                "سنوي",
  sales:                 "المبيعات",
  noDataFor:             "لا توجد بيانات لـ",
  todaysAlerts:          "تنبيهات اليوم",
  recentActivities:      "الأنشطة الأخيرة",
  viewAll:               "عرض الكل",
  quickActions:          "إجراءات سريعة",

  // ── KPI ──────────────────────────────────
  totalSales:         "إجمالي المبيعات",
  totalExpenses:      "إجمالي المصروفات",
  netProfit:          "صافي الربح",
  profitMargin:       "هامش الربح",
  todaySales:         "مبيعات اليوم",
  thisYear:           "هذا العام",
  labourCostPct:      "تكلفة العمالة %",
  ofTotalSales:       "من إجمالي المبيعات",
  staffPresent:       "الموظفون الحاضرون",
  absent:             "غائب",
  allPresent:         "الجميع حاضر",

  // ── Monthly Summary ───────────────────────
  monthlySummary:     "الملخص الشهري",
  month:              "الشهر",
  actions:            "الإجراءات",
  totalThisYear:      "الإجمالي (هذا العام)",

  // ── Daily Details ─────────────────────────
  dailyDetails:       "التفاصيل اليومية",
  report:             "التقرير",
  date:               "التاريخ",
  total:              "الإجمالي",

  // ── General ──────────────────────────────
  management:         "الإدارة",
  operations:         "العمليات",
  finance:            "المالية",
  system:             "النظام",
  main:               "الرئيسية",
  profitLoss:         "الأرباح والخسائر",
  monthlyReport:      "التقرير الشهري",
  executiveDashboard: "لوحة تحكم تنفيذية",

  // ── Sales Entry ───────────────────────────
  dailySales:          "المبيعات اليومية",
  history:             "السجل",
  editSale:            "تعديل البيع",
  newEntry:            "إدخال جديد",
  shift:               "الوردية",
  amount:              "المبلغ",
  noteOptional:        "ملاحظة (اختياري)",
  updateSale:          "تحديث البيع",
  saveSale:            "حفظ البيع",
  cancelEdit:          "إلغاء التعديل",
  todaysTotal:         "إجمالي اليوم",
  fullHistory:         "السجل الكامل",
  todaysEntries:       "إدخالات اليوم",
  noSalesToday:        "لا توجد مبيعات اليوم",
  selectShift:         "اختر الوردية",
  lockShift:           "قفل الوردية",
  locked:              "مقفل",
  lock:                "قفل",
  addNote:             "إضافة ملاحظة...",
  paymentMethod:       "طريقة الدفع",

  // ── Sales Entry (Add Sale module) ─────────
  editEntry:            "تعديل الإدخال",
  entryName:            "اسم الإدخال",
  entryNamePlaceholder: "مثال: ازدحام الغداء، دفعة توصيل...",
  entry:                "إدخال",
  entries:              "إدخالات",
  noEntriesYet:         "لا توجد إدخالات حتى الآن",
  saving:               "جاري الحفظ...",
  cancel:               "إلغاء",
  deleteEntry:          "حذف الإدخال",
  deleteEntryConfirm:   "هل أنت متأكد أنك تريد حذف هذا الإدخال؟",
  delete:               "حذف",
  unlockShift:          "إلغاء قفل الوردية",
  unlockShiftConfirm:   "إلغاء قفل هذه الوردية للتعديل؟",
  lockShiftConfirm:     "قفل هذه الوردية؟ لا يمكن تعديل الإدخالات بعد القفل.",
  error:                "خطأ",
};

export default ar;