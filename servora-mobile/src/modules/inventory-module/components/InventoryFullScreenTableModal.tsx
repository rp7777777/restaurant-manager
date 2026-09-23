// ============================================
// SERVORA ERP — InventoryFullScreenTableModal Component
// ✅ Migration Step 3 — wraps HistoricalInventoryTableView, with its
//    own independent date navigator.
// ✅ Migration Step 5 — since HistoricalInventoryTableView now
//    REQUIRES todayISO and categoryMapForExpiry props (needed for
//    the Today-mode stockStatus filter's "expiringSoon"
//    classification), this modal now builds its own categoryMap
//    (from the categories it already receives) and forwards
//    restaurantDefaultExpiryAlertDays through from its caller.
//    stockStatus is deliberately NOT wired here — opening Full
//    Screen does not carry over the underlying screen's currently-
//    active stock-status card filter (a UX choice, not a bug: Full
//    Screen is a fresh, unfiltered view of the selected date; if
//    carrying the filter forward is wanted later, that can be added
//    as an additional prop without further architecture change).
// ✅ Independent selectedDate state, re-synced to initialDate + reset
//    search/category/sort EVERY time the modal opens.
// ✅ FIX — HistoricalInventoryTableView now renders its OWN date
//    navigator (commit 00194af) and REQUIRES dateLabel/onPreviousDay/
//    onNextDay/isNextDayDisabled. This modal was never updated, so it
//    failed to compile and would have shown two date navigators.
//    The modal's own dateNav row is removed; this modal still OWNS
//    selectedDate and just passes the label/handlers down (same
//    contract InventoryScreen.tsx already uses).
// ✅ Letterhead props (restaurantName/Address/Phone/Email/VatNumber)
//    forwarded so Full Screen shows the same letterhead as the main
//    table. All optional — letterhead simply hides if absent.
// FROZEN
// ============================================

import React, { useState, useEffect, useMemo } from "react";
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
  // ✅ NEW — forwarded to HistoricalInventoryTableView's required
  // expiry-classification props.
  restaurantDefaultExpiryAlertDays?: number;
  // ✅ NEW — forwarded to HistoricalInventoryTableView's letterhead.
  restaurantName?:      string;
  restaurantAddress?:   string;
  restaurantPhone?:     string;
  restaurantEmail?:     string;
  restaurantVatNumber?: string;
}

export function InventoryFullScreenTableModal({
  visible, onClose, restaurantId, items, categories, initialDate, today, onItemPress,
  restaurantDefaultExpiryAlertDays,
  restaurantName, restaurantAddress, restaurantPhone, restaurantEmail, restaurantVatNumber,
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

  // ✅ NEW — required by HistoricalInventoryTableView's
  // categoryMapForExpiry prop.
  const categoryMapForExpiry = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const handleItemPress = (item: InventoryItem) => {
    onClose();
    onItemPress(item);
  };

  const isNextDisabled = selectedDate >= today;

  const goToPreviousDay = () => setSelectedDate((d) => shiftDate(d, -1));
  const goToNextDay = () => {
    // Guard mirrors the disabled arrow — never navigate past today.
    setSelectedDate((d) => (d >= today ? d : shiftDate(d, 1)));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Inventory — Full View</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <HistoricalInventoryTableView
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          restaurantAddress={restaurantAddress}
          restaurantPhone={restaurantPhone}
          restaurantEmail={restaurantEmail}
          restaurantVatNumber={restaurantVatNumber}
          selectedDate={selectedDate}
          dateLabel={formatDateLabel(selectedDate, today)}
          onPreviousDay={goToPreviousDay}
          onNextDay={goToNextDay}
          isNextDayDisabled={isNextDisabled}
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
          todayISO={today}
          categoryMapForExpiry={categoryMapForExpiry}
          restaurantDefaultExpiryAlertDays={restaurantDefaultExpiryAlertDays}
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
});