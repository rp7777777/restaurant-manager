// ============================================
// SERVORA ERP — Add Sale Screen (Controller)
// Composes: TotalCard, ShiftCard (x3), SaleForm
// Uses ConfirmModal (cross-platform) instead of
// Alert.alert() (native-only, no-ops on web)
// FROZEN
// ============================================

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useApp } from "../../../context/AppContext";
import { useSales } from "../hooks/useSales";
import { SaleEntry, Shift, PaymentMethod } from "../types/sales-types";
import { SHIFTS } from "../constants/shifts";
import { formatDisplayDate } from "../utils/sale-formatters";
import { TotalCard } from "../components/TotalCard";
import { ShiftCard } from "../components/ShiftCard";
import { SaleForm } from "../components/SaleForm";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";

const DEFAULT_SHIFT: Shift = "Morning";

type PendingAction =
  | { type: "delete"; entry: SaleEntry }
  | { type: "toggleLock"; shift: Shift; currentlyLocked: boolean }
  | { type: "editRequest"; entry: SaleEntry }
  | { type: "saveEdit"; input: { shift: Shift; amount: string; paymentMethod: PaymentMethod; entryName: string } }
  | null;

interface AddSaleScreenProps {
  onNavigateToHistory?: () => void;
}

export function AddSaleScreen({ onNavigateToHistory }: AddSaleScreenProps) {
  const { theme, t } = useApp();
  const {
    loading,
    saving,
    error,
    grandTotal,
    shiftTotal,
    shiftPaymentBreakdown,
    shiftEntries,
    shiftLocked,
    saveSale,
    removeSale,
    toggleShiftLock,
  } = useSales();

  const [editingSale, setEditingSale] = useState<SaleEntry | null>(null);

  // ── Bumped after every successful save (new-entry or edit) to force
  //    SaleForm to remount via its key prop, guaranteeing a clean reset
  //    even when editingSale was already null before and after saving. ──
  const [formResetKey, setFormResetKey] = useState(0);

  // ── Guard against double-tap on lock/delete actions ──
  const actionInFlight = useRef(false);

  // ── Scroll-to-form-on-edit: track the form's Y position via onLayout,
  //    then scroll there precisely when editing starts. ──
  const scrollViewRef = useRef<ScrollView>(null);
  const formYPosition = useRef(0);

  const scrollToForm = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: formYPosition.current, animated: true });
  }, []);

  // ── Single pending-action state drives the one shared ConfirmModal below.
  //    Replaces Alert.alert() everywhere, since Alert.alert() is native-only
  //    and silently no-ops on web. ──
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const closeConfirm = useCallback(() => setPendingAction(null), []);

  // ── Save (create or edit) ──
  const handleSave = useCallback(
    async (input: {
      shift: Shift;
      amount: string;
      paymentMethod: PaymentMethod;
      entryName: string;
    }) => {
      if (saving) return;

      // Edit mode: ask for confirmation via the shared modal.
      if (editingSale) {
        setPendingAction({ type: "saveEdit", input });
        return;
      }

      // New entry: save immediately, no confirmation needed.
      const result = await saveSale(input, editingSale);
      if (result.success) {
        setEditingSale(null);
        setFormResetKey((k) => k + 1);
      } else {
        Alert.alert(t("error"), result.error ?? "Something went wrong");
      }
    },
    [saveSale, editingSale, saving, t]
  );

  // ── Pencil click: ask for confirmation before opening the entry in the form ──
  const handleEditEntry = useCallback((entry: SaleEntry) => {
    setPendingAction({ type: "editRequest", entry });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSale(null);
  }, []);

  const handleDeleteEntry = useCallback((entry: SaleEntry) => {
    if (actionInFlight.current) return;
    setPendingAction({ type: "delete", entry });
  }, []);

  const handleToggleLock = useCallback(
    (shift: Shift) => {
      if (actionInFlight.current) return;
      const currentlyLocked = shiftLocked(shift);
      setPendingAction({ type: "toggleLock", shift, currentlyLocked });
    },
    [shiftLocked]
  );

  // ── Executes whichever action is currently pending, once the user
  //    confirms via the modal. ──
  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;

    if (pendingAction.type === "delete") {
      actionInFlight.current = true;
      closeConfirm();
      try {
        const result = await removeSale(pendingAction.entry);
        if (!result.success) {
          Alert.alert(t("error"), result.error ?? "Failed to delete");
        }
      } finally {
        actionInFlight.current = false;
      }
      return;
    }

    if (pendingAction.type === "toggleLock") {
      actionInFlight.current = true;
      closeConfirm();
      try {
        const result = await toggleShiftLock(pendingAction.shift, pendingAction.currentlyLocked);
        if (!result.success) {
          Alert.alert(t("error"), result.error ?? "Failed to update lock");
        }
      } finally {
        actionInFlight.current = false;
      }
      return;
    }

    if (pendingAction.type === "editRequest") {
      const entry = pendingAction.entry;
      closeConfirm();
      setEditingSale(entry);
      setTimeout(scrollToForm, 100);
      return;
    }

    if (pendingAction.type === "saveEdit") {
      closeConfirm();
      const result = await saveSale(pendingAction.input, editingSale);
      if (result.success) {
        setEditingSale(null);
        setFormResetKey((k) => k + 1);
      } else {
        Alert.alert(t("error"), result.error ?? "Something went wrong");
      }
      return;
    }
  }, [pendingAction, closeConfirm, removeSale, toggleShiftLock, saveSale, editingSale, t, scrollToForm]);

  // ── Derive modal copy (title/message/labels) from the pending action ──
  const modalConfig = (() => {
    if (!pendingAction) return null;

    if (pendingAction.type === "delete") {
      return {
        title: t("deleteEntry"),
        message: t("deleteEntryConfirm"),
        confirmLabel: t("delete"),
        cancelLabel: t("cancel"),
        destructive: true,
      };
    }

    if (pendingAction.type === "toggleLock") {
      const { currentlyLocked } = pendingAction;
      return {
        title: currentlyLocked ? t("unlockShift") : t("lockShift"),
        message: currentlyLocked ? t("unlockShiftConfirm") : t("lockShiftConfirm"),
        confirmLabel: currentlyLocked ? t("unlockShift") : t("lockShift"),
        cancelLabel: t("cancel"),
        destructive: false,
      };
    }

    if (pendingAction.type === "editRequest") {
      return {
        title: t("editEntry") || "Edit Entry",
        message: "Are you sure you want to edit this entry?",
        confirmLabel: t("editEntry") || "Edit",
        cancelLabel: t("cancel"),
        destructive: false,
      };
    }

    if (pendingAction.type === "saveEdit") {
      return {
        title: t("editSale") || "Update Sale",
        message: "Save changes to this entry?",
        confirmLabel: t("saveSale") || "Save",
        cancelLabel: t("cancel"),
        destructive: false,
      };
    }

    return null;
  })();

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <Text style={[styles.title, { color: theme.text }]}>
        {t("dailySales")}
      </Text>
      <Text style={[styles.date, { color: theme.textSecondary }]}>
        {formatDisplayDate()}
      </Text>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
          <Text style={{ color: theme.error, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* Today's Total */}
      <TotalCard total={grandTotal} onViewHistory={onNavigateToHistory} />

      {/* Shift Cards — instant updates via onSnapshot in useSales, no refresh needed */}
      {SHIFTS.map((shift) => (
        <ShiftCard
          key={shift}
          shift={shift}
          entries={shiftEntries(shift)}
          total={shiftTotal(shift)}
          paymentBreakdown={shiftPaymentBreakdown(shift)}
          locked={shiftLocked(shift)}
          onToggleLock={() => handleToggleLock(shift)}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDeleteEntry}
        />
      ))}

      {/* New Entry / Edit Entry Form */}
      <View onLayout={(e) => { formYPosition.current = e.nativeEvent.layout.y; }}>
        <SaleForm
          key={editingSale?.id ?? `new-${formResetKey}`}
          editingSale={editingSale}
          defaultShift={DEFAULT_SHIFT}
          saving={saving}
          onSave={handleSave}
          onCancelEdit={handleCancelEdit}
        />
      </View>

      {/* Shared confirmation modal — cross-platform, replaces Alert.alert() */}
      {modalConfig && (
        <ConfirmModal
          visible={!!pendingAction}
          title={modalConfig.title}
          message={modalConfig.message}
          confirmLabel={modalConfig.confirmLabel}
          cancelLabel={modalConfig.cancelLabel}
          destructive={modalConfig.destructive}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  date: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
});