// ============================================
// SERVORA ERP — Kitchen Module Format Utils
// ✅ Moved verbatim from the old kitchen-module/index.tsx.
// ============================================

// ✅ NOTE: despite the name, this returns TOMORROW's date, not
// today's (d.setDate(d.getDate() + 1)) — kept exactly as the old
// index.tsx had it, since the default "Required Date" for a new
// Kitchen request being "tomorrow" is presumably intentional (a
// Chef requesting today would typically need it for the next
// service, not immediately) — not something to silently change
// during this restructuring.
export function todayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}