// ============================================
// SERVORA ERP — useSupplierDetourNavigation Hook
// ✅ Isolates the "+ New Supplier" detour's navigation timing logic.
// ✅ FIX — explicit lifecycle guard (isDetourInProgress) added to fix
//    a real race: previously, saveDraft() was called BEFORE
//    navigation (inside InventoryForm.tsx's handleAddSupplierWithDraft,
//    prior to calling onAddSupplier/triggerSupplierDetour). This
//    meant a pending draft existed the INSTANT closeForm() ran —
//    before router.push() had actually navigated anywhere. Since
//    closeForm() (setShowForm(false)) could cause
//    checkForReturnAndReopen's identity to change (it depends on
//    showForm) and InventoryScreen's useFocusEffect to re-evaluate
//    even without truly leaving/returning to the Inventory route,
//    a pending draft could be detected and acted on prematurely —
//    reopening the Add Item modal before the user ever actually
//    reached Suppliers. The result: the modal appeared to "blink"
//    and land back on itself, with actual navigation only
//    succeeding on a second tap.
//    Fix: triggerSupplierDetour() sets isDetourInProgress=true
//    BEFORE closing the form. While true, checkForReturnAndReopen()
//    is a no-op regardless of hasPendingDraft() — a pending draft is
//    NOT sufficient evidence the user is "returning from Suppliers"
//    while a detour is actively being initiated from Inventory
//    itself. The guard is released immediately before initiating
//    router.push() (not after it resolves — router.push() has no
//    meaningful "complete" signal this hook waits on). From that
//    point onward, return detection is live again; actual return/
//    reopen behavior is still governed entirely by InventoryScreen's
//    own focus lifecycle (useFocusEffect), which will correctly
//    detect and act on this same pending draft once the user
//    genuinely navigates back from Suppliers — a distinct, later
//    moment.
// ✅ triggerSupplierDetour() — closes the Add Item modal, then
//    navigates to Suppliers only once the modal's close has actually
//    committed in a render (pendingNav + useEffect, not setTimeout).
// ✅ Does not touch setShowForm/setEditingItem directly — takes a
//    single onReopen callback.
// ✅ checkForReturnAndReopen() is meant to be called from exactly
//    ONE useFocusEffect in InventoryScreen.tsx.
// FROZEN
// ============================================

import { useState, useEffect, useRef, useCallback } from "react";
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

  // ✅ True from the moment a detour is triggered until navigation
  // is initiated. Blocks checkForReturnAndReopen() from
  // misinterpreting "I just saved a draft and am about to navigate"
  // as "I've returned from Suppliers and should restore."
  const isDetourInProgress = useRef(false);

  useEffect(() => {
    if (pendingNav && !showForm) {
      setPendingNav(false);
      isDetourInProgress.current = false; // guard released — see FROZEN header
      router.push("/suppliers?autoOpen=create");
    }
  }, [pendingNav, showForm, router]);

  const triggerSupplierDetour = useCallback(() => {
    isDetourInProgress.current = true;
    closeForm();
    setPendingNav(true);
  }, [closeForm]);

  const checkForReturnAndReopen = useCallback(() => {
    if (isDetourInProgress.current) return; // guard — see FROZEN header
    if (hasPendingDraft() && !showForm) {
      onReopen();
    }
  }, [hasPendingDraft, showForm, onReopen]);

  return { triggerSupplierDetour, checkForReturnAndReopen };
}