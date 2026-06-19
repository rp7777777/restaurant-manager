// ============================================
// SERVORA ERP — Date Utils
// ✅ Timezone safe — parseDate() everywhere
// ============================================

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

export function parseDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toDateString(d);
}

export function getWeekDates(weekStart: string): string[] {
  const start = parseDate(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateString(d);
  });
}

export function getMonthWeeks(year: number, month: number): string[] {
  const weeks: string[] = [];
  const start = new Date(year, month, 1);
  const dow = start.getDay();
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  const end = new Date(year, month + 1, 0);
  const cur = new Date(start);
  while (cur <= end) {
    weeks.push(toDateString(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

export function formatDisplay(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return day + "/" + mon;
}

export function formatFull(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const yr  = d.getFullYear();
  return day + "/" + mon + "/" + yr;
}

export function formatMonthStr(year: number, month: number): string {
  return new Date(year, month)
    .toLocaleString("en-GB", { month: "short" }) + "-" + year;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function isToday(dateStr: string): boolean {
  return dateStr === toDateString(new Date());
}

export function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseDate(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function getNextWeek(weekStart: string): string {
  return addDays(weekStart, 7);
}

export function getPreviousWeek(weekStart: string): string {
  return addDays(weekStart, -7);
}