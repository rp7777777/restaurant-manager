// ============================================
// SERVORA ERP — Expense Print View
// A4 print/PDF format — same as Sales Print View
// FROZEN
// ============================================

import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { ExpenseEntry } from "../types/expense-types";
import { ExpenseCategoryWithSubs } from "../types/category-types";
import { PAYMENT_METHOD_LABELS } from "../constants/expense-payment";
import { formatExpenseReportDate } from "../utils/expense-date";

interface Props {
  expenses: ExpenseEntry[];
  date: string;
  getCategoryById: (categoryId: string) => ExpenseCategoryWithSubs | undefined;
  onClose: () => void;
  paperSize?: "A4" | "A5" | "A6";
  onPaperSizeChange?: (size: "A4" | "A5" | "A6") => void;
}

const PAPER_SIZES = {
  A4: { width: 794, height: 1123, label: "A4 (210×297mm)" },
  A5: { width: 559, height: 794, label: "A5 (148×210mm)" },
  A6: { width: 397, height: 559, label: "A6 (105×148mm)" },
};

export default function ExpensePrintView({
  expenses, date, getCategoryById, onClose, paperSize = "A4", onPaperSizeChange,
}: Props) {
  const { restaurant } = useApp();

  const paper = PAPER_SIZES[paperSize];

  // ── Group by category — memoized, only rebuilds when expenses change ──
  const byCategory = useMemo(() => {
    const grouped: Record<string, ExpenseEntry[]> = {};
    expenses.forEach((e) => {
      if (!grouped[e.categoryId]) grouped[e.categoryId] = [];
      grouped[e.categoryId].push(e);
    });
    return grouped;
  }, [expenses]);

  const grandTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handlePrint = () => {
    if (Platform.OS !== "web") return;
    window.print();
  };

  return (
    <View style={styles.overlay}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={onClose} style={styles.toolbarBtn}>
          <MaterialIcons name="close" size={20} color="#fff" />
          <Text style={styles.toolbarBtnText}>Close</Text>
        </TouchableOpacity>

        {/* Paper size selector */}
        <View style={styles.paperSizeRow}>
          {(["A4", "A5", "A6"] as const).map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.paperSizeBtn,
                paperSize === size && styles.paperSizeBtnActive,
              ]}
              onPress={() => onPaperSizeChange?.(size)}
            >
              <Text
                style={[
                  styles.paperSizeBtnText,
                  paperSize === size && styles.paperSizeBtnTextActive,
                ]}
              >
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handlePrint} style={styles.printBtn}>
          <MaterialIcons name="print" size={18} color="#00154f" />
          <Text style={styles.printBtnText}>Print / PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Print Preview */}
      <ScrollView
        style={styles.previewScroll}
        contentContainerStyle={styles.previewContent}
      >
        <View
          style={[
            styles.paper,
            { width: paper.width * 0.75, minHeight: paper.height * 0.75 },
          ]}
          id="print-area"
        >
          {/* Restaurant Header */}
          <View style={styles.printHeader}>
            <Text style={styles.restaurantName}>
              {restaurant?.name ?? "SERVORA ERP"}
            </Text>
            {restaurant?.address ? (
              <Text style={styles.restaurantInfo}>{restaurant.address}</Text>
            ) : null}
            {restaurant?.phone ? (
              <Text style={styles.restaurantInfo}>{restaurant.phone}</Text>
            ) : null}
            {restaurant?.vatNumber ? (
              <Text style={styles.restaurantInfo}>NIF: {restaurant.vatNumber}</Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* Report Title */}
          <Text style={styles.reportTitle}>EXPENSE REPORT</Text>
          <View style={styles.reportMetaRow}>
            <Text style={styles.reportMeta}>Date: {formatExpenseReportDate(date)}</Text>
            <Text style={styles.reportMeta}>
              Printed: {new Date().toLocaleDateString("en-GB")}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Expense Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.cellName, styles.headerText]}>
                EXPENSE
              </Text>
              <Text style={[styles.tableCell, styles.cellPayment, styles.headerText]}>
                PAYMENT
              </Text>
              <Text style={[styles.tableCell, styles.cellNote, styles.headerText]}>
                NOTE
              </Text>
              <Text style={[styles.tableCell, styles.cellAmount, styles.headerText]}>
                AMOUNT
              </Text>
            </View>

            {/* Rows grouped by category */}
            {Object.entries(byCategory).map(([categoryId, categoryExpenses]) => {
              const category = getCategoryById(categoryId);
              const categoryName = category?.name ?? "Uncategorized";
              const categoryTotal = categoryExpenses.reduce(
                (sum, e) => sum + Number(e.amount), 0
              );

              return (
                <React.Fragment key={categoryId}>
                  {categoryExpenses.map((expense, idx) => (
                    <View
                      key={expense.id ?? idx}
                      style={[
                        styles.tableRow,
                        idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                      ]}
                    >
                      <Text style={[styles.tableCell, styles.cellName]}>
                        {idx === 0 ? `${categoryName} — ${expense.expenseName}` : expense.expenseName}
                      </Text>
                      <Text style={[styles.tableCell, styles.cellPayment]}>
                        {PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                      </Text>
                      <Text style={[styles.tableCell, styles.cellNote]}>
                        {expense.note ?? ""}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.cellAmount,
                          styles.amountText,
                        ]}
                      >
                        €{Number(expense.amount).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  {/* Category subtotal */}
                  <View style={[styles.tableRow, styles.subtotalRow]}>
                    <Text style={[styles.tableCell, styles.cellName, styles.subtotalLabel]}>
                      {categoryName} Total
                    </Text>
                    <Text style={[styles.tableCell, styles.cellPayment]} />
                    <Text style={[styles.tableCell, styles.cellNote]} />
                    <Text
                      style={[
                        styles.tableCell,
                        styles.cellAmount,
                        styles.subtotalValue,
                      ]}
                    >
                      €{categoryTotal.toFixed(2)}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}

            {/* Grand Total */}
            <View style={[styles.tableRow, styles.grandTotalRow]}>
              <Text
                style={[
                  styles.tableCell,
                  styles.cellName,
                  styles.grandTotalLabel,
                ]}
              >
                GRAND TOTAL
              </Text>
              <Text style={[styles.tableCell, styles.cellPayment]} />
              <Text style={[styles.tableCell, styles.cellNote]} />
              <Text
                style={[
                  styles.tableCell,
                  styles.cellAmount,
                  styles.grandTotalValue,
                ]}
              >
                €{grandTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Signatures */}
          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Manager Signature</Text>
              <View style={styles.signatureLine} />
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Date</Text>
              <View style={styles.signatureLine} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#1a1a2e" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#00154f",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  toolbarBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  toolbarBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  paperSizeRow: { flexDirection: "row", gap: 4 },
  paperSizeBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  paperSizeBtnActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  paperSizeBtnText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  paperSizeBtnTextActive: { color: "#00154f" },
  printBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFD700", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  printBtnText: { color: "#00154f", fontSize: 13, fontWeight: "800" },
  previewScroll: { flex: 1 },
  previewContent: { alignItems: "center", padding: 24 },
  paper: {
    backgroundColor: "#fff", padding: 32,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  printHeader: { alignItems: "center", marginBottom: 8 },
  restaurantName: { fontSize: 16, fontWeight: "900", color: "#00154f", textAlign: "center" },
  restaurantInfo: { fontSize: 10, color: "#555", textAlign: "center", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#00154f", marginVertical: 10 },
  reportTitle: {
    fontSize: 14, fontWeight: "900", color: "#00154f",
    textAlign: "center", letterSpacing: 1, marginBottom: 6,
  },
  reportMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  reportMeta: { fontSize: 10, color: "#555" },
  table: { marginBottom: 10 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tableHeader: { backgroundColor: "#00154f" },
  rowEven: { backgroundColor: "#f9f9f9" },
  rowOdd: { backgroundColor: "#fff" },
  subtotalRow: { backgroundColor: "#fee2e2" },
  grandTotalRow: { backgroundColor: "#00154f" },
  tableCell: { fontSize: 9, padding: 5, color: "#333" },
  cellName: { flex: 1.8 },
  cellPayment: { flex: 1 },
  cellNote: { flex: 1.5 },
  cellAmount: { flex: 1, textAlign: "right" },
  headerText: { color: "#FFD700", fontWeight: "800", fontSize: 9 },
  amountText: { fontWeight: "700", color: "#00154f" },
  subtotalLabel: { fontWeight: "700", color: "#dc2626", fontSize: 9 },
  subtotalValue: { fontWeight: "800", color: "#dc2626" },
  grandTotalLabel: { color: "#FFD700", fontWeight: "900", fontSize: 10 },
  grandTotalValue: { color: "#FFD700", fontWeight: "900", fontSize: 11, textAlign: "right" },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 20 },
  signatureBox: { flex: 1 },
  signatureLabel: { fontSize: 9, color: "#555", marginBottom: 20 },
  signatureLine: { height: 1, backgroundColor: "#333" },
});