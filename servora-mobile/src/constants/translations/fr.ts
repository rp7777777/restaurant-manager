// ============================================
// SERVORA ERP — French Translations (fr)
// ✅ French typography — space before ?
// ✅ main-d'œuvre — ERP natural
// ✅ Analyses — ERP context
// ✅ Sentence case — French style
// ============================================

import { Translation } from "../translation-types";

const fr: Translation = {
  // ── App ──────────────────────────────────
  appName:            "SERVORA ERP",
  // ✅ Fix #1 — sentence case French style
  appSubtitle:        "Système de gestion de restaurant",

  // ── Navigation ───────────────────────────
  dashboard:          "Dashboard",
  salesEntry:         "Saisie des Ventes",
  salesList:          "Liste des Ventes",
  expenses:           "Dépenses",
  inventory:          "Inventaire",
  billing:            "Facturation",
  kitchen:            "Cuisine",
  reports:            "Rapports",
  payroll:            "Paie",
  employees:          "Employés",
  suppliers:          "Fournisseurs",
  customers:          "Clients",
  purchaseOrders:     "Bons de Commande",
  settings:           "Paramètres",
  users:              "Utilisateurs",
  auditLog:           "Journal d'Audit",
  backup:             "Sauvegarde",
  store:              "Magasin",
  schedule:           "Horaire",
  attendance:         "Présence",
  // ✅ Fix #3 — ERP natural
  labourCost:         "Coût de la main-d'œuvre",
  reservations:       "Réservations",
  delivery:           "Livraison",
  restaurants:        "Restaurants",
  branches:           "Succursales",
  // ✅ Fix #5 — ERP context
  analytics:          "Analyses",
  pos:                "Système POS",

  // ── Auth ─────────────────────────────────
  login:              "Connexion",
  logout:             "Déconnexion",
  register:           "S'inscrire",
  email:              "Email",
  password:           "Mot de Passe",
  // ✅ Fix #2 — French typography space before ?
  forgotPassword:     "Mot de passe oublié ?",
  createAccount:      "Créer un Compte",
  loginToContinue:    "Connectez-vous pour continuer",
  welcomeBack:        "Bon retour",
  openApp:            "Ouvrir l'Application",

  // ── Theme / Language ──────────────────────
  theme:              "Thème",
  language:           "Langue",

  // ── Dashboard ────────────────────────────
  dashboardOverview:     "Vue d'ensemble du Dashboard",
  downloadReport:        "Télécharger le Rapport",
  loadingDashboard:      "Chargement du dashboard...",
  salesExpensesOverview: "Vue d'ensemble des Ventes et Dépenses",
  monthly:               "Mensuel",
  yearly:                "Annuel",
  sales:                 "Ventes",
  noDataFor:             "Aucune donnée pour",
  todaysAlerts:          "Alertes du Jour",
  recentActivities:      "Activités Récentes",
  viewAll:               "Voir Tout",
  quickActions:          "Actions Rapides",

  // ── KPI ──────────────────────────────────
  totalSales:         "Ventes Totales",
  totalExpenses:      "Dépenses Totales",
  netProfit:          "Bénéfice Net",
  profitMargin:       "Marge Bénéficiaire",
  todaySales:         "Ventes du Jour",
  thisYear:           "Cette Année",
  // ✅ Fix #4 — ERP natural
  labourCostPct:      "Coût de la main-d'œuvre %",
  ofTotalSales:       "des ventes totales",
  staffPresent:       "Personnel Présent",
  absent:             "absent",
  allPresent:         "Tous présents",

  // ── Monthly Summary ───────────────────────
  monthlySummary:     "Résumé Mensuel",
  month:              "Mois",
  actions:            "Actions",
  totalThisYear:      "Total (Cette Année)",

  // ── Daily Details ─────────────────────────
  dailyDetails:       "Détails Quotidiens",
  report:             "Rapport",
  date:               "Date",
  total:              "Total",

  // ── General ──────────────────────────────
  management:         "Gestion",
  operations:         "Opérations",
  finance:            "Finance",
  system:             "Système",
  main:               "Principal",
  profitLoss:         "Profits et Pertes",
  monthlyReport:      "Rapport Mensuel",
  executiveDashboard: "Dashboard Exécutif",

  // ── Sales Entry ───────────────────────────
  dailySales:          "Ventes Quotidiennes",
  history:             "Historique",
  editSale:            "Modifier la Vente",
  newEntry:            "Nouvelle Entrée",
  shift:               "Équipe",
  amount:              "Montant",
  noteOptional:        "Note (Facultatif)",
  updateSale:          "Mettre à Jour",
  saveSale:            "Enregistrer",
  cancelEdit:          "Annuler",
  todaysTotal:         "Total du Jour",
  fullHistory:         "Historique Complet",
  todaysEntries:       "Entrées du Jour",
  noSalesToday:        "Aucune vente aujourd'hui",
  selectShift:         "Sélectionner l'Équipe",
  lockShift:           "Verrouiller l'Équipe",
  locked:              "Verrouillé",
  lock:                "Verrouiller",
  addNote:             "Ajouter une note...",
  paymentMethod:       "Mode de Paiement",

  // ── Sales Entry (Add Sale module) ─────────
  editEntry:            "Modifier l'Entrée",
  entryName:            "Nom de l'Entrée",
  entryNamePlaceholder: "ex. Rush du midi, Lot de livraison...",
  entry:                "entrée",
  entries:              "entrées",
  noEntriesYet:         "Aucune entrée pour le moment",
  saving:               "Enregistrement...",
  cancel:               "Annuler",
  deleteEntry:          "Supprimer l'Entrée",
  deleteEntryConfirm:   "Êtes-vous sûr de vouloir supprimer cette entrée ?",
  delete:               "Supprimer",
  unlockShift:          "Déverrouiller le Service",
  unlockShiftConfirm:   "Déverrouiller ce service pour modification ?",
  lockShiftConfirm:     "Verrouiller ce service ? Les entrées ne pourront plus être modifiées après verrouillage.",
  error:                "Erreur",
};

export default fr;