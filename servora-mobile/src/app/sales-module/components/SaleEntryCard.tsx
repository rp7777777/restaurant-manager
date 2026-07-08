// ============================================
// SERVORA ERP — Sale Entry Card Component
// Single sale entry row: payment, amount, entry name, actions
// FROZEN
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { SaleEntry } from "../types/sales-types";
import { PAYMENT_COLORS } from "../constants/payment-colors";
import { getEntryDisplayName } from "../utils/sale-formatters";

interface SaleEntryCardProps {
  entry: SaleEntry;
  onEdit: () => void;
  onDelete: () => void;
}

export function SaleEntryCard({ entry, onEdit, onDelete }: SaleEntryCardProps) {
  const { theme, t, fmt } = useApp();

  const paymentColor = PAYMENT_COLORS[entry.paymentMethod];
  const displayName = getEntryDisplayName(entry);

  const handleEditPress = () => {
    Alert.alert(
      t("editEntry") || "Edit Entry",
      "Are you sure you want to edit this entry?",
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("editEntry") || "Edit", onPress: onEdit },
      ]
    );
  };

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.left}>
        <View style={styles.paymentRow}>
          <View style={[styles.dot, { backgroundColor: paymentColor }]} />
          <Text style={[styles.paymentText, { color: theme.textSecondary }]}>
            {entry.paymentMethod}
          </Text>
          {entry.locked && (
            <MaterialIcons name="lock" size={12} color={theme.textSecondary} style={styles.lockIcon} />
          )}
        </View>
        {!!displayName && (
          <Text style={[styles.entryName, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, { color: theme.text }]}>{fmt(entry.amount)}</Text>
        {!entry.locked && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleEditPress} style={styles.actionButton}>
              <MaterialIcons name="edit" size={16} color={theme.primary} />
              <Text style={[styles.actionText, { color: theme.primary }]}>
                {t("editEntry") || "Edit"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
              <MaterialIcons name="delete-outline" size={16} color={theme.error} />
              <Text style={[styles.actionText, { color: theme.error }]}>
                {t("delete") || "Delete"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  left: {
    flex: 1,
    marginRight: 8,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paymentText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  lockIcon: {
    marginLeft: 2,
  },
  entryName: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 3,
  },
  right: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    padding: 2,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "600",
  },
});