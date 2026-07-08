// ============================================
// SERVORA ERP — Add Sale Screen (Controller)
// Composes: TotalCard, ShiftCard (x3), SaleForm
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

const DEFAULT_SHIFT: Shift = "Morning";

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

  // ── Guard against double-tap on lock/delete actions (Alert.alert can pop twice) ──
  const actionInFlight = useRef(false);

  // ── Scroll-to-form-on-edit: track the form's Y position via onLayout,
  //    then scroll there precisely when editing starts. ──
  const scrollViewRef = useRef<ScrollView>(null);
  const formYPosition = useRef(0);

  const scrollToForm = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: formYPosition.current, animated: true });
  }, []);

  const handleSave = useCallback(
    async (input: {
      shift: Shift;
      amount: string;
      paymentMethod: PaymentMethod;
      entryName: string;
    }) => {
      if (saving) return;

      // ── Edit mode: confirm before overwriting an existing entry ──
      if (editingSale) {
        Alert.alert(
          t("editSale") || "Update Sale",
          "Save changes to this entry?",
          [
            { text: t("cancel"), style: "cancel" },
            {
              text: t("saveSale") || "Save",
              onPress: async () => {
                const result = await saveSale(input, editingSale);
                if (result.success) {
                  setEditingSale(null);
                  setFormResetKey((k) => k + 1);
                } else {
                  Alert.alert(t("error"), result.error ?? "Something went wrong");
                }
              },
            },
          ]
        );
        return;
      }

      // ── New entry: save immediately, no confirmation needed ──
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

  const handleEditEntry = useCallback(
    (entry: SaleEntry) => {
      setEditingSale(entry);
      // Wait a tick for the form to populate/remount before scrolling to it.
      setTimeout(scrollToForm, 100);
    },
    [scrollToForm]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingSale(null);
  }, []);

  const handleDeleteEntry = useCallback(
    (entry: SaleEntry) => {
      if (actionInFlight.current) return;

      Alert.alert(
        t("deleteEntry"),
        t("deleteEntryConfirm"),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("delete"),
            style: "destructive",
            onPress: async () => {
              actionInFlight.current = true;
              try {
                const result = await removeSale(entry);
                if (!result.success) {
                  Alert.alert(t("error"), result.error ?? "Failed to delete");
                }
              } finally {
                actionInFlight.current = false;
              }
            },
          },
        ]
      );
    },
    [removeSale, t]
  );

  const handleToggleLock = useCallback(
    (shift: Shift) => {
      if (actionInFlight.current) return;

      const locked = shiftLocked(shift);
      const actionText = locked ? t("unlockShift") : t("lockShift");

      Alert.alert(
        actionText,
        locked ? t("unlockShiftConfirm") : t("lockShiftConfirm"),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: actionText,
            onPress: async () => {
              actionInFlight.current = true;
              try {
                const result = await toggleShiftLock(shift, locked);
                if (!result.success) {
                  Alert.alert(t("error"), result.error ?? "Failed to update lock");
                }
              } finally {
                actionInFlight.current = false;
              }
            },
          },
        ]
      );
    },
    [shiftLocked, toggleShiftLock, t]
  );

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

      {/* New Entry / Edit Entry Form — key forces a clean remount+reset
          after every successful save, whether creating or editing.
          onLayout tracks its Y position so Edit can scroll straight to it. */}
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