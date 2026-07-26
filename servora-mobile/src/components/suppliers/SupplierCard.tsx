// ============================================
// SERVORA ERP — SupplierCard Component
// ✅ Pure presentation — displays one Supplier in the list.
//    Mirrors InventoryCard.tsx's structure/styling for visual
//    consistency across Servora's list screens.
// ✅ Shows supplierCode + status badge — the two fields a user
//    scanning a supplier list needs at a glance (which code is
//    this, is it usable right now).
// PHASE 8.3
// ============================================

import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Supplier } from "../../modules/supplier-module/types/supplier";

interface SupplierCardProps {
  supplier: Supplier;
  onPress:  () => void;
}

function SupplierCard({ supplier, onPress }: SupplierCardProps) {
  const isActive = supplier.status === "ACTIVE";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.topRow}>
        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{supplier.name}</Text>
            <Text style={styles.code}>{supplier.supplierCode}</Text>
          </View>
          {supplier.companyName && (
            <Text style={styles.companyName} numberOfLines={1}>{supplier.companyName}</Text>
          )}
          {supplier.contactPerson && (
            <Text style={styles.contactPerson} numberOfLines={1}>{supplier.contactPerson}</Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
      </View>

      {(supplier.phone || supplier.email) && (
        <View style={styles.detailsRow}>
          {supplier.phone && (
            <View style={styles.detailItem}>
              <MaterialIcons name="call" size={13} color="#64748b" />
              <Text style={styles.detailText}>{supplier.phone}</Text>
            </View>
          )}
          {supplier.email && (
            <View style={styles.detailItem}>
              <MaterialIcons name="email" size={13} color="#64748b" />
              <Text style={styles.detailText} numberOfLines={1}>{supplier.email}</Text>
            </View>
          )}
        </View>
      )}

      {(supplier.country || supplier.currency || supplier.paymentTerms) && (
        <View style={styles.detailsRow}>
          {supplier.country && (
            <View style={styles.detailItem}>
              <MaterialIcons name="public" size={13} color="#94a3b8" />
              <Text style={styles.metaText}>{supplier.country}</Text>
            </View>
          )}
          {supplier.currency && (
            <View style={styles.detailItem}>
              <MaterialIcons name="attach-money" size={13} color="#94a3b8" />
              <Text style={styles.metaText}>{supplier.currency}</Text>
            </View>
          )}
          {supplier.paymentTerms && (
            <View style={styles.detailItem}>
              <MaterialIcons name="schedule" size={13} color="#94a3b8" />
              <Text style={styles.metaText}>{supplier.paymentTerms}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusBadgeText}>{supplier.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor:   "#fff",
    borderRadius:      12,
    padding:           12,
    marginBottom:      8,
    borderWidth:       1,
    borderColor:       "#e2e8f0",
  },
  topRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-start",
  },
  nameSection: { flex: 1, gap: 2 },
  nameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  name:          { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  code:          { fontSize: 11, fontWeight: "700", color: "#0369a1" },
  companyName:   { fontSize: 12, color: "#475569", fontWeight: "600" },
  contactPerson: { fontSize: 12, color: "#64748b" },
  detailsRow: {
    flexDirection: "row",
    gap:           16,
    marginTop:     2,
    flexWrap:      "wrap",
  },
  detailItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    marginTop:     6,
  },
  detailText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  metaText:   { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  badgeRow:   { flexDirection: "row", marginTop: 8 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
  },
  statusActive:   { backgroundColor: "#059669" },
  statusInactive: { backgroundColor: "#94a3b8" },
  statusBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});

export default memo(SupplierCard);