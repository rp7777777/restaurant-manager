// ============================================
// SERVORA ERP — RequestHistoryScreen
// ✅ Renders KitchenHistoryTable (category-grouped, batch-level
//    table) for a single, already-date-filtered list of requests.
// ✅ date navigation (selectedDate, prev/next day) owned BY
//    KitchenScreen.tsx (lifted up via useRequestHistory).
// ✅ status filter and category filter, both wired from
//    KitchenScreen.tsx, applied to historyRequests before passing to
//    KitchenHistoryTable.
// ✅ Batch allocations for the selected date's ISSUED requests
//    fetched via getMovementsByReference().
// ✅ NEW — "View" (onRowPress) opens KitchenRequestActionModal:
//    PENDING requests get Edit/Delete controls (calls
//    updateKitchenRequestItem()/deleteKitchenRequest()), other
//    statuses get a read-only detail view. restaurantId is now
//    required here for these two service calls.
// FROZEN
// ============================================

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { formatSelectedDate } from "../utils/kitchen-format";
import { IngredientRequest } from "../types/kitchen-types";
import { Category } from "../../../modules/inventory-module/types/category";
import { getMovementsByReference } from "../../../modules/stock-movement-module/services/stock-movement-service";
import { BatchAllocationRecord } from "../../../modules/stock-movement-module/types/stock-movement";
import { updateKitchenRequestItem, deleteKitchenRequest } from "../services/kitchen-request-service";
import { KitchenHistoryTable } from "../components/KitchenHistoryTable";
import { KitchenRequestActionModal } from "../components/KitchenRequestActionModal";

const isWeb = Platform.OS === "web";

function showAlert(title: string, message: string) {
  if (isWeb) window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

interface Theme {
  card:          string;
  surface:       string;
  text:          string;
  textSecondary: string;
  border:        string;
  primary:       string;
}

interface RequestHistoryScreenProps {
  historyRequests: IngredientRequest[];
  selectedDate:    string;
  loading:         boolean;
  theme:           Theme;
  restaurantId:    string | null | undefined;
  categories:      Category[];
  statusFilter:    IngredientRequest["status"] | null;
  categoryFilter:  string | null;
}

export default function RequestHistoryScreen({
  historyRequests, selectedDate, loading, theme, restaurantId, categories, statusFilter, categoryFilter,
}: RequestHistoryScreenProps) {
  const [actionTarget, setActionTarget] = useState<IngredientRequest | null>(null);
  const [processing, setProcessing] = useState(false);

  const filteredRequests = useMemo(() => {
    let result = historyRequests;
    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    if (categoryFilter) result = result.filter((r) => r.categoryId === categoryFilter);
    return result;
  }, [historyRequests, statusFilter, categoryFilter]);

  const [batchAllocationsByRequestId, setBatchAllocationsByRequestId] =
    useState<Map<string, BatchAllocationRecord[]>>(new Map());

  const issuedIdsKey = useMemo(
    () =>
      filteredRequests
        .filter((r) => r.status === "ISSUED")
        .map((r) => `${r.id}:${r.issuedQuantity ?? 0}`)
        .sort()
        .join(","),
    [filteredRequests]
  );

  useEffect(() => {
    const issuedIds = filteredRequests.filter((r) => r.status === "ISSUED").map((r) => r.id);
    if (issuedIds.length === 0 || !restaurantId) {
      setBatchAllocationsByRequestId(new Map());
      return;
    }

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        issuedIds.map(async (id): Promise<readonly [string, BatchAllocationRecord[]]> => {
          try {
            const movements = await getMovementsByReference(restaurantId, "KITCHEN_REQUEST", id);
            const allocations = movements.flatMap((m) => m.batchAllocations ?? []);
            return [id, allocations];
          } catch (error) {
            console.warn(`Failed to load batch allocations for request ${id}:`, error);
            return [id, [] as BatchAllocationRecord[]];
          }
        })
      );
      if (!cancelled) {
        setBatchAllocationsByRequestId(new Map(entries));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuedIdsKey, restaurantId]);

  const handleSave = async (updated: { itemName: string; orderQuantity: number; unit: string }) => {
    if (!actionTarget || !restaurantId) return;
    setProcessing(true);
    try {
      await updateKitchenRequestItem({
        restaurantId,
        requestId: actionTarget.id,
        itemName: updated.itemName,
        inventoryId: actionTarget.inventoryId,
        categoryId: actionTarget.categoryId,
        orderQuantity: updated.orderQuantity,
        unit: updated.unit,
      });
      setActionTarget(null);
    } catch (err: any) {
      showAlert("Error", err?.message ?? "Failed to update request");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!actionTarget || !restaurantId) return;
    setProcessing(true);
    try {
      await deleteKitchenRequest(restaurantId, actionTarget.id);
      setActionTarget(null);
    } catch (err: any) {
      showAlert("Error", err?.message ?? "Failed to delete request");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Request History</Text>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
      ) : filteredRequests.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
          <MaterialIcons name="add-shopping-cart" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No requests for {formatSelectedDate(selectedDate)}
          </Text>
        </View>
      ) : (
        <KitchenHistoryTable
          requests={filteredRequests}
          batchAllocationsByRequestId={batchAllocationsByRequestId}
          categories={categories}
          liveDateLabel={formatSelectedDate(selectedDate)}
          onRowPress={setActionTarget}
        />
      )}

      <KitchenRequestActionModal
        visible={!!actionTarget}
        request={actionTarget}
        processing={processing}
        theme={theme}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setActionTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
});