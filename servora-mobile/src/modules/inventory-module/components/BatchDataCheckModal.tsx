// ============================================
// SERVORA ERP — BatchDataCheckModal Component
// ✅ Opened by tapping an item's "data issue" badge in the inventory
//    table. Lists every batch of that item whose LIVE quantity
//    disagrees with its movement ledger (computed by
//    batch-reconciliation-service.ts computeBatchLedger(), passed in
//    ready-made — this component calculates nothing itself).
// ✅ Per batch it shows: received quantity, total issued, recorded
//    corrections, ledger quantity, live quantity and the difference,
//    with a plain-language explanation and a "count the store first"
//    prompt.
// ✅ Fix actions (only when canFix — OWNER + MANAGER via the
//    "fix_inventory_data" permission), each behind a confirm dialog:
//    - "Live stock is correct" → recordLedgerCorrection(): records the
//      missing correction, stock is NOT changed.
//    - "Ledger is correct" → syncBatchToLedger(): batch + item stock
//      set to the ledger in one transaction, with an audit record.
//      Disabled when the ledger is below 0 (cannot be real stock).
// ✅ Other roles see the same explanation and are told to ask an
//    Owner/Manager. Data refreshes live via the existing
//    subscriptions, so a fixed batch simply disappears from the list.
// ============================================

import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { InventoryItem } from "../types/inventory";
import {
  BatchLedgerCheck, recordLedgerCorrection, syncBatchToLedger,
} from "../services/batch-reconciliation-service";

const isWeb = Platform.OS === "web";

interface BatchDataCheckModalProps {
  visible:      boolean;
  onClose:      () => void;
  restaurantId: string;
  item:         InventoryItem | null;
  itemName:     string;
  checks:       BatchLedgerCheck[];
  canFix:       boolean;
}

function formatDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function confirmAction(title: string, message: string): Promise<boolean> {
  if (isWeb) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirm", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

function showMessage(title: string, message: string) {
  if (isWeb) window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export function BatchDataCheckModal({
  visible, onClose, restaurantId, item, itemName, checks, canFix,
}: BatchDataCheckModalProps) {
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);

  const handleLiveIsCorrect = async (check: BatchLedgerCheck) => {
    const ok = await confirmAction(
      "Live stock is correct",
      `Batch ${check.batchNo}: a correction of ${signed(check.difference)} ${check.unit} will be recorded ` +
      `on ${formatDateTime(check.suggestedCorrectionAt)}.\n\n` +
      `Stock stays ${check.liveQuantity} ${check.unit}. Only the history is completed.`
    );
    if (!ok) return;
    setBusyBatchId(check.batchId);
    try {
      await recordLedgerCorrection(restaurantId, check);
    } catch (err: any) {
      showMessage("Could not record correction", err?.message ?? "Unknown error");
    } finally {
      setBusyBatchId(null);
    }
  };

  const handleLedgerIsCorrect = async (check: BatchLedgerCheck) => {
    if (!item) {
      showMessage("Item not found", "Close this window and try again.");
      return;
    }
    const ok = await confirmAction(
      "Ledger is correct",
      `Batch ${check.batchNo} will change from ${check.liveQuantity} to ${check.ledgerQuantity} ${check.unit}, ` +
      `and the item stock will be recalculated.\n\nAn audit record is saved.`
    );
    if (!ok) return;
    setBusyBatchId(check.batchId);
    try {
      await syncBatchToLedger(restaurantId, item, check);
    } catch (err: any) {
      showMessage("Could not update stock", err?.message ?? "Unknown error");
    } finally {
      setBusyBatchId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <MaterialIcons name="fact-check" size={20} color="#b45309" />
            <Text style={styles.title} numberOfLines={1}>Batch Data Check · {itemName}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color="#334155" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {checks.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="check-circle" size={28} color="#059669" />
                <Text style={styles.emptyText}>
                  Every batch of this item matches its movement records.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.hintBox}>
                  <MaterialIcons name="inventory" size={16} color="#1e40af" />
                  <Text style={styles.hintText}>
                    Count this item in the store first. Then choose which number is correct for each batch.
                  </Text>
                </View>

                {checks.map((check) => {
                  const busy = busyBatchId === check.batchId;
                  const ledgerBelowZero = check.ledgerQuantity < 0;
                  return (
                    <View key={check.batchId} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.batchNo}>Batch {check.batchNo}</Text>
                        {check.isArchived && <Text style={styles.archivedTag}>Archived</Text>}
                      </View>

                      <View style={styles.row}>
                        <Text style={styles.label}>Received ({check.receivedDate})</Text>
                        <Text style={styles.value}>{check.originalQuantity} {check.unit}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Issued (kitchen / waste / transfer)</Text>
                        <Text style={styles.value}>−{check.totalDeducted}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Recorded corrections</Text>
                        <Text style={styles.value}>{signed(check.totalCorrected)}</Text>
                      </View>
                      <View style={[styles.row, styles.rowStrong]}>
                        <Text style={styles.labelStrong}>By records (ledger)</Text>
                        <Text style={[styles.valueStrong, ledgerBelowZero && styles.negative]}>
                          {check.ledgerQuantity} {check.unit}
                        </Text>
                      </View>
                      <View style={[styles.row, styles.rowStrong]}>
                        <Text style={styles.labelStrong}>Live stock (now)</Text>
                        <Text style={styles.valueStrong}>{check.liveQuantity} {check.unit}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Difference</Text>
                        <Text style={[styles.value, styles.diff]}>{signed(check.difference)} {check.unit}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Last movement</Text>
                        <Text style={styles.value}>{formatDateTime(check.lastMovementAt)}</Text>
                      </View>

                      <Text style={styles.explain}>
                        {ledgerBelowZero
                          ? "More was issued than received according to the records — the batch was most likely topped up with Edit Batch without a record."
                          : "The live quantity was changed at some point without a matching record."}
                        {check.hasInvalidRecord ? " One movement record for this batch is malformed and was skipped." : ""}
                      </Text>

                      {canFix ? (
                        busy ? (
                          <ActivityIndicator style={styles.busy} color="#1e40af" />
                        ) : (
                          <View style={styles.actions}>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnPrimary]}
                              onPress={() => handleLiveIsCorrect(check)}
                              disabled={check.difference === 0}
                            >
                              <Text style={styles.btnPrimaryText}>
                                Live stock is correct ({check.liveQuantity})
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSecondary, ledgerBelowZero && styles.btnDisabled]}
                              onPress={() => handleLedgerIsCorrect(check)}
                              disabled={ledgerBelowZero || check.difference === 0}
                            >
                              <Text style={[styles.btnSecondaryText, ledgerBelowZero && styles.btnDisabledText]}>
                                Ledger is correct ({check.ledgerQuantity})
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )
                      ) : (
                        <Text style={styles.noPermission}>
                          Only an Owner or Manager can fix this. Please let them know.
                        </Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", alignItems: "center", padding: 16,
  },
  sheet: {
    width: "100%", maxWidth: 520, maxHeight: "90%", backgroundColor: "#fff", borderRadius: 10, overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  title: { flex: 1, fontSize: 15, fontWeight: "800", color: "#0f172a" },
  body: { flexGrow: 0 },
  bodyContent: { padding: 14, gap: 12 },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyText: { fontSize: 13, color: "#334155", textAlign: "center" },
  hintBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: "#eff6ff", borderRadius: 8, padding: 10,
  },
  hintText: { flex: 1, fontSize: 12, color: "#1e3a8a", fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, gap: 4 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  batchNo: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  archivedTag: {
    fontSize: 10, fontWeight: "700", color: "#64748b", backgroundColor: "#f1f5f9",
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: "hidden",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  rowStrong: { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 4 },
  label: { fontSize: 12, color: "#475569" },
  value: { fontSize: 12, color: "#0f172a", fontWeight: "600" },
  labelStrong: { fontSize: 13, color: "#0f172a", fontWeight: "700" },
  valueStrong: { fontSize: 13, color: "#0f172a", fontWeight: "800" },
  negative: { color: "#b91c1c" },
  diff: { color: "#b45309", fontWeight: "800" },
  explain: { fontSize: 12, color: "#334155", marginTop: 6, lineHeight: 17 },
  actions: { gap: 8, marginTop: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: "center" },
  btnPrimary: { backgroundColor: "#1e40af" },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnSecondary: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#1e40af" },
  btnSecondaryText: { color: "#1e40af", fontWeight: "700", fontSize: 13 },
  btnDisabled: { borderColor: "#cbd5e1" },
  btnDisabledText: { color: "#94a3b8" },
  busy: { marginTop: 12 },
  noPermission: { fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 8 },
});