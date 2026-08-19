// ============================================
// SERVORA ERP — IssueKitchenRequestModal Component
// ✅ EVOLUTIONARY EXTRACTION — the entire Issue Stock modal (linking
//    flow + quantity input + note + confirm/cancel) moved verbatim
//    from index.tsx. ALL business logic (issueKitchenRequest() call,
//    FEFO deduction, transaction safety) remains in
//    kitchen-request-service.ts — this component only captures
//    input and calls the onConfirm callback the parent supplies.
// ✅ Inventory-linking flow preserved EXACTLY: for a request with no
//    inventoryId yet, search/pick an Inventory item; a suggested
//    exact-name match is shown but always requires explicit
//    confirmation (never silently auto-applied).
// ✅ This component owns its OWN local state for the form fields
//    (issueQty/issueNote/linkItemQuery/linkedItem/showLinkPicker) —
//    reset via the useEffect below whenever `request` changes (i.e.
//    whenever the parent opens this modal for a different request),
//    matching the original openIssueModal()'s reset behavior exactly.
// ✅ processing state is now a PROP (owned by the parent, since the
//    parent also needs to know whether an issue is in flight to
//    prevent, e.g., closing the modal mid-submit) rather than local
//    state — this component reads it to disable buttons/show the
//    spinner, but doesn't own the source of truth.
// FROZEN
// ============================================

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Modal, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { IngredientRequest } from "../../kitchen-module/types/kitchen-types";
import { InventoryItem } from "../../../modules/inventory-module/types/inventory";

interface IssueKitchenRequestModalProps {
  visible:          boolean;
  request:          IngredientRequest | null;
  inventoryItems:   InventoryItem[];
  processing:       boolean;
  theme: {
    surface: string; text: string; textSecondary: string; bg: string; border: string;
  };
  onClose:   () => void;
  onConfirm: (params: { quantity: number; inventoryId: string; note: string }) => void;
}

