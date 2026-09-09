// ============================================
// SERVORA ERP — useSupplierDetourNavigation Hook
// ✅ FIX — the detour-in-progress guard moved from a component-local
//    ref to InventoryFormDraftContext's isDetourActive() — see that
//    file's header for the full root-cause explanation of the bug
//    this fixes (a stale/background InventoryScreen instance's
//    useFocusEffect could reopen the Add Item modal on top of
//    Suppliers, because the old local ref was cleared too early —
//    right when navigation fired, not when the draft was actually
//    consumed).
// ✅ triggerSupplierDetour() — closes the Add Item modal, then
//    navigates to Suppliers only once the modal's close has actually
//    committed in a render (pendingNav + useEffect, not setTimeout).
// ✅ Does not touch setShowForm/setEditingItem directly.
// ✅ checkForReturnAndReopen() is meant to be called from exactly
//    ONE useFocusEffect in InventoryScreen.tsx.
// ✅ Debug logging removed — the fix has been verified in production
//    use for some time.
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
  const { hasPendingDraft, isDetourActive } = useInventoryFormDraft();

  const [pendingNav, setPendingNav] = useState(false);

  useEffect(() => {
    if (pendingNav && !showForm) {
      setPendingNav(false);
      router.push("/suppliers");
    }
  }, [pendingNav, showForm, router]);

  const triggerSupplierDetour = useCallback(() => {
    closeForm();
    setPendingNav(true);
  }, [closeForm]);

  const checkForReturnAndReopen = useCallback(() => {
    // ✅ FIX — Context-level guard, not a component-local ref.
    if (isDetourActive()) return;
    if (hasPendingDraft() && !showForm) {
      onReopen();
    }
  }, [hasPendingDraft, isDetourActive, showForm, onReopen]);

  return { triggerSupplierDetour, checkForReturnAndReopen };
}