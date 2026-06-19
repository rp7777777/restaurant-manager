// ============================================
// SERVORA ERP — Schedule PDF Service
// ✅ HTML injection protection — type safe
// ✅ Single quote escape added
// ✅ iframe print — no popup blocker
// ✅ FileSystem null check
// ✅ Overwrite safe
// ✅ Page break CSS
// ✅ Error handling
// ============================================

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { EmployeeSchedule, DayStatus } from "../types/schedule-types";
import { STATUS_COLORS } from "../constants/statuses";
import { DAYS_EN } from "../constants/schedule-config";
import { formatDisplay, formatFull, getWeekDates } from "../utils/date-utils";

// ✅ Type safe + single quote escape
function escapeHtml(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ✅ iframe print — proper PDF, no popup blocker
function printViaIframe(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // ✅ Ensure write complete before print
  iframe.contentWindow?.document.close();

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }
  };
}

export async function generateSchedulePDF(
  restaurantName: string,
  schedules: EmployeeSchedule[],
  weekStart: string
): Promise<void> {
  try {
    const weekDates = getWeekDates(weekStart);

    const rows = schedules.map((emp) => {
      const cells = weekDates.map((date) => {
        const day = emp.days[date];
        if (!day) return "<td style='text-align:center;padding:5px;color:#ccc'>—</td>";

        if (day.status === "WORK") {
          const nightIndicator = (day.nightHours ?? 0) > 0
            ? "<span style='color:#3b82f6;font-size:8px'> 🌙</span>"
            : "";
          return `<td style='text-align:center;padding:4px;font-size:9px'>
            ${escapeHtml(day.startTime)}/${escapeHtml(day.endTime)}${nightIndicator}
          </td>`;
        }

        const color = STATUS_COLORS[day.status as DayStatus] ?? "#94a3b8";
        return `<td style='text-align:center;padding:5px;color:${color};font-weight:bold;font-size:9px'>
          ${escapeHtml(day.status)}
        </td>`;
      }).join("");

      return `<tr>
        <td style='padding:5px;white-space:nowrap'>${escapeHtml(emp.employeeNo)}</td>
        <td style='padding:5px;font-weight:bold;white-space:nowrap'>${escapeHtml(emp.employeeName)}</td>
        <td style='padding:5px;font-size:9px;white-space:nowrap'>${escapeHtml(emp.position)}</td>
        ${cells}
        <td style='text-align:center;padding:5px;color:#3b82f6;font-weight:bold'>${(emp.totalHours || 0).toFixed(1)}</td>
        <td style='text-align:center;padding:5px;color:#f59e0b;font-weight:bold'>${(emp.overtimeHours || 0).toFixed(1)}</td>
        <td style='text-align:center;padding:5px;color:#ef4444'>${emp.absentDays || 0}</td>
      </tr>`;
    }).join("");

    const totalOT     = schedules.reduce((s, e) => s + (e.overtimeHours || 0), 0);
    const totalAbsent = schedules.reduce((s, e) => s + (e.absentDays || 0), 0);
    const totalHours  = schedules.reduce((s, e) => s + (e.totalHours || 0), 0);

    const summaryRow = `<tr style='background:#00154f;color:#FFD700;font-weight:bold'>
      <td colspan='3' style='padding:6px'>TOTAL (${schedules.length} employees)</td>
      ${weekDates.map(() => "<td></td>").join("")}
      <td style='text-align:center;padding:5px'>${totalHours.toFixed(1)}</td>
      <td style='text-align:center;padding:5px'>${totalOT.toFixed(1)}</td>
      <td style='text-align:center;padding:5px'>${totalAbsent}</td>
    </tr>`;

    const dayHeaders = weekDates.map((date, idx) =>
      `<th style='padding:6px;background:#00154f;color:#FFD700;min-width:75px;text-align:center'>
        ${DAYS_EN[idx]}<br/>
        <span style='font-size:8px;font-weight:normal'>${formatDisplay(date)}</span>
      </th>`
    ).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e2e8f0; padding: 3px; }
    tr:nth-child(even) { background: #f8fafc; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px'>
    <div>
      <h2 style='color:#00154f;margin:0;font-size:18px'>${escapeHtml(restaurantName)}</h2>
      <p style='color:#64748b;margin:4px 0 0;font-size:11px'>Weekly Schedule</p>
    </div>
    <div style='text-align:right;color:#64748b;font-size:11px'>
      <div>${formatFull(weekDates[0])} — ${formatFull(weekDates[6])}</div>
      <div>Generated: ${new Date().toLocaleDateString("en-GB")}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style='background:#00154f;color:#FFD700;padding:6px'>No</th>
        <th style='background:#00154f;color:#FFD700;padding:6px'>Name</th>
        <th style='background:#00154f;color:#FFD700;padding:6px'>Position</th>
        ${dayHeaders}
        <th style='background:#00154f;color:#FFD700;padding:6px'>Hrs</th>
        <th style='background:#00154f;color:#FFD700;padding:6px'>OT</th>
        <th style='background:#00154f;color:#FFD700;padding:6px'>Abs</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${summaryRow}
    </tbody>
  </table>

  <div style='margin-top:12px;font-size:9px;color:#94a3b8;display:flex;flex-wrap:wrap;gap:12px'>
    <span>🟢 WORK = Working</span>
    <span style='color:#f97316'>DO = Day Off (Mandatory)</span>
    <span style='color:#dc2626'>DC = Day Off (Complementary)</span>
    <span style='color:#94a3b8'>ABSENT = No Pay</span>
    <span style='color:#8b5cf6'>HOLIDAY = Public Holiday</span>
    <span style='color:#ef4444'>SICK = Sick Leave</span>
    <span style='color:#06b6d4'>VACATION = Vacation</span>
    <span style='color:#f59e0b'>TRAINING = Training</span>
    <span style='color:#3b82f6'>🌙 = Night Shift</span>
  </div>

  <div style='margin-top:20px;display:flex;justify-content:space-between;font-size:11px'>
    <div>Manager Signature: _______________________</div>
    <div>Date: _______________________</div>
  </div>
</body>
</html>`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      printViaIframe(html);
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      const available = await Sharing.isAvailableAsync();

      if (available) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        // ✅ documentDirectory null check
        const docDir = (FileSystem as any).documentDirectory as string | null;
        if (!docDir) {
          throw new Error("Document directory unavailable");
        }
        const dest = docDir + "schedule-" + weekStart + ".pdf";
        const existing = await FileSystem.getInfoAsync(dest);
        if (existing.exists) {
          await FileSystem.deleteAsync(dest, { idempotent: true });
        }
        await FileSystem.copyAsync({ from: uri, to: dest });
        console.log("PDF saved to:", dest);
      }
    }
} catch (error) {
    console.error("PDF generation failed:", error);
    throw error;
  }
}