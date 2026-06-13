export interface DailyRecord {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
}

export interface MonthlySummary {
  month: string;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  dailyRecords: DailyRecord[];
}

export interface DashboardOverview {
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  todaySales: number;
  transactionCount: number;
}

export interface DashboardData {
  overview: DashboardOverview;
  monthlyData: MonthlySummary[];
}
