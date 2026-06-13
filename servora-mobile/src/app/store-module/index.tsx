// ============================================
// SERVORA ERP — Store Module
// Approve requests + Issue stock + Auto inventory
// ============================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Platform, RefreshControl, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, serverTimestamp, where,
  addDoc, getDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useApp } from "../../context/AppContext";

// ── Types ────────────────────────────────────
type RequestStatus = "PENDING" | "APPROVED" | "ISSUED" | "REJECTED";

interface KitchenRequest {
  id: string;
  itemName: string;
  closingStock: number;
  minimumLevel: number;
  orderQuantity: number;
  unit: string;
  requiredDate: string;
  requestedBy: string;
  note: string;
  status: RequestStatus;
  issuedQuantity?: number;
  issuedBy?: string;
  issuedAt?: unknown;
  restaurantId: string;
  createdAt?: unknown;
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#3b82f6",
  ISSUED: "#10b981",
  REJECTED: "#ef4444",
};

const STATUS_ICONS: Record<RequestStatus, string> = {
  PENDING: "schedule",
  APPROVED: "check-circle",
  ISSUED: "done-all",
  REJECTED: "cancel",
};

export default function StoreScreen() {
  const { theme, restaurantId, userProfile } = useApp();

  const [requests, setRequests] = useState<KitchenRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [selectedRequest, setSelectedRequest] = useState<KitchenRequest | null>(null);
  const [issueQty, setIssueQty] = useState("");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // ── Load requests ─────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, "restaurants", restaurantId, "kitchenRequests"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
      setRefreshing(false);
    }, () => setLoading(false));
  }, [restaurantId]);

  // ── Approve request ───────────────────────
  const handleApprove = async (req: KitchenRequest) => {
    if (!restaurantId) return;
    setProcessing(true);
    try {
      await updateDoc(
        doc(db, "restaurants", restaurantId, "kitchenRequests", req.id),
        {
          status: "APPROVED",
          approvedBy: userProfile?.name ?? auth.currentUser?.email ?? "Store",
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      Alert.alert("✅ Approved", `${req.itemName} request approved`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject request ────────────────────────
  const handleReject = (req: KitchenRequest) => {
    Alert.alert(
      "Reject Request",
      `Reject ${req.itemName} request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject", style: "destructive",
          onPress: async () => {
            await updateDoc(
              doc(db, "restaurants", restaurantId, "kitchenRequests", req.id),
              {
                status: "REJECTED",
                rejectedBy: userProfile?.name ?? "Store",
                rejectedAt: serverTimestamp(),
              }
            );
          },
        },
      ]
    );
  };

  // ── Open issue modal ──────────────────────
  const openIssueModal = (req: KitchenRequest) => {
    setSelectedRequest(req);
    setIssueQty(req.orderQuantity.toString());
    setShowIssueModal(true);
  };

  // ── Issue stock ───────────────────────────
  const handleIssue = async () => {
    if (!selectedRequest || !restaurantId) return;
    const qty = Number(issueQty);
    if (!qty || qty <= 0) {
      Alert.alert("Error", "Enter valid quantity");
      return;
    }

    setProcessing(true);
    try {
      // Update request status
      await updateDoc(
        doc(db, "restaurants", restaurantId, "kitchenRequests", selectedRequest.id),
        {
          status: "ISSUED",
          issuedQuantity: qty,
          issuedBy: userProfile?.name ?? auth.currentUser?.email ?? "Store",
          issuedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      // Auto deduct from inventory
      const inventorySnap = await new Promise<any>((resolve) => {
        const unsub = onSnapshot(
          query(
            collection(db, "restaurants", restaurantId, "inventory"),
            where("itemName", "==", selectedRequest.itemName)
          ),
          (snap) => { unsub(); resolve(snap); }
        );
      });

      if (!inventorySnap.empty) {
        const inventoryDoc = inventorySnap.docs[0];
        const currentQty = Number(inventoryDoc.data().quantity ?? 0);
        const newQty = Math.max(0, currentQty - qty);
        const minStock = Number(inventoryDoc.data().minStock ?? 0);

        await updateDoc(
          doc(db, "restaurants", restaurantId, "inventory", inventoryDoc.id),
          {
            quantity: newQty,
            isLowStock: newQty <= minStock,
            updatedAt: serverTimestamp(),
          }
        );
      }

      // Log issue transaction
      await addDoc(
        collection(db, "restaurants", restaurantId, "stockIssues"),
        {
          itemName: selectedRequest.itemName,
          unit: selectedRequest.unit,
          requestedQty: selectedRequest.orderQuantity,
          issuedQty: qty,
          issuedBy: userProfile?.name ?? "Store",
          kitchenRequestId: selectedRequest.id,
          restaurantId,
          createdAt: serverTimestamp(),
        }
      );

      setShowIssueModal(false);
      Alert.alert(
        "✅ Issued",
        `${qty} ${selectedRequest.unit} of ${selectedRequest.itemName} issued!\nInventory auto-updated.`
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to issue");
    } finally {
      setProcessing(false);
    }
  };

  const onRefresh = useCallback(() => setRefreshing(true), []);

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const approvedRequests = requests.filter((r) => r.status === "APPROVED");
  const displayRequests = activeTab === "pending"
    ? [...pendingRequests, ...approvedRequests]
    : requests;

  const formatDate = (ts: any): string => {
    if (!ts) return "";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch { return ""; }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
    >
      {/* Header */}
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>STORE</Text>
            <Text style={styles.headerSub}>Stock Issue & Requests</Text>
          </View>
          {pendingRequests.length > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifText}>{pendingRequests.length} Pending</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Pending", value: pendingRequests.length, color: "#f59e0b", icon: "schedule" },
            { label: "Approved", value: requests.filter(r => r.status === "APPROVED").length, color: "#3b82f6", icon: "check-circle" },
            { label: "Issued", value: requests.filter(r => r.status === "ISSUED").length, color: "#10b981", icon: "done-all" },
            { label: "Rejected", value: requests.filter(r => r.status === "REJECTED").length, color: "#ef4444", icon: "cancel" },
          ].map(({ label, value, color, icon }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: theme.card }]}>
              <MaterialIcons name={icon as any} size={20} color={color} />
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: theme.card }]}>
          {(["pending", "all"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, {
                color: activeTab === tab ? "#fff" : theme.textSecondary,
              }]}>
                {tab === "pending" ? `Pending & Approved (${pendingRequests.length + requests.filter(r => r.status === "APPROVED").length})` : `All Requests (${requests.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Requests */}
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : displayRequests.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
            <MaterialIcons name="inventory" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {activeTab === "pending" ? "No pending requests" : "No requests yet"}
            </Text>
          </View>
        ) : (
          displayRequests.map((req) => {
            const statusColor = STATUS_COLORS[req.status];
            const statusIcon = STATUS_ICONS[req.status];
            return (
              <View
                key={req.id}
                style={[
                  styles.requestCard,
                  { backgroundColor: theme.card },
                  req.status === "PENDING" && { borderLeftWidth: 3, borderLeftColor: "#f59e0b" },
                  req.status === "APPROVED" && { borderLeftWidth: 3, borderLeftColor: "#3b82f6" },
                ]}
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={[styles.itemName, { color: theme.text }]}>{req.itemName}</Text>
                    <Text style={[styles.cardDate, { color: theme.textSecondary }]}>
                      By: {req.requestedBy} · {formatDate(req.createdAt)}
                    </Text>
                    <Text style={[styles.cardDate, { color: theme.textSecondary }]}>
                      Required: {req.requiredDate}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <MaterialIcons name={statusIcon as any} size={12} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{req.status}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={[styles.detailsRow, { borderTopColor: theme.border }]}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Closing</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>{req.closingStock} {req.unit}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Min Level</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>{req.minimumLevel} {req.unit}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Requested</Text>
                    <Text style={[styles.detailValue, { color: "#f59e0b", fontWeight: "800" }]}>{req.orderQuantity} {req.unit}</Text>
                  </View>
                  {req.issuedQuantity !== undefined && (
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Issued</Text>
                      <Text style={[styles.detailValue, { color: "#10b981", fontWeight: "800" }]}>{req.issuedQuantity} {req.unit}</Text>
                    </View>
                  )}
                </View>

                {req.note ? (
                  <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                    Note: {req.note}
                  </Text>
                ) : null}

                {/* Action Buttons */}
                {req.status === "PENDING" && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}
                      onPress={() => handleApprove(req)}
                      disabled={processing}
                    >
                      <MaterialIcons name="check" size={15} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
                      onPress={() => handleReject(req)}
                      disabled={processing}
                    >
                      <MaterialIcons name="close" size={15} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {req.status === "APPROVED" && (
                  <TouchableOpacity
                    style={[styles.issueBtn, { backgroundColor: "#10b981" }]}
                    onPress={() => openIssueModal(req)}
                    disabled={processing}
                  >
                    <MaterialIcons name="output" size={16} color="#fff" />
                    <Text style={styles.issueBtnText}>Issue Stock → Auto Update Inventory</Text>
                  </TouchableOpacity>
                )}

                {req.status === "ISSUED" && req.issuedBy && (
                  <Text style={[styles.issuedByText, { color: theme.textSecondary }]}>
                    ✅ Issued by {req.issuedBy} on {formatDate(req.issuedAt)}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Issue Modal */}
      <Modal visible={showIssueModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.issueModal, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Issue Stock</Text>
            {selectedRequest && (
              <>
                <Text style={[styles.modalItemName, { color: theme.text }]}>
                  {selectedRequest.itemName}
                </Text>
                <Text style={[styles.modalSubText, { color: theme.textSecondary }]}>
                  Requested: {selectedRequest.orderQuantity} {selectedRequest.unit}
                </Text>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 14 }]}>
                  ISSUE QUANTITY ({selectedRequest.unit})
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
                  <Text style={[styles.unitText, { color: theme.textSecondary }]}>
                    {selectedRequest.unit}
                  </Text>
                </View>
                <View style={[styles.infoBox, { backgroundColor: "#10b98115" }]}>
                  <MaterialIcons name="info" size={14} color="#10b981" />
                  <Text style={styles.infoText}>
                    Inventory will auto-deduct {issueQty || "0"} {selectedRequest.unit} of {selectedRequest.itemName}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#10b981" }, processing && { opacity: 0.7 }]}
                onPress={handleIssue}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="done" size={16} color="#fff" />
                    <Text style={styles.modalBtnText}>Confirm Issue</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.border }]}
                onPress={() => setShowIssueModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24, paddingHorizontal: 20,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  notifBadge: {
    backgroundColor: "#f59e0b", paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20,
  },
  notifText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  body: { padding: 14 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
  statValue: { fontSize: 18, fontWeight: "900" },
  statLabel: { fontSize: 9, fontWeight: "600" },
  tabs: { flexDirection: "row", borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 },
  tab: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  tabText: { fontSize: 11, fontWeight: "700" },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
  requestCard: {
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardHeaderLeft: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "700" },
  cardDate: { fontSize: 11, marginTop: 2 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: "800" },
  detailsRow: {
    flexDirection: "row", paddingTop: 10,
    borderTopWidth: 1, marginBottom: 8,
  },
  detailItem: { flex: 1, alignItems: "center" },
  detailLabel: { fontSize: 9, fontWeight: "600", marginBottom: 2 },
  detailValue: { fontSize: 12, fontWeight: "700" },
  noteText: { fontSize: 11, marginBottom: 8, fontStyle: "italic" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    padding: 10, borderRadius: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  issueBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    padding: 12, borderRadius: 10, marginTop: 4,
  },
  issueBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  issuedByText: { fontSize: 11, marginTop: 6 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  issueModal: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  modalItemName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  modalSubText: { fontSize: 12, marginBottom: 4 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10,
  },
  input: { flex: 1, fontSize: 16, padding: 0, fontWeight: "700" },
  unitText: { fontSize: 13, fontWeight: "600" },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 8, padding: 10, borderRadius: 8, marginBottom: 16,
  },
  infoText: { color: "#10b981", fontSize: 11, flex: 1 },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    padding: 13, borderRadius: 10,
  },
  modalBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
