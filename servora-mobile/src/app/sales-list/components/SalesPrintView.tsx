// ============================================
// SERVORA ERP — Sales Print View
// A4 print/PDF format — same as Excel
// ============================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";

interface SaleEntry {
  id?: string;
  date: string;
  shift: string;
  amount: number;
  paymentMethod: string;
  note: string;
  locked: boolean;
}

interface Props {
  sales: SaleEntry[];
  date: string;
  onClose: () => void;
  paperSize?: "A4" | "A5" | "A6";
  onPaperSizeChange?: (size: "A4" | "A5" | "A6") => void;
}

const PAPER_SIZES = {
  A4: { width: 794, height: 1123, label: "A4 (210×297mm)" },
  A5: { width: 559, height: 794, label: "A5 (148×210mm)" },
  A6: { width: 397, height: 559, label: "A6 (105×148mm)" },
};

const PAYMENT_COLORS: Record<string, string> = {
  Cash:        "#10b981",
  Card:        "#3b82f6",
  MBWay:       "#8b5cf6",
  "Uber Eats": "#f97316",
  Glovo:       "#84cc16",
  "Bolt Food": "#06b6d4",
  Other:       "#94a3b8",
};

const SHIFTS = ["Morning", "Afternoon", "Night"];

export default function SalesPrintView({
  sales, date, onClose, paperSize = "A4", onPaperSizeChange,
}: Props) {
  const { restaurant } = useApp();

  const paper = PAPER_SIZES[paperSize];

  // Group by shift
  const byShift: Record<string, SaleEntry[]> = {};
  SHIFTS.forEach((s) => { byShift[s] = []; });
  sales.forEach((s) => {
    if (byShift[s.shift]) byShift[s.shift].push(s);
  });

  // Payment totals
  const paymentTotals: Record<string, number> = {};
  sales.forEach((s) => {
    paymentTotals[s.paymentMethod] =
      (paymentTotals[s.paymentMethod] ?? 0) + Number(s.amount);
  });

  const grandTotal = sales.reduce((sum, s) => sum + Number(s.amount), 0);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric",
    });
  };

  const handlePrint = () => {
    if (Platform.OS === "web") {
      window.print();
    }
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
          <Text style={styles.reportTitle}>DAILY SALES REPORT</Text>
          <View style={styles.reportMetaRow}>
            <Text style={styles.reportMeta}>Date: {formatDate(date)}</Text>
            <Text style={styles.reportMeta}>
              Printed: {new Date().toLocaleDateString("en-GB")}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Sales Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.cellShift, styles.headerText]}>
                SHIFT
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

            {/* Rows */}
            {SHIFTS.map((shift) => {
              const shiftSales = byShift[shift];
              if (shiftSales.length === 0) return null;
              const shiftTotal = shiftSales.reduce(
                (sum, s) => sum + Number(s.amount), 0
              );

              return (
                <React.Fragment key={shift}>
                  {shiftSales.map((sale, idx) => (
                    <View
                      key={sale.id ?? idx}
                      style={[
                        styles.tableRow,
                        idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                      ]}
                    >
                      <Text style={[styles.tableCell, styles.cellShift]}>
                        {idx === 0 ? shift : ""}
                      </Text>
                      <Text style={[styles.tableCell, styles.cellPayment]}>
                        {sale.paymentMethod}
                      </Text>
                      <Text style={[styles.tableCell, styles.cellNote]}>
                        {sale.note}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.cellAmount,
                          styles.amountText,
                        ]}
                      >
                        €{Number(sale.amount).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  {/* Shift subtotal */}
                  <View style={[styles.tableRow, styles.subtotalRow]}>
                    <Text style={[styles.tableCell, styles.cellShift, styles.subtotalLabel]}>
                      {shift} Total
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
                      €{shiftTotal.toFixed(2)}
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
                  styles.cellShift,
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

          {/* Payment Summary */}
          <Text style={styles.sectionTitle}>PAYMENT SUMMARY</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 2 }, styles.headerText]}>
                PAYMENT METHOD
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }, styles.headerText]}>
                TOTAL
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }, styles.headerText]}>
                %
              </Text>
            </View>
            {Object.entries(paymentTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([method, amount]) => (
                <View key={method} style={[styles.tableRow, styles.rowEven]}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{method}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }, styles.amountText]}>
                    €{amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>
                    {grandTotal > 0
                      ? ((amount / grandTotal) * 100).toFixed(1)
                      : 0}%
                  </Text>
                </View>
              ))}
            <View style={[styles.tableRow, styles.grandTotalRow]}>
              <Text style={[styles.tableCell, { flex: 2 }, styles.grandTotalLabel]}>
                TOTAL
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 1 },
                  styles.grandTotalValue,
                ]}
              >
                €{grandTotal.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }, styles.grandTotalLabel]}>
                100%
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
  overlay: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },

  // Toolbar
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#00154f",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
  },
  toolbarBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  paperSizeRow: {
    flexDirection: "row",
    gap: 4,
  },
  paperSizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  paperSizeBtnActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  paperSizeBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },
  paperSizeBtnTextActive: {
    color: "#00154f",
  },
  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFD700",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  printBtnText: {
    color: "#00154f",
    fontSize: 13,
    fontWeight: "800",
  },

  // Preview
  previewScroll: { flex: 1 },
  previewContent: {
    alignItems: "center",
    padding: 24,
  },
  paper: {
    backgroundColor: "#fff",
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  // Print content
  printHeader: { alignItems: "center", marginBottom: 8 },
  restaurantName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#00154f",
    textAlign: "center",
  },
  restaurantInfo: {
    fontSize: 10,
    color: "#555",
    textAlign: "center",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#00154f",
    marginVertical: 10,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#00154f",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 6,
  },
  reportMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reportMeta: {
    fontSize: 10,
    color: "#555",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#00154f",
    letterSpacing: 1,
    marginBottom: 6,
  },

  // Table
  table: { marginBottom: 10 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  tableHeader: {
    backgroundColor: "#00154f",
  },
  rowEven: { backgroundColor: "#f9f9f9" },
  rowOdd: { backgroundColor: "#fff" },
  subtotalRow: { backgroundColor: "#e8f4ff" },
  grandTotalRow: { backgroundColor: "#00154f" },
  tableCell: {
    fontSize: 9,
    padding: 5,
    color: "#333",
  },
  cellShift: { flex: 1.2 },
  cellPayment: { flex: 1.2 },
  cellNote: { flex: 2 },
  cellAmount: { flex: 1, textAlign: "right" },
  headerText: {
    color: "#FFD700",
    fontWeight: "800",
    fontSize: 9,
  },
  amountText: {
    fontWeight: "700",
    color: "#00154f",
  },
  subtotalLabel: {
    fontWeight: "700",
    color: "#0369a1",
    fontSize: 9,
  },
  subtotalValue: {
    fontWeight: "800",
    color: "#0369a1",
  },
  grandTotalLabel: {
    color: "#FFD700",
    fontWeight: "900",
    fontSize: 10,
  },
  grandTotalValue: {
    color: "#FFD700",
    fontWeight: "900",
    fontSize: 11,
    textAlign: "right",
  },

  // Signatures
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 20,
  },
  signatureBox: { flex: 1 },
  signatureLabel: {
    fontSize: 9,
    color: "#555",
    marginBottom: 20,
  },
  signatureLine: {
    height: 1,
    backgroundColor: "#333",
  },
});