export function IssueKitchenRequestModal({
  visible, request, inventoryItems, processing, theme, onClose, onConfirm,
}: IssueKitchenRequestModalProps) {
  const [issueQty, setIssueQty] = useState("");
  const [issueNote, setIssueNote] = useState("");
  const [linkItemQuery, setLinkItemQuery] = useState("");
  const [linkedItem, setLinkedItem] = useState<InventoryItem | undefined>(undefined);
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  // ✅ Reset form state whenever a new request is opened — mirrors
  // the original openIssueModal()'s behavior exactly.
  useEffect(() => {
    if (!request) return;
    setIssueQty(request.orderQuantity.toString());
    setIssueNote("");
    setLinkItemQuery("");
    setShowLinkPicker(false);
    if (!request.inventoryId) {
      const suggested = inventoryItems.find(
        (it) => it.itemName.toLowerCase() === request.itemName.toLowerCase()
      );
      setLinkedItem(suggested);
    } else {
      setLinkedItem(undefined);
    }
  }, [request?.id]);

  if (!request) return null;

  const resolvedInventoryId = request.inventoryId ?? linkedItem?.id;
  const canConfirm = !processing && !!resolvedInventoryId;

  const handleConfirm = () => {
    const qty = Number(issueQty);
    if (!qty || qty <= 0 || !resolvedInventoryId) return;
    onConfirm({ quantity: qty, inventoryId: resolvedInventoryId, note: issueNote.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.issueModal, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Issue Stock</Text>
          <Text style={[styles.modalItemName, { color: theme.text }]}>{request.itemName}</Text>
          <Text style={[styles.modalSubText, { color: theme.textSecondary }]}>
            Requested: {request.orderQuantity} {request.unit}
          </Text>

          {!request.inventoryId && (
            <View style={styles.linkSection}>
              <View style={styles.linkWarningRow}>
                <MaterialIcons name="link-off" size={14} color="#d97706" />
                <Text style={styles.linkWarningText}>Inventory Item Not Linked</Text>
              </View>

              {linkedItem ? (
                <View style={styles.suggestedMatchRow}>
                  <View style={styles.suggestedMatchLeft}>
                    <MaterialIcons name="check-circle" size={14} color="#059669" />
                    <Text style={[styles.suggestedMatchText, { color: theme.text }]}>
                      {linkItemQuery.trim() ? "Selected" : "Suggested match"}: {linkedItem.itemName}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setLinkedItem(undefined); setShowLinkPicker(true); }}>
                    <Text style={styles.changeLinkText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <MaterialIcons name="search" size={14} color={theme.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder={`Search Inventory for "${request.itemName}"...`}
                      placeholderTextColor={theme.textSecondary}
                      value={linkItemQuery}
                      onChangeText={(text) => { setLinkItemQuery(text); setShowLinkPicker(true); }}
                      onFocus={() => setShowLinkPicker(true)}
                    />
                  </View>
                  {showLinkPicker && linkItemQuery.trim().length >= 2 && (
                    <ScrollView style={[styles.itemPickerList, { backgroundColor: theme.bg, borderColor: theme.border }]} nestedScrollEnabled>
                      {inventoryItems
                        .filter((it) => it.itemName.toLowerCase().includes(linkItemQuery.trim().toLowerCase()))
                        .slice(0, 8)
                        .map((it) => (
                          <TouchableOpacity
                            key={it.id}
                            style={styles.itemPickerRow}
                            onPress={() => { setLinkedItem(it); setShowLinkPicker(false); }}
                          >
                            <Text style={[styles.itemPickerRowText, { color: theme.text }]}>{it.itemName}</Text>
                            <Text style={[styles.itemPickerRowSub, { color: theme.textSecondary }]}>
                              {it.currentStock} {it.unit} in stock
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  )}
                </>
              )}
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 14 }]}>
            ISSUE QUANTITY ({request.unit})
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={issueQty}
              onChangeText={setIssueQty}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <Text style={[styles.unitText, { color: theme.textSecondary }]}>{request.unit}</Text>
          </View>
          <View style={[styles.infoBox, { backgroundColor: "#10b98115" }]}>
            <MaterialIcons name="info" size={14} color="#10b981" />
            <Text style={styles.infoText}>
              Inventory will auto-deduct {issueQty || "0"} {request.unit} of {request.itemName} via FEFO
            </Text>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>NOTE (OPTIONAL)</Text>
          <TextInput
            style={[styles.noteInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. only 18kg in stock, issuing partial"
            placeholderTextColor={theme.textSecondary}
            value={issueNote}
            onChangeText={setIssueNote}
            multiline
          />

          <View style={styles.modalBtns}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.border }]}
              onPress={onClose}
              disabled={processing}
            >
              <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#10b981" }, !canConfirm && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              {processing ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <MaterialIcons name="done" size={16} color="#fff" />
                  <Text style={styles.modalBtnText}>Confirm Issue</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  issueModal: { width: "100%", maxWidth: 420, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  modalItemName: { fontSize: 15, fontWeight: "700" },
  modalSubText: { fontSize: 12, marginBottom: 8 },
  linkSection: { marginTop: 8, marginBottom: 4 },
  linkWarningRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  linkWarningText: { color: "#d97706", fontSize: 12, fontWeight: "700" },
  suggestedMatchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  suggestedMatchLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  suggestedMatchText: { fontSize: 12, fontWeight: "600" },
  changeLinkText: { color: "#0369a1", fontSize: 12, fontWeight: "700" },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 14 },
  itemPickerList: { maxHeight: 160, borderWidth: 1, borderRadius: 8, marginTop: 4 },
  itemPickerRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  itemPickerRowText: { fontSize: 13, fontWeight: "600" },
  itemPickerRowSub: { fontSize: 11, marginTop: 2 },
  unitText: { fontSize: 13, fontWeight: "600" },
  fieldLabel: { fontSize: 11, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, marginTop: 8 },
  infoText: { fontSize: 11, color: "#059669", flex: 1 },
  noteInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 60, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10,
  },
  modalBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});