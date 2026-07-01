// ============================================
// SERVORA ERP — PayrollScreen
// ✅ Double-click protection on Generate
// ✅ Double-click protection on Mark Paid
// ✅ Clean controller
// ============================================

import React, { useState, useMemo } from "react";
import {
  View, StyleSheet, Alert,
  Platform, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp }                from "../../../context/AppContext";
import { usePayroll }            from "../hooks/usePayroll";
import { generateMonthlyPayroll } from "../payroll-generator";
import { markPayrollPaid }       from "../firestore/payroll-repository";
import { filterPayrolls }        from "../utils/payroll-filter";
import { buildPayrollSummary }   from "../utils/payroll-summary";
import { PayrollDocument }       from "../types/payroll-types";
import { PayrollHeader }         from "../components/PayrollHeader";
import { PayrollMonthSelector }  from "../components/PayrollMonthSelector";
import { PayrollStatsBar }       from "../components/PayrollStatsBar";
import { PayrollFilters }        from "../components/PayrollFilters";
import { PayrollTable }          from "../components/PayrollTable";
import { PayrollDetailModal }    from "../components/PayrollDetailModal";
import { MONTHS_EN }             from "../../schedule-module/constants/schedule-config";

function buildMonthStr(year: number, month: number): string {
  return (MONTHS_EN[month] ?? "Unknown") + "-" + year;
}

export default function PayrollScreen() {
  const { theme, userProfile, restaurantId } = useApp();

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year,  setYear]  = useState(today.getFullYear());

  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<"ALL" | "DRAFT" | "GENERATED" | "PAID">("ALL");
  const [generating, setGenerating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [selected,   setSelected]   = useState<PayrollDocument | null>(null);

  const monthStr  = buildMonthStr(year, month);
  const isManager = ["MANAGER", "OWNER"].includes(userProfile?.role ?? "");

  const { payrolls, loading } = usePayroll(restaurantId, monthStr);

  const summary = useMemo(
    () => buildPayrollSummary(payrolls),
    [payrolls]
  );

  const filtered = useMemo(
    () => filterPayrolls(payrolls, search, filter),
    [payrolls, search, filter]
  );

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const goNext = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // ✅ Double-click protection
  const handleGenerate = async () => {
    if (generating) return;
    if (!restaurantId) return;

    const doConfirm = Platform.OS === "web"
      ? window.confirm(`Generate payroll for ${monthStr}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Generate Payroll", `Generate for ${monthStr}?`, [
            { text: "Cancel",   onPress: () => resolve(false), style: "cancel" },
            { text: "Generate", onPress: () => resolve(true) },
          ]);
        });
    if (!doConfirm) return;

    setGenerating(true);
    try {
      const { created, skipped } = await generateMonthlyPayroll(
        restaurantId, year, month, monthStr
      );
      Alert.alert("✅ Done!", `${created} slips created, ${skipped} skipped`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  // ✅ Double-click protection
  const handleMarkPaid = async (p: PayrollDocument) => {
    if (markingPaid) return;
    if (!restaurantId) return;

    setMarkingPaid(true);
    try {
      await markPayrollPaid(restaurantId, p.id);
      setSelected(null);
      Alert.alert("✅ Paid!", `${p.employeeName} marked as paid`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setMarkingPaid(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <PayrollHeader
          isManager={isManager}
          generating={generating}
          onGenerate={handleGenerate}
        />
        <PayrollMonthSelector
          month={month}
          year={year}
          onPrev={goPrev}
          onNext={goNext}
        />
      </LinearGradient>

      <PayrollStatsBar summary={summary} />

      <PayrollFilters
        search={search}
        activeFilter={filter}
        onSearchChange={setSearch}
        onFilterChange={setFilter}
      />

      {loading ? (
        <ActivityIndicator
          color={theme.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <PayrollTable
          payrolls={filtered}
          onSelect={setSelected}
        />
      )}

      <PayrollDetailModal
        visible={!!selected}
        payroll={selected}
        isManager={isManager}
        markingPaid={markingPaid}
        onMarkPaid={handleMarkPaid}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    paddingTop:        Platform.OS === "web" ? 24 : 48,
    paddingBottom:     12,
    paddingHorizontal: 16,
  },
});
