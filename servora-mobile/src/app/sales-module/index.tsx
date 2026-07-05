// ============================================
// SERVORA ERP — Sales Module Entry Point
// Expo Router screen: /sales-module
// ============================================

import React from "react";
import { AddSaleScreen } from "./screens/AddSaleScreen";
import { useRouter } from "expo-router";

export default function SalesModuleScreen() {
  const router = useRouter();

  return (
    <AddSaleScreen
      onNavigateToHistory={() => router.push("/sales-list")}
    />
  );
}