// ============================================
// SERVORA ERP — InventoryStatusBadge Component
// ✅ Renders the badge row (Out of Stock / Low Stock / Expired /
//    Expiring Soon) for a single item. Extracted from InventoryCard,
//    which previously built this JSX inline — the underlying
//    priority logic now lives in inventory-utils.ts's
//    resolveAllStockStatuses(), so this component is pure
//    presentation: it maps the resolved status list onto styled
//    pills, nothing else.
// ✅ Renders nothing (null) when the item has no attention-worthy
//    status — uses hasAnyStockStatus() from inventory-utils.ts so
//    this decision uses the exact same rule as the status list
//    itself, rather than re-deriving it.
// ✅ Colors/labels/icons all come from inventory-utils.ts's
//    STATUS_DISPLAY table — this component owns NO status styling
//    decisions of its own, so a future re-theme only touches one
//    file.
// FROZEN
// ============================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem, ExpiryStatus } from "../types/inventory";
import { resolveAllStockStatuses, hasAnyStockStatus } from "../utils/inventory-utils";

interface InventoryStatusBadgeProps {
  item:         InventoryItem;
  expiryStatus: ExpiryStatus;
}

export function InventoryStatusBadge({ item, expiryStatus }: InventoryStatusBadgeProps) {
  if (!hasAnyStockStatus(item, expiryStatus)) return null;

  const statuses = resolveAllStockStatuses(item, expiryStatus);

  return (
    <View style={styles.badgeRow}>
      {statuses.map((status) => (
        <View key={status.kind} style={[styles.statusBadge, { backgroundColor: status.color }]}>
          <MaterialIcons name={status.icon as keyof typeof MaterialIcons.glyphMap} size={11} color="#fff" />
          <Text style={styles.statusBadgeText}>{status.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  statusBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
  },
  statusBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});