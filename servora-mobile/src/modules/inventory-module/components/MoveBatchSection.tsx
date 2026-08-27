// ============================================
// SERVORA ERP — MoveBatchSection Component
// ✅ NEW — an isolated, collapsible section (toggle button →
//    search+picker) for correcting a batch that was received against
//    the WRONG InventoryItem. Embedded inside EditBatchModal.tsx,
//    but kept as its own component for separation of concerns: this
//    component owns ONLY the "which item should this batch actually
//    belong to" search/selection UI — it never calls
//    moveBatchToItem() itself, it only reports the selected target
//    item back to its parent via onSelectTarget.
// ✅ Search is DELIBERATELY category-agnostic (searches ALL items by
//    name, not scoped to the batch's current category) — unlike
//    useExistingItemSearch.ts (used by Add Item's Supplier→Category
//    flow, which requires a category first). This is intentional:
//    the whole point of this feature is correcting a MISTAKE — the
//    user may not know or trust which category the batch's item
//    actually belongs to, since it went to the wrong item in the
//    first place. Requiring a category selection first would be
//    exactly the kind of assumption that caused the original error.
// ✅ Excludes the batch's CURRENT item from search results (moving a
//    batch "to itself" is meaningless and moveBatchToItem() rejects
//    it anyway — filtering it out here avoids ever offering a
//    confusing no-op option).
// ✅ Debounced search (250ms), same convention as
//    useExistingItemSearch.ts.
// FROZEN
// ============================================

import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";

interface MoveBatchSectionProps {
  allItems:           InventoryItem[];
  currentItemId:      string;
  selectedTarget:     InventoryItem | undefined;
  onSelectTarget:      (item: InventoryItem | undefined) => void;
}

export function MoveBatchSection({
  allItems, currentItemId, selectedTarget, onSelectTarget,
}: MoveBatchSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQueryRaw] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const matches = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const candidates = allItems.filter((it) => it.id !== currentItemId);
    if (!q) return candidates.slice(0, 15);
    return candidates
      .filter((it) => it.itemName.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allItems, currentItemId, debouncedQuery]);

  const handleToggle = () => {
    if (expanded) {
      // Collapsing — clear any in-progress selection so re-opening
      // starts fresh.
      onSelectTarget(undefined);
      setSearchQueryRaw("");
    }
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.toggleBtn} onPress={handleToggle}>
        <MaterialIcons name="swap-horiz" size={16} color="#0369a1" />
        <Text style={styles.toggleBtnText}>
          {expanded ? "Cancel — keep this batch here" : "Wrong item? Move this batch"}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>
          {selectedTarget ? (
            <View style={styles.selectedRow}>
              <View style={styles.selectedBadge}>
                <MaterialIcons name="check-circle" size={16} color="#059669" />
                <Text style={styles.selectedText}>Move to: {selectedTarget.itemName}</Text>
              </View>
              <TouchableOpacity onPress={() => onSelectTarget(undefined)}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.searchRow}>
                <MaterialIcons name="search" size={16} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQueryRaw}
                  placeholder="Search the correct item..."
                  autoFocus
                />
              </View>
              <ScrollView style={styles.resultsList} nestedScrollEnabled>
                {matches.length === 0 ? (
                  <Text style={styles.noResultsText}>No matching items found</Text>
                ) : (
                  matches.map((it) => (
                    <TouchableOpacity
                      key={it.id}
                      style={styles.resultRow}
                      onPress={() => onSelectTarget(it)}
                    >
                      <Text style={styles.resultItemName}>{it.itemName}</Text>
                      <Text style={styles.resultItemSub}>
                        {it.currentStock} {it.unit} in stock
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8,
  },
  toggleBtnText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
  panel: {
    marginTop: 8, padding: 10, borderRadius: 8,
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
  },
  selectedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectedBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, flex: 1,
  },
  selectedText: { fontSize: 12, fontWeight: "700", color: "#065f46" },
  changeText: { color: "#0369a1", fontSize: 12, fontWeight: "700", marginLeft: 10 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 13, color: "#1e293b" },
  resultsList: { maxHeight: 160, marginTop: 6 },
  noResultsText: { fontSize: 11, color: "#94a3b8", fontStyle: "italic", padding: 8 },
  resultRow: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  resultItemName: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  resultItemSub: { fontSize: 10, color: "#94a3b8", marginTop: 1 },
});