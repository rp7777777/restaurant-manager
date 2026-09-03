// ============================================
// SERVORA ERP — InventoryFullScreenTableModal Component
// ✅ Migration Step 3 — now wraps HistoricalInventoryTableView,
//    reusing that component's full feature set (search, category
//    wrap-filter, sort, Issue column, closing-quantity semantics,
//    onItemPress -> real InventoryItem) instead of duplicating
//    filter/search logic here.
// ✅ Independent selectedDate state, re-synced to initialDate + reset
//    search/category/sort EVERY time the modal opens (visible
//    becomes true) — a stale search/category/sort or date from a
//    PREVIOUS Full Screen session never silently persists into a new
//    one.
// ✅ handleItemPress closes THIS modal before delegating to the
//    parent's onItemPress — avoids nested-Modal layering risk.
// FROZEN
// ============================================

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import { Category } from "../types/category";
import { HistoricalInventoryTableView } from "./HistoricalInventoryTableView";

function shiftDate(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + deltaDays * 86400000;
  const result = new Date(utcMs);
  const yyyy = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(result.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

interface InventoryFullScreenTableModalProps {
  visible:         boolean;
  onClose:         () => void;
  restaurantId:    string;
  items:           InventoryItem[];
  categories:      Category[];
  initialDate:     string;
  today:           string;
  onItemPress:     (item: InventoryItem) => void;
}

export function InventoryFullScreenTableModal({
  visible, onClose, restaurantId, items, categories, initialDate, today, onItemPress,
}: InventoryFullScreenTableModalProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<"name-asc" | "stock-asc">("name-asc");

  useEffect(() => {
    if (!visible) return;
    setSelectedDate(initialDate);
    setSearchQuery("");
    setCategoryId(null);
    setSort("name-asc");
  }, [visible, initialDate]);

  const handleItemPress = (item: InventoryItem) => {
    onClose();
    onItemPress(item);
  };

  const isNextDisabled = selectedDate >= today;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Inventory — Full View</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setSelectedDate((d) => shiftDate(d, -1))} style={styles.dateNavArrow}>
            <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>{formatDateLabel(selectedDate, today)}</Text>
          <TouchableOpacity
            onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
            style={[styles.dateNavArrow, isNextDisabled && styles.dateNavArrowDisabled]}
            disabled={isNextDisabled}
          >
            <MaterialIcons name="chevron-right" size={22} color={isNextDisabled ? "#cbd5e1" : "#1e293b"} />
          </TouchableOpacity>
        </View>

        <HistoricalInventoryTableView
          restaurantId={restaurantId}
          selectedDate={selectedDate}
          categories={categories}
          inventoryItems={items}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          onItemPress={handleItemPress}
          sort={sort}
          setSort={setSort}
          isHistorical={selectedDate !== today}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8,
    padding: 10, paddingTop: Platform.OS === "web" ? 16 : 44,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  closeBtn: { padding: 4 },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  dateNavArrow: { padding: 4 },
  dateNavArrowDisabled: { opacity: 0.5 },
  dateNavLabel: { fontSize: 14, fontWeight: "800", color: "#1e293b", minWidth: 160, textAlign: "center" },
});