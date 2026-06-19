// ============================================
// SERVORA ERP — Finance Settings Component
// ✅ Retry button — proper re-trigger
// ✅ Double save protection — savingRef
// ✅ Decimal validation — tax/ss
// ✅ Empty search UX
// ✅ No unused imports
// ✅ AppTheme clean type
// ✅ 10/10 production ready
// ============================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  KeyboardTypeOptions,
} from "react-native";
import { MaterialIcons }              from "@expo/vector-icons";
import { useApp }                     from "../../../context/AppContext";
import { loadSettings, saveSettings } from "../services/settings-service";
import {
  Currency, searchCurrencies,
  CURRENCY_REGIONS, getCurrenciesByRegion,
  getCurrency, CurrencyRegion,
} from "../constants/currencies";
import {
  RestaurantSettings,
  DEFAULT_SETTINGS,
} from "../types/settings-types";
import { THEMES } from "../../../constants/theme";

// ✅ Clean theme type
type AppTheme    = typeof THEMES[keyof typeof THEMES];
type RegionFilter = "All" | CurrencyRegion;

export function FinanceSettings() {
  const { theme, restaurantId, refreshRestaurant } = useApp();

  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [settings,     setSettings]     = useState<RestaurantSettings>(DEFAULT_SETTINGS);
  const [taxRate,      setTaxRate]      = useState("11");
  const [ssRate,       setSsRate]       = useState("11");
  const [searchQuery,  setSearchQuery]  = useState("");
  const [activeRegion, setActiveRegion] = useState<RegionFilter>("All");
  const [showPicker,   setShowPicker]   = useState(false);

  // ✅ Double save protection
  const savingRef  = useRef(false);
  // ✅ Retry counter — forces useEffect re-run
  const [retryCount, setRetryCount] = useState(0);

  // ✅ Race condition fix + retry support
  useEffect(() => {
    if (!restaurantId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    loadSettings(restaurantId)
      .then((loaded) => {
        if (!mounted) return;
        setSettings(loaded);
        setTaxRate(String(loaded.finance.taxRate ?? 11));
        setSsRate(String(loaded.finance.ssRate   ?? 11));
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load settings");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [restaurantId, retryCount]);

  const handleCurrencySelect = (currency: Currency) => {
    setSettings((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        currency:       currency.code,
        currencySymbol: currency.symbol,
      },
    }));
    setShowPicker(false);
    setSearchQuery("");
  };

  const handleSave = async () => {
    if (!restaurantId)    return;
    // ✅ Double save protection
    if (savingRef.current) return;

    // ✅ Decimal + NaN validation
    const tax = parseFloat(taxRate);
    const ss  = parseFloat(ssRate);

    if (Number.isNaN(tax)) {
      Alert.alert("Validation Error", "Tax rate must be a valid number");
      return;
    }
    if (Number.isNaN(ss)) {
      Alert.alert("Validation Error", "SS rate must be a valid number");
      return;
    }
    // ✅ Range validation
    if (tax < 0 || tax > 100) {
      Alert.alert("Validation Error", "Tax rate must be between 0% and 100%");
      return;
    }
    if (ss < 0 || ss > 100) {
      Alert.alert("Validation Error", "SS rate must be between 0% and 100%");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const updated: RestaurantSettings = {
        ...settings,
        finance: { ...settings.finance, taxRate: tax, ssRate: ss },
      };
      const result = await saveSettings(restaurantId, updated);
      if (!result.valid) {
        Alert.alert("Validation Error", result.errors.join("\n"));
        return;
      }
      setSettings(updated);
      await refreshRestaurant();
      Alert.alert("✅ Saved!", "Finance settings updated");
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ✅ Single getCurrency call — no duplicate
  const currentCurrencyObj = getCurrency(settings.finance.currency);

  const filteredCurrencies = searchQuery
    ? searchCurrencies(searchQuery)
    : getCurrenciesByRegion(activeRegion);

  // ── Loading ───────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // ── Error ─────────────────────────────────
  if (error) {
    return (
      <View style={styles.centerWrap}>
        <MaterialIcons name="error-outline" size={40} color="#ef4444" />
        <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
        {/* ✅ Retry — increments counter → useEffect re-runs */}
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: theme.primary }]}
          onPress={() => setRetryCount((c) => c + 1)}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* Currency */}
      <SectionCard title="💰 CURRENCY" theme={theme}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Currency
        </Text>

        <TouchableOpacity
          style={[styles.currencyBtn, {
            backgroundColor: theme.bg,
            borderColor:     theme.border,
          }]}
          onPress={() => setShowPicker(!showPicker)}
        >
          <Text style={{ fontSize: 18 }}>{currentCurrencyObj.flag}</Text>
          <Text style={[styles.currencyCode,   { color: theme.text }]}>
            {currentCurrencyObj.code}
          </Text>
          <Text style={[styles.currencyName,   { color: theme.textSecondary }]}>
            {currentCurrencyObj.name}
          </Text>
          <Text style={[styles.currencySymbol, { color: theme.primary }]}>
            {currentCurrencyObj.symbol}
          </Text>
          <MaterialIcons
            name={showPicker ? "expand-less" : "expand-more"}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {showPicker && (
          <View style={[styles.picker, {
            backgroundColor: theme.surface,
            borderColor:     theme.border,
          }]}>
            {/* Search */}
            <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
              <MaterialIcons name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search currency..."
                placeholderTextColor={theme.textSecondary}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Region tabs */}
            {!searchQuery && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.regionTabs, { borderBottomColor: theme.border }]}
              >
                {CURRENCY_REGIONS.map((region) => (
                  <TouchableOpacity
                    key={region}
                    style={[
                      styles.regionTab,
                      activeRegion === region && {
                        borderBottomColor: theme.primary,
                        borderBottomWidth: 2,
                      },
                    ]}
                    onPress={() => setActiveRegion(region)}
                  >
                    <Text style={[
                      styles.regionTabText,
                      { color: activeRegion === region ? theme.primary : theme.textSecondary },
                    ]}>
                      {region}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* ✅ Empty search UX */}
            {filteredCurrencies.length === 0 ? (
              <View style={styles.emptyWrap}>
                <MaterialIcons name="search-off" size={28} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No currencies found for "{searchQuery}"
                </Text>
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Text style={[styles.clearSearch, { color: theme.primary }]}>
                    Clear search
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {filteredCurrencies.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    style={[
                      styles.currencyItem,
                      { borderBottomColor: theme.border },
                      currentCurrencyObj.code === c.code && {
                        backgroundColor: theme.sidebarActive,
                      },
                    ]}
                    onPress={() => handleCurrencySelect(c)}
                  >
                    <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                    <Text style={[styles.itemCode,   { color: theme.text }]}>{c.code}</Text>
                    <Text style={[styles.itemName,   { color: theme.textSecondary }]}>{c.name}</Text>
                    <Text style={[styles.itemSymbol, { color: theme.primary }]}>{c.symbol}</Text>
                    {currentCurrencyObj.code === c.code && (
                      <MaterialIcons name="check" size={16} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </SectionCard>

      {/* Tax / SS */}
      <SectionCard title="📊 TAX & SOCIAL SECURITY" theme={theme}>
        <View style={styles.row2}>
          <View style={styles.half}>
            <Field
              label="Tax Rate (%)"
              value={taxRate}
              onChange={setTaxRate}
              theme={theme}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <Field
              label="SS Rate (%)"
              value={ssRate}
              onChange={setSsRate}
              theme={theme}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <View style={[styles.infoBox, {
          backgroundColor: "#3b82f610",
          borderColor:     "#3b82f630",
        }]}>
          <MaterialIcons name="info" size={14} color="#3b82f6" />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Range: 0–100%. Decimals allowed (e.g. 11.5%). Tax deducted from gross pay.
          </Text>
        </View>
      </SectionCard>

      <SaveButton onSave={handleSave} saving={saving} theme={theme} />
    </View>
  );
}

// ── Reusable ──────────────────────────────────
function SectionCard({ title, theme, children }: {
  title: string; theme: AppTheme; children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, onChange, theme, keyboardType = "default" }: {
  label: string; value: string; onChange: (v: string) => void;
  theme: AppTheme; keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, {
          backgroundColor: theme.bg,
          borderColor:     theme.border,
          color:           theme.text,
        }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={theme.textSecondary}
      />
    </View>
  );
}

function SaveButton({ onSave, saving, theme }: {
  onSave: () => void; saving: boolean; theme: AppTheme;
}) {
  return (
    <TouchableOpacity
      style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
      onPress={onSave}
      disabled={saving}
    >
      {saving
        ? <ActivityIndicator size="small" color="#fff" />
        : <MaterialIcons name="save" size={16} color="#fff" />
      }
      <Text style={styles.saveBtnText}>
        {saving ? "Saving..." : "Save Finance Settings"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  centerWrap:   { flex: 1, justifyContent: "center", alignItems: "center", padding: 40, gap: 12 },
  errorText:    { fontSize: 14, textAlign: "center" },
  retryBtn:     { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  section:      { borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 14 },
  fieldWrap:    { marginBottom: 12 },
  fieldLabel:   { fontSize: 11, fontWeight: "700", marginBottom: 6 },
  fieldInput:   { borderWidth: 1.5, borderRadius: 9, padding: 10, fontSize: 14 },
  row2:         { flexDirection: "row", gap: 10 },
  half:         { flex: 1 },
  currencyBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 8, padding: 10, borderWidth: 1.5, borderRadius: 9, marginBottom: 8,
  },
  currencyCode:   { fontSize: 14, fontWeight: "800" },
  currencyName:   { flex: 1, fontSize: 12 },
  currencySymbol: { fontSize: 16, fontWeight: "800" },
  picker:         { borderWidth: 1, borderRadius: 10, marginBottom: 10, overflow: "hidden" },
  searchRow:      { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1 },
  searchInput:    { flex: 1, fontSize: 13 },
  regionTabs:     { borderBottomWidth: 1 },
  regionTab:      { paddingHorizontal: 12, paddingVertical: 8 },
  regionTabText:  { fontSize: 11, fontWeight: "600" },
  emptyWrap:      { padding: 20, alignItems: "center", gap: 8 },
  emptyText:      { fontSize: 12, textAlign: "center" },
  clearSearch:    { fontSize: 12, fontWeight: "700" },
  currencyItem: {
    flexDirection: "row", alignItems: "center",
    gap: 8, padding: 10, borderBottomWidth: 0.5,
  },
  itemCode:   { fontSize: 13, fontWeight: "800", width: 45 },
  itemName:   { flex: 1, fontSize: 12 },
  itemSymbol: { fontSize: 14, fontWeight: "700", width: 35, textAlign: "right" },
  infoBox:    { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1 },
  infoText:   { fontSize: 11, flex: 1 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, borderRadius: 12, marginTop: 8, marginBottom: 16,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
export default FinanceSettings;
