// ============================================
// SERVORA ERP — Dashboard PDF
// ✅ Pure buildHTML() function
// ✅ Platform aware — web + mobile
// ✅ window.open — onload print
// ✅ Sharing.isAvailableAsync() check
// ✅ 9 KPI grid
// ✅ Runtime safe — null guards
// FROZEN
// ============================================

import { Platform } from "react-native";
import * as Print   from "expo-print";
import * as Sharing from "expo-sharing";
import { MONTH_NAMES } from "../../constants/dashboard";
import {
  MonthSummary,
  YearTotals,
  AttendanceSummary,
} from "../../types/dashboard";
import { DashboardStats } from "../dashboard-service";

// ── PDF Options ───────────────────────────────
export interface PDFOptions {
  selectedYear:  number;
  selectedMonth: number;
  summaries:     MonthSummary[];
  yearTotals:    YearTotals;
  stats:         DashboardStats;
  attendance:    AttendanceSummary;
  fmt:           (n: number) => string;
}

// ── ✅ Pure — build HTML only ─────────────────
export function buildDashboardHTML(opts: PDFOptions): string {
  const {
    selectedYear, selectedMonth,
    summaries, yearTotals,
    stats, attendance, fmt,
  } = opts;

  const safeMonth = Math.max(0, Math.min(11, selectedMonth));

  const safeFmt = (n: number): string => {
    try { return fmt(n); } catch { return `${n}`; }
  };

  const profitMarginPct = yearTotals.sales > 0
    ? ((yearTotals.profit / yearTotals.sales) * 100).toFixed(2)
    : "0";

  const rows = summaries.map((m) => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px;font-weight:${safeMonth === m.month ? "bold" : "normal"}">
        ${MONTH_NAMES[m.month] ?? ""}
      </td>
      <td style="padding:8px;color:#10b981;text-align:right">${safeFmt(m.totalSales)}</td>
      <td style="padding:8px;color:#ef4444;text-align:right">${safeFmt(m.totalExpenses)}</td>
      <td style="padding:8px;color:${m.netProfit >= 0 ? "#3b82f6" : "#ef4444"};text-align:right">
        ${safeFmt(m.netProfit)}
      </td>
      <td style="padding:8px;color:#f59e0b;text-align:right">
        ${m.profitMargin.toFixed(2)}%
      </td>
    </tr>
  `).join("");

  const kpis = [
    { label: "Total Sales",        value: safeFmt(yearTotals.sales),    color: "#10b981" },
    { label: "Total Expenses",     value: safeFmt(yearTotals.expenses), color: "#ef4444" },
    { label: "Net Profit",         value: safeFmt(yearTotals.profit),   color: "#3b82f6" },
    { label: "Profit Margin",      value: `${profitMarginPct}%`,        color: "#f59e0b" },
    { label: "Labour Cost %",      value: stats.labourCostPct > 0 ? `${stats.labourCostPct.toFixed(1)}%` : "N/A", color: "#8b5cf6" },
    { label: "Staff Present",      value: `${attendance.present} / ${attendance.total}`, color: "#06b6d4" },
    { label: "Total Transactions", value: stats.totalTransactions.toLocaleString(),       color: "#00154f" },
    { label: "Today's Sales",      value: safeFmt(stats.todaySales),    color: "#10b981" },
    { label: "Inventory Value",    value: stats.inventoryValue > 0 ? safeFmt(stats.inventoryValue) : "N/A", color: "#f97316" },
  ];

  const kpiGrid = kpis.map((k) => `
    <div class="kpi-item" style="border-left-color:${k.color}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value" style="color:${k.color}">${k.value}</div>
    </div>
  `).join("");

  const now = new Date();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1   { color: #00154f; font-size: 20px; margin-bottom: 4px; }
    h2   { color: #00154f; font-size: 14px; margin-top: 24px; margin-bottom: 8px; }
    p    { color: #64748b; font-size: 11px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th    { background: #00154f; color: #FFD700; padding: 8px; text-align: left; font-size: 11px; }
    td    { font-size: 11px; }
    .kpi-grid  { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 12px 0; }
    .kpi-item  { background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 3px solid; }
    .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 17px; font-weight: bold; margin-top: 4px; word-break: break-all; }
    .total-row td { background: #00154f; color: #FFD700; font-weight: bold; padding: 8px; }
    .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>📊 SERVORA ERP — Dashboard Report</h1>
  <p>
    Year: ${selectedYear} &nbsp;|&nbsp;
    Generated: ${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB")}
  </p>

  <h2>Key Performance Indicators</h2>
  <div class="kpi-grid">${kpiGrid}</div>

  <h2>Monthly Summary (${selectedYear})</h2>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th style="text-align:right">Total Sales</th>
        <th style="text-align:right">Total Expenses</th>
        <th style="text-align:right">Net Profit</th>
        <th style="text-align:right">Margin</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:right">${safeFmt(yearTotals.sales)}</td>
        <td style="text-align:right">${safeFmt(yearTotals.expenses)}</td>
        <td style="text-align:right">${safeFmt(yearTotals.profit)}</td>
        <td style="text-align:right">${profitMarginPct}%</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    SERVORA ERP &copy; ${now.getFullYear()} &mdash; Confidential Restaurant Management Report
  </div>
</body>
</html>`;
}

// ── ✅ Generate + share PDF ────────────────────
export async function generateDashboardPDF(
  opts: PDFOptions
): Promise<void> {
  const html = buildDashboardHTML(opts);

  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);

    // ✅ Fix #1 — onload before print
    const win = window.open(url);
    if (win) {
      win.onload = () => {
        win.print();
        // ✅ Cleanup blob URL after print
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      };
    } else {
      // ✅ Popup blocked fallback
      URL.revokeObjectURL(url);
      console.warn("Popup blocked — cannot open PDF");
    }
    return;
  }

  // ✅ Mobile
  try {
    const { uri } = await Print.printToFileAsync({ html });

    // ✅ Fix #2 — check sharing available
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType:    "application/pdf",
        dialogTitle: `Dashboard Report ${opts.selectedYear}`,
      });
    } else {
      console.warn("Sharing not available on this device");
    }
  } catch (err) {
    console.error("PDF generation failed:", err);
    throw err;
  }
}