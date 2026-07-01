// ============================================
// SERVORA ERP — useDashboardReport
// ✅ PDF generation handler
// ✅ Loading state
// ✅ Error handling
// ✅ useRef guard — double-tap prevention
// ✅ All data passed as params — no Firestore
// FROZEN
// ============================================

import { useState, useCallback, useRef } from "react";
import {
  generateDashboardPDF,
  PDFOptions,
} from "../../services/dashboard/dashboard-pdf";

export interface UseDashboardReportResult {
  generating: boolean;
  error:      string | null;
  generate:   (opts: PDFOptions) => Promise<void>;
}

export function useDashboardReport(): UseDashboardReportResult {
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ✅ useRef — no stale closure — double-tap safe
  const generatingRef = useRef(false);

  const generate = useCallback(async (opts: PDFOptions) => {
    // ✅ Guard — prevent multiple simultaneous generation
    if (generatingRef.current) return;

    generatingRef.current = true;
    setGenerating(true);
    setError(null);

    try {
      await generateDashboardPDF(opts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, []);

  return { generating, error, generate };
}