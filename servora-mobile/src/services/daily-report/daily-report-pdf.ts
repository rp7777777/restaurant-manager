// ============================================
// SERVORA ERP — Daily Report PDF
// ✅ Mirrors dashboard-pdf.ts's exact pattern (buildHTML → platform-
//    aware print/share) for consistency — same libraries
//    (expo-print, expo-sharing), same web window.open+onload+print
//    approach, same mobile Print.printToFileAsync+Sharing flow.
// ✅ Pure buildDailyReportHTML() — no side effects, easy to test/
//    preview independent of the actual print/share mechanics.
// ✅ Three sections, each grouped by category: current Inventory
//    snapshot, today's Stock-In (PURCHASE movements), today's
//    Stock-Out (KITCHEN_ISSUE movements) — matches what a Store
//    Keeper actually wants to hand off or archive at end of day.
// ============================================

import { Platform } from "react-native";
import * as Print   from "expo-print";
import * as Sharing from "expo-sharing";
import { StockMovement } from "../../modules/stock-movement-module/types/stock-movement";
import { InventoryItem } from "../../modules/inventory-module/types/inventory";
import { Category } from "../../modules/inventory-module/types/category";

export interface DailyReportOptions {
  dateLabel:        string;  // e.g. "29 Jul 2026" — already formatted by the caller
  inventoryItems:   InventoryItem[];
  todaysMovements:  StockMovement[];
  categories:       Category[];
  fmt:              (n: number) => string;
}

interface CategoryRows<T> {
  categoryName: string;
  rows: T[];
}

function groupByCategory<T>(
  rows: T[],
  getCategoryId: (row: T) => string | undefined,
  categoryMap: Map<string, Category>
): CategoryRows<T>[] {
  const byCategory = new Map<string, CategoryRows<T>>();
  for (const row of rows) {
    const categoryId   = getCategoryId(row) ?? "uncategorized";
    const categoryName = categoryMap.get(categoryId)?.name ?? "Uncategorized";
    if (!byCategory.has(categoryId)) {
      byCategory.set(categoryId, { categoryName, rows: [] });
    }
    byCategory.get(categoryId)!.rows.push(row);
  }
  return Array.from(byCategory.values()).sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName)
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildDailyReportHTML(opts: DailyReportOptions): string {
  const { dateLabel, inventoryItems, todaysMovements, categories, fmt } = opts;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const inventoryByItemId = new Map(inventoryItems.map((i) => [i.id, i]));

  const stockIn  = todaysMovements.filter((m) => m.movementType === "PURCHASE");
  const stockOut = todaysMovements.filter((m) => m.movementType === "KITCHEN_ISSUE");

  const inventoryGroups = groupByCategory(
    inventoryItems, (i) => i.categoryId, categoryMap
  );
  const stockInGroups = groupByCategory(
    stockIn, (m) => inventoryByItemId.get(m.inventoryId)?.categoryId, categoryMap
  );
  const stockOutGroups = groupByCategory(
    stockOut, (m) => inventoryByItemId.get(m.inventoryId)?.categoryId, categoryMap
  );

  const renderInventorySection = (groups: CategoryRows<InventoryItem>[]) =>
    groups.map((g) => `
      <h3>${escapeHtml(g.categoryName)}</h3>
      <table>
        <tr><th>Item</th><th>Stock</th><th>Value</th></tr>
        ${g.rows.map((i) => `
          <tr>
            <td>${escapeHtml(i.itemName)}</td>
            <td>${i.currentStock} ${escapeHtml(i.unit)}</td>
            <td>${fmt(i.totalValue)}</td>
          </tr>
        `).join("")}
      </table>
    `).join("");

  const renderMovementSection = (groups: CategoryRows<StockMovement>[]) =>
    groups.map((g) => `
      <h3>${escapeHtml(g.categoryName)}</h3>
      <table>
        <tr><th>Item</th><th>Qty</th><th>Value</th></tr>
        ${g.rows.map((m) => `
          <tr>
            <td>${escapeHtml(m.itemName)}</td>
            <td>${Math.abs(m.quantityChanged)} ${escapeHtml(m.unit)}</td>
            <td>${fmt(m.movementValue)}</td>
          </tr>
        `).join("")}
      </table>
    `).join("");

  const stockInTotal  = stockIn.reduce((sum, m) => sum + m.movementValue, 0);
  const stockOutTotal = stockOut.reduce((sum, m) => sum + m.movementValue, 0);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body   { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
    h1     { font-size: 20px; margin-bottom: 2px; }
    h2     { font-size: 15px; margin-top: 28px; border-bottom: 2px solid #1e293b; padding-bottom: 4px; }
    h3     { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 16px; margin-bottom: 4px; }
    table  { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { text-align: left; padding: 4px 8px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
    th     { background: #f1f5f9; }
    .total { font-weight: bold; margin-top: 4px; }
    .sub   { color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Daily Store Report</h1>
  <div class="sub">${escapeHtml(dateLabel)}</div>

  <h2>Current Inventory Snapshot</h2>
  ${inventoryGroups.length > 0 ? renderInventorySection(inventoryGroups) : "<p class='sub'>No inventory items.</p>"}

  <h2>Today's Stock-In (Received)</h2>
  ${stockInGroups.length > 0 ? renderMovementSection(stockInGroups) : "<p class='sub'>No stock received today.</p>"}
  <div class="total">Total received: ${fmt(stockInTotal)}</div>

  <h2>Today's Stock-Out (Issued to Kitchen)</h2>
  ${stockOutGroups.length > 0 ? renderMovementSection(stockOutGroups) : "<p class='sub'>No stock issued today.</p>"}
  <div class="total">Total issued: ${fmt(stockOutTotal)}</div>
</body>
</html>`;
}

export async function generateDailyReportPDF(opts: DailyReportOptions): Promise<void> {
  const html = buildDailyReportHTML(opts);

  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);

    const win = window.open(url);
    if (win) {
      win.onload = () => {
        win.print();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      };
    } else {
      URL.revokeObjectURL(url);
      console.warn("Popup blocked — cannot open Daily Report");
    }
    return;
  }

  // ✅ Mobile
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType:    "application/pdf",
        dialogTitle: `Daily Store Report — ${opts.dateLabel}`,
      });
    } else {
      console.warn("Sharing not available on this device");
    }
  } catch (err) {
    console.error("Daily Report PDF generation failed:", err);
    throw err;
  }
}