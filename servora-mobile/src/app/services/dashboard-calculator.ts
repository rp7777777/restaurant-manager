import { MonthlySummary } from "./dashboard";

export function calculateProfit(
  sales: number,
  expenses: number
): number {
  return sales - expenses;
}

export function calculateProfitMargin(
  sales: number,
  expenses: number
): number {
  if (sales <= 0) return 0;

  return Number(
    (((sales - expenses) / sales) * 100).toFixed(2)
  );
}

export function calculateYearSales(
  data: MonthlySummary[]
): number {
  return data.reduce(
    (sum, item) => sum + item.totalSales,
    0
  );
}

export function calculateYearExpenses(
  data: MonthlySummary[]
): number {
  return data.reduce(
    (sum, item) => sum + item.totalExpenses,
    0
  );
}

export function calculateYearProfit(
  data: MonthlySummary[]
): number {
  return data.reduce(
    (sum, item) => sum + item.netProfit,
    0
  );
}

export function getBestMonth(
  data: MonthlySummary[]
): MonthlySummary | null {
  if (!data.length) return null;

  return [...data].sort(
    (a, b) => b.totalSales - a.totalSales
  )[0];
}