// ============================================
// SERVORA ERP — useSupplierDetourNavigation Hook
// ✅ Isolates the "+ New Supplier" detour's navigation timing logic.
// ✅ triggerSupplierDetour() — closes the Add Item modal, then
//    navigates to Suppliers only once the modal's close has actually
//    committed in a render (pendingNav state + useEffect watching
//    [pendingNav, showForm], NOT setTimeout — setTimeout only waits
//    for the next JS event loop tick, which is not the same
//    guarantee as "React has re-rendered with the new state").
// ✅ pendingNav is consumed (set back to false) in the SAME effect
//    run that satisfies its condition, before the navigation call —
//    so under this hook's own React lifecycle, a given
//    pendingNav=true triggers at most one navigation. This isn't a
//    claim about every conceivable interruption scenario (unmounts,
//    external navigation, etc. are governed by React/Expo Router's
//    own lifecycle guarantees, not this hook) — just that this
//    hook's internal logic doesn't itself introduce a re-fire path.
// ✅ Does not touch setShowForm/setEditingItem directly.
//    checkForReturnAndReopen() takes a single onReopen callback —
//    InventoryScreen.tsx (via useInventoryScreenState.ts) decides
//    HOW to reopen; this hook only decides WHEN. State-mutation
//    responsibility stays fully inside the state-owning hook.
// ✅ checkForReturnAndReopen() is meant to be called from exactly
//    ONE useFocusEffect in InventoryScreen.tsx — this hook does not
//    register its own useFocusEffect, avoiding duplicate focus-
//    handling logic existing in two places at once.
// FROZEN
// ============================================

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { useInventoryFormDraft } from "../context/InventoryFormDraftContext";

export interface UseSupplierDetourNavigationParams {
  showForm:   boolean;
  closeForm:  () => void;
  onReopen:   () => void;
}

export interface UseSupplierDetourNavigationResult {
  triggerSupplierDetour:    () => void;
  checkForReturnAndReopen:  () => void;
}

export function useSupplierDetourNavigation({
  showForm, closeForm, onReopen,
}: UseSupplierDetourNavigationParams): UseSupplierDetourNavigationResult {
  const router = useRouter();
  const { hasPendingDraft } = useInventoryFormDraft();

  const [pendingNav, setPendingNav] = useState(false);

  useEffect(() => {
    if (pendingNav && !showForm) {
      setPendingNav(false);
      router.push("/suppliers?autoOpen=create");
    }
  }, [pendingNav, showForm, router]);

  const triggerSupplierDetour = useCallback(() => {
    closeForm();
    setPendingNav(true);
  }, [closeForm]);

  const checkForReturnAndReopen = useCallback(() => {
    if (hasPendingDraft() && !showForm) {
      onReopen();
    }
  }, [hasPendingDraft, showForm, onReopen]);

  return { triggerSupplierDetour, checkForReturnAndReopen };
}