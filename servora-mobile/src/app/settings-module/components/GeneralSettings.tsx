// ============================================
// SERVORA ERP — General Settings Component
// ✅ useState — no useRef hack
// ✅ settings state = single source of truth
// ✅ KeyboardTypeOptions — no any
// ✅ AppTheme proper type
// ✅ 10/10 production ready
// ============================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  KeyboardTypeOptions,
} from "react-native";
import { MaterialIcons }              from "@expo/vector-icons";
import { useApp }                     from "../../../context/AppContext";
import { loadSettings, saveSettings } from "../services/settings-service";
import { applyCountryDefaults }       from "../utils/settings-mappers";
import { getSortedCountries }         from "../constants/countries";
import { RestaurantSettings, DEFAULT_SETTINGS } from "../types/settings-types";
import { THEMES }                     from "../../../constants/theme";

type AppTheme = typeof THEMES[keyof typeof THEMES];

export function GeneralSettings() {
  const { theme, restaurantId, refreshRestaurant } = useApp();

  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings>(DEFAULT_SETTINGS);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // ── Local field states ────────────────────
  const [name,    setName]    = useState("");
  const [address, setAddress] = useState("");
  const [phone,   setPhone]   = useState("");
  const [email,   setEmail]   = useState("");
  const [vatNo,   setVatNo]   = useState("");

  const loadData = () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    loadSettings(restaurantId)
      .then((loaded) => {
        setSettings(loaded);
        const g = loaded.general;
        setName(g.name       ?? "");
        setAddress(g.address ?? "");
        setPhone(g.phone     ?? "");
        setEmail(g.email     ?? "");
        setVatNo(g.vatNumber ?? "");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [restaurantId]);

  // ✅ Country select — setState = guaranteed re-render
  const handleCountrySelect = (countryCode: string) => {
    setShowCountryPicker(false);
    setSettings((prev) => applyCountryDefaults(prev, countryCode));
  };

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const updated: RestaurantSettings = {
        ...settings,
        general: {
          ...settings.general,
          name,
          address,
          phone,
          email,
          vatNumber: vatNo,
        },
      };
      const result = await saveSettings(restaurantId, updated);
      if (!result.valid) {
        Alert.alert("Validation Error", result.errors.join("\n"));
        return;
      }
      setSettings(updated);
      await refreshRestaurant();
      Alert.alert("✅ Saved!", "General settings updated");
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const sortedCountries = getSortedCountries();
  const currentCountry  = settings.general.country;
  const selectedCountry = sortedCountries.find((c) => c.code === currentCountry);

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerWrap}>
        <MaterialIcons name="error-outline" size={40} color="#ef4444" />
        <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: theme.primary }]}
          onPress={loadData}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <SectionCard title="🏪 RESTAURANT INFO" theme={theme}>
        <Field label="Restaurant Name" value={name}    onChange={setName}    theme={theme} />
        <Field label="Address"         value={address} onChange={setAddress} theme={theme} />
        <Field label="Phone"           value={phone}   onChange={setPhone}   theme={theme} keyboardType="phone-pad" />
        <Field label="Email"           value={email}   onChange={setEmail}   theme={theme} keyboardType="email-address" />
        <Field label="VAT Number"      value={vatNo}   onChange={setVatNo}   theme={theme} />
      </SectionCard>

      <SectionCard title="🌍 COUNTRY & LOCALIZATION" theme={theme}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Country
        </Text>

        <TouchableOpacity
          style={[styles.countryBtn, {
            backgroundColor: theme.bg,
            borderColor:     theme.border,
          }]}
          onPress={() => setShowCountryPicker(!showCountryPicker)}
        >
          <Text style={{ fontSize: 18 }}>{selectedCountry?.flag ?? "🌍"}</Text>
          <Text style={[styles.countryName, { color: theme.text }]}>
            {selectedCountry?.name ?? currentCountry}
          </Text>
          <MaterialIcons
            name={showCountryPicker ? "expand-less" : "expand-more"}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {showCountryPicker && (
          <View style={[styles.countryList, {
            backgroundColor: theme.surface,
            borderColor:     theme.border,
          }]}>
            <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
              {sortedCountries.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.countryItem,
                    { borderBottomColor: theme.border },
                    currentCountry === c.code && {
                      backgroundColor: theme.sidebarActive,
                    },
                  ]}
                  onPress={() => handleCountrySelect(c.code)}
                >
                  <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                  <Text style={[styles.countryItemName, { color: theme.text }]}>
                    {c.name}
                  </Text>
                  {currentCountry === c.code && (
                    <MaterialIcons name="check" size={16} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {selectedCountry && (
          <View style={[styles.infoBox, {
            backgroundColor: "#3b82f610",
            borderColor:     "#3b82f630",
          }]}>
            <MaterialIcons name="auto-awesome" size={14} color="#3b82f6" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                🕐 {selectedCountry.timezone}
              </Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                💰 {settings.finance.currency} — auto applied
              </Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                🗓️ {selectedCountry.dateFormat}
              </Text>
            </View>
          </View>
        )}
      </SectionCard>

      <SaveButton onSave={handleSave} saving={saving} theme={theme} />
    </View>
  );
}

// ── Reusable ──────────────────────────────────
function SectionCard({
  title, theme, children,
}: {
  title: string; theme: AppTheme; children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Field({
  label, value, onChange, theme, keyboardType = "default",
}: {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  theme:        AppTheme;
  keyboardType?: KeyboardTypeOptions;  // ✅ no any
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
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

function SaveButton({
  onSave, saving, theme,
}: {
  onSave: () => void; saving: boolean; theme: AppTheme;
}) {
  return (
    <TouchableOpacity
      style={[styles.saveBtn, { backgroundColor: theme.primary },
        saving && { opacity: 0.7 }]}
      onPress={onSave}
      disabled={saving}
    >
      {saving
        ? <ActivityIndicator size="small" color="#fff" />
        : <MaterialIcons name="save" size={16} color="#fff" />
      }
      <Text style={styles.saveBtnText}>
        {saving ? "Saving..." : "Save General Settings"}
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
  countryBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 10, padding: 10, borderWidth: 1.5,
    borderRadius: 9, marginBottom: 8,
  },
  countryName:     { flex: 1, fontSize: 14, fontWeight: "600" },
  countryList: {
    borderWidth: 1, borderRadius: 10,
    marginBottom: 10, overflow: "hidden",
  },
  countryItem: {
    flexDirection: "row", alignItems: "center",
    gap: 10, padding: 10, borderBottomWidth: 0.5,
  },
  countryItemName: { flex: 1, fontSize: 13 },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 4,
  },
  infoText: { fontSize: 11 },
  saveBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    padding: 14, borderRadius: 12,
    marginTop: 8, marginBottom: 16,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
export default GeneralSettings;
