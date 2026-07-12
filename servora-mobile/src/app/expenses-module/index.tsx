// ============================================
// SERVORA ERP — Expenses Module Entry Point
// Expo Router screen: /expenses-module
// ============================================

import React from "react";
import { ExpenseEntryScreen } from "./screens/ExpenseEntryScreen";
import { useRouter } from "expo-router";

export default function ExpensesModuleScreen() {
  const router = useRouter();

  return (
    <ExpenseEntryScreen
      onNavigateToHistory={() => router.push("/expense-history")}
    />
  );
}