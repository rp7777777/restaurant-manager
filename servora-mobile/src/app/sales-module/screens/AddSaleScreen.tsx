// ============================================
// SERVORA ERP — Add Sale Screen (Controller)
// Composes: TotalCard, ShiftCard (x3), SaleForm
// ============================================

import React, { useState, useCallback } from "react";
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

  const handleSave = useCallback(
    async (input: {
      shift: Shift;
      amount: string;
      paymentMethod: PaymentMethod;
      entryName: string;
    }) => {
      const result = await saveSale(input, editingSale);
      if (result.success) {
        setEditingSale(null);
      } else {
        Alert.alert(t.error ?? "Error", result.error ?? "Something went wrong");
      }
    },
    [saveSale, editingSale, t]
  );

  const handleEditEntry = useCallback((entry: SaleEntry) => {
    setEditingSale(entry);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSale(null);
  }, []);

  const handleDeleteEntry = useCallback(
    (entry: SaleEntry) => {
      Alert.alert(
        t.deleteEntry ?? "Delete Entry",
        t.deleteEntryConfirm ?? "Are you sure you want to delete this entry?",
        [
          { text: t.cancel ?? "Cancel", style: "cancel" },
          {
            text: t.delete ?? "Delete",
            style: "destructive",
            onPress: async () => {
              const result = await removeSale(entry);
              if (!result.success) {
                Alert.alert(t.error ?? "Error", result.error ?? "Failed to delete");
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
      const locked = shiftLocked(shift);
      const actionText = locked ? (t.unlockShift ?? "Unlock Shift") : (t.lockShift ?? "Lock Shift");

      Alert.alert(
        actionText,
        locked
          ? (t.unlockShiftConfirm ?? "Unlock this shift for editing?")
          : (t.lockShiftConfirm ?? "Lock this shift? Entries cannot be edited after locking."),
        [
          { text: t.cancel ?? "Cancel", style: "cancel" },
          {
            text: actionText,
            onPress: async () => {
              const result = await toggleShiftLock(shift, locked);
              if (!result.success) {
                Alert.alert(t.error ?? "Error", result.error ?? "Failed to update lock");
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
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <Text style={[styles.title, { color: theme.text }]}>
        {t.dailySales ?? "Daily Sales"}
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
      <SaleForm
        editingSale={editingSale}
        defaultShift={DEFAULT_SHIFT}
        saving={saving}
        onSave={handleSave}
        onCancelEdit={handleCancelEdit}
      />
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