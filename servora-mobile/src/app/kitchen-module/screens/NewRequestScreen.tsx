// ============================================
// SERVORA ERP — NewRequestScreen
// ✅ Thin wrapper — owns the useKitchenForm() instance (so the hook
//    is instantiated once at the screen level, not buried inside
//    RequestForm itself) and renders RequestForm with it.
// ============================================

import React from "react";
import { useKitchenForm } from "../hooks/useKitchenForm";
import RequestForm from "../components/RequestForm";

interface Theme {
  card:          string;
  bg:            string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
  sidebarActive: string;
}

interface NewRequestScreenProps {
  restaurantId: string | null | undefined;
  theme:        Theme;
  onSent:       () => void;
}

export default function NewRequestScreen({ restaurantId, theme, onSent }: NewRequestScreenProps) {
  const form = useKitchenForm(restaurantId);

  return <RequestForm form={form} theme={theme} onSent={onSent} />;
}