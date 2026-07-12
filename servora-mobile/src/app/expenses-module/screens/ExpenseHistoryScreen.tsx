// ============================================
// SERVORA ERP — Expense History Screen (Controller)
// Composes: Year summary, Month tabs, Daily list, ExpenseDayDetail
// Uses ConfirmModal (cross-platform) for delete/lock —
// Alert.alert() is native-only, silently no-ops on web.
// FROZEN
// ============================================

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, Alert, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useExpenseHistory } from "../hooks/useExpenseHistory";
import { useExpenseCategories } from "../hooks/useExpenseCategories";
import { EXPENSE_MONTHS, EXPENSE_MONTH_NAMES, formatShortExpenseDate } from "../utils/expense-date";
import { ExpenseDayDetail } from "../components/ExpenseDayDetail";
import ExpensePrintView from "../components/ExpensePrintView";
import { ExpenseForm } from "../components/ExpenseForm";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";

export default function ExpenseHistoryScreen() {
  const { theme, fmt } = useApp();

  const [selectedYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [printDate, setPrintDate] = useState<string>("");
  const [paperSize, setPaperSize] = useState<"A4" | "A5" | "A6">("A4");

  const {
    categories,
    getSubCategoriesFor,
    categoryHasSubCategories,
    getCategoryById,
  } = useExpenseCategories();

  const {
    loading,
    historyError,
    selectedMonth,
    selectedDay,
    dayTotals,
    monthlyTotal,
    monthExpenses,
    monthlySummary,
    yearTotal,
    selectedDayExpenses,
    selectedDayTotal,
    selectMonth,
    selectDay,

    editingExpense,
    savingEdit,
    editError,
    requestEdit,
    cancelEdit,
    confirmEdit,

    pendingDelete,
    requestDelete,
    cancelDelete,
    confirmDelete,

    pendingLockToggle,
    requestLockToggle,
    cancelLockToggle,
    confirmLockToggle,
  } = useExpenseHistory(selectedYear, categoryHasSubCategories);

  // ── Scroll-to-detail: track the expanded day-detail section's Y position ──
  const scrollViewRef = useRef<ScrollView>(null);
  const detailYPosition = useRef(0);

  useEffect(() => {
    if (!selectedDay) return;
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: detailYPosition.current, animated: true });
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedDay]);

  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(() => setRefreshing(false), 500);
    return () => clearTimeout(timer);
  }, [refreshing]);

  const onRefresh = useCallback(() => setRefreshing(true), []);

  const handleSelectDay = useCallback(
    (date: string) => {
      selectDay(date);
    },
    [selectDay]
  );

  const handleConfirmDelete = useCallback(async () => {
    const result = await confirmDelete();
    if (!result.success) {
      Alert.alert("Error", result.error ?? "Failed to delete");
    }
  }, [confirmDelete]);

  const handleConfirmLockToggle = useCallback(async () => {
    const result = await confirmLockToggle();
    if (!result.success) {
      Alert.alert("Error", result.error ?? "Failed to update lock");
    }
  }, [confirmLockToggle]);

  // ── Memoized print selection — avoids re-filtering on every render ──
  const printExpenses = useMemo(() => {
    return printDate
      ? monthExpenses.filter((e) => e.date === printDate)
      : monthExpenses;
  }, [printDate, monthExpenses]);

  // ── Print modal ───────────────────────────
  if (showPrint) {
    return (
      <ExpensePrintView
        expenses={printExpenses}
        date={printDate || `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`}
        getCategoryById={getCategoryById}
        onClose={() => setShowPrint(false)}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.left}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.error]}
            tintColor={theme.error}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>EXPENSE HISTORY</Text>
            <Text style={styles.headerSub}>{selectedYear}</Text>
          </View>
          <TouchableOpacity
            style={styles.printAllBtn}
            onPress={() => {
              setPrintDate("");
              setShowPrint(true);
            }}
          >
            <MaterialIcons name="download" size={16} color="#00154f" />
            <Text style={styles.printAllBtnText}>Export</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

          {historyError && (
            <View style={[styles.errorBanner, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
              <Text style={{ color: theme.error, fontSize: 13 }}>{historyError}</Text>
            </View>
          )}

          {/* Year Total */}
          <View style={[styles.yearCard, { backgroundColor: theme.card }]}>
            <View>
              <Text style={[styles.yearLabel, { color: theme.textSecondary }]}>
                Year Total ({selectedYear})
              </Text>
              <Text style={[styles.yearTotal, { color: theme.error }]}>
                {fmt(yearTotal)}
              </Text>
            </View>
            <MaterialIcons name="bar-chart" size={36} color={`${theme.error}30`} />
          </View>

          {/* Month Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.monthTabsScroll}
          >
            {EXPENSE_MONTHS.map((label, idx) => {
              const active = selectedMonth === idx;
              const hasData = monthlySummary[idx].total > 0;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.monthTab,
                    active && { backgroundColor: theme.error },
                    !active && { backgroundColor: theme.card },
                  ]}
                  onPress={() => selectMonth(idx)}
                >
                  <Text
                    style={[
                      styles.monthTabLabel,
                      { color: active ? "#fff" : theme.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                  {hasData && (
                    <Text
                      style={[
                        styles.monthTabTotal,
                        { color: active ? "#fff" : theme.textSecondary },
                      ]}
                    >
                      {fmt(monthlySummary[idx].total)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Month Summary */}
          <View style={[styles.monthSummary, { backgroundColor: theme.card }]}>
            <View style={styles.monthSummaryRow}>
              <View>
                <Text style={[styles.monthSummaryLabel, { color: theme.textSecondary }]}>
                  {EXPENSE_MONTH_NAMES[selectedMonth]} Total
                </Text>
                <Text style={[styles.monthSummaryTotal, { color: theme.error }]}>
                  {fmt(monthlyTotal)}
                </Text>
              </View>
              <View style={styles.monthSummaryRight}>
                <Text style={[styles.txCount, { color: theme.textSecondary }]}>
                  {monthExpenses.length} entries
                </Text>
                <TouchableOpacity
                  style={[styles.monthPrintBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    setPrintDate("");
                    setShowPrint(true);
                  }}
                >
                  <MaterialIcons name="print" size={13} color={theme.textSecondary} />
                  <Text style={[styles.monthPrintBtnText, { color: theme.textSecondary }]}>
                    Print Month
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Daily list */}
          {loading ? (
            <ActivityIndicator color={theme.error} style={{ marginTop: 20 }} />
          ) : dayTotals.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
              <MaterialIcons name="receipt-long" size={36} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No expenses in {EXPENSE_MONTH_NAMES[selectedMonth]}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Daily Breakdown
              </Text>
              {dayTotals.map((day) => {
                const isSelected = selectedDay === day.date;
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.dayRow,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      isSelected && { borderColor: theme.error, borderWidth: 2 },
                    ]}
                    onPress={() => handleSelectDay(day.date)}
                  >
                    <View style={styles.dayLeft}>
                      <View
                        style={[
                          styles.dayIcon,
                          { backgroundColor: isSelected ? `${theme.error}22` : theme.bg },
                        ]}
                      >
                        <MaterialIcons
                          name="calendar-today"
                          size={14}
                          color={isSelected ? theme.error : theme.textSecondary}
                        />
                      </View>
                      <View>
                        <Text style={[styles.dayDate, { color: theme.text }]}>
                          {formatShortExpenseDate(day.date)}
                        </Text>
                        <Text style={[styles.dayCount, { color: theme.textSecondary }]}>
                          {day.entries.length} entries
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dayRight}>
                      <Text style={[styles.dayTotal, { color: theme.error }]}>
                        {fmt(day.total)}
                      </Text>
                      <View style={styles.dayActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setPrintDate(day.date);
                            setShowPrint(true);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <MaterialIcons name="print" size={15} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <MaterialIcons
                          name={isSelected ? "expand-less" : "expand-more"}
                          size={18}
                          color={theme.textSecondary}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Expanded day detail */}
          {selectedDay && selectedDayExpenses.length > 0 && (
            <ExpenseDayDetail
              date={selectedDay}
              expenses={selectedDayExpenses}
              total={selectedDayTotal}
              getCategoryById={getCategoryById}
              onEdit={requestEdit}
              onDelete={requestDelete}
              onToggleLock={requestLockToggle}
              onLayout={(y) => { detailYPosition.current = y; }}
            />
          )}

        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={!!editingExpense}
        animationType="slide"
        transparent
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Expense</Text>
              <TouchableOpacity onPress={cancelEdit}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {editError && (
              <Text style={{ color: theme.error, fontSize: 13, marginBottom: 10 }}>
                {editError}
              </Text>
            )}
            {editingExpense && (
              <ExpenseForm
                editingExpense={editingExpense}
                categories={categories}
                getSubCategoriesFor={getSubCategoriesFor}
                saving={savingEdit}
                onSave={confirmEdit}
                onCancelEdit={cancelEdit}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        visible={!!pendingDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={cancelDelete}
      />

      {/* Lock/Unlock confirmation */}
      <ConfirmModal
        visible={!!pendingLockToggle}
        title={pendingLockToggle?.locked ? "Unlock Expense" : "Lock Expense"}
        message={
          pendingLockToggle?.locked
            ? "Unlock this expense so it can be edited or deleted again?"
            : "Lock this expense? It won't be editable or deletable until unlocked."
        }
        confirmLabel={pendingLockToggle?.locked ? "Unlock" : "Lock"}
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={handleConfirmLockToggle}
        onCancel={cancelLockToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  left: { flex: 1 },
  header: {
    backgroundColor: "#00154f",
    paddingTop: Platform.OS === "web" ? 28 : 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: { color: "#FFD700", fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  printAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#FFD700", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  printAllBtnText: { color: "#00154f", fontSize: 12, fontWeight: "800" },
  body: { padding: 14 },
  errorBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  yearCard: {
    borderRadius: 14, padding: 16, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center", marginBottom: 14,
  },
  yearLabel: { fontSize: 11, fontWeight: "600" },
  yearTotal: { fontSize: 26, fontWeight: "900", marginTop: 2 },
  monthTabsScroll: { marginBottom: 12 },
  monthTab: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    marginRight: 6, alignItems: "center", minWidth: 52,
  },
  monthTabLabel: { fontSize: 12, fontWeight: "700" },
  monthTabTotal: { fontSize: 9, fontWeight: "600", marginTop: 2 },
  monthSummary: { borderRadius: 14, padding: 14, marginBottom: 12 },
  monthSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthSummaryLabel: { fontSize: 11, fontWeight: "600" },
  monthSummaryTotal: { fontSize: 22, fontWeight: "900", marginTop: 2 },
  monthSummaryRight: { alignItems: "flex-end", gap: 6 },
  txCount: { fontSize: 11 },
  monthPrintBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  monthPrintBtnText: { fontSize: 11, fontWeight: "600" },
  emptyBox: { borderRadius: 14, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 10 },
  dayRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1,
  },
  dayLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dayDate: { fontSize: 13, fontWeight: "700" },
  dayCount: { fontSize: 11, marginTop: 1 },
  dayRight: { alignItems: "flex-end", gap: 4 },
  dayTotal: { fontSize: 15, fontWeight: "800" },
  dayActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
});