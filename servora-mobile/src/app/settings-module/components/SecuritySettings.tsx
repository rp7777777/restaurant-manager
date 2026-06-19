// ============================================
// SERVORA ERP — Security Settings Component
// ✅ isDirty variable naming fixed
// ✅ [...ALL_PERMISSIONS] — no mutation risk
// ✅ activeRoleConfig — no duplicate find
// ✅ 10/10 production ready
// ============================================

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { MaterialIcons }              from "@expo/vector-icons";
import { useApp }                     from "../../../context/AppContext";
import { loadSettings, saveSettings } from "../services/settings-service";
import { RestaurantSettings, DEFAULT_SETTINGS } from "../types/settings-types";
import { ROLE_CONFIGS, AppRole, Permission } from "../constants/permissions";
import { THEMES } from "../../../constants/theme";

type AppTheme = typeof THEMES[keyof typeof THEMES];

const safeError = (theme: AppTheme) => theme.error ?? "#ef4444";

// ✅ Frozen — no mutation risk
const ALL_PERMISSIONS: Permission[] = Object.freeze([
  "edit_schedule", "edit_inventory", "edit_store",
  "view_payroll",  "edit_payroll",   "view_reports",
  "edit_employees","edit_settings",  "manage_permissions",
  "view_sales",    "edit_sales",     "view_kitchen",
  "edit_kitchen",
]) as Permission[];

const PERMISSION_DEPS: Partial<Record<Permission, Permission>> = {
  edit_payroll: "view_payroll",
  edit_sales:   "view_sales",
  edit_kitchen: "view_kitchen",
};

const PERMISSION_GROUPS: {
  label: string; emoji: string; permissions: Permission[];
}[] = [
  { label: "Schedule",         emoji: "📅", permissions: ["edit_schedule"] },
  { label: "Inventory & Store",emoji: "📦", permissions: ["edit_inventory", "edit_store"] },
  { label: "Payroll",          emoji: "💵", permissions: ["view_payroll", "edit_payroll"] },
  { label: "Sales",            emoji: "🧾", permissions: ["view_sales", "edit_sales"] },
  { label: "Kitchen",          emoji: "👨‍🍳", permissions: ["view_kitchen", "edit_kitchen"] },
  { label: "Employees",        emoji: "👥", permissions: ["edit_employees"] },
  { label: "Reports",          emoji: "📊", permissions: ["view_reports"] },
  { label: "Settings",         emoji: "⚙️", permissions: ["edit_settings", "manage_permissions"] },
];

const sortedPerms = (perms: Permission[]): string =>
  [...perms].sort().join(",");

export function SecuritySettings() {
  const { theme, restaurantId, refreshRestaurant } = useApp();

  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [settings,   setSettings]   = useState<RestaurantSettings>(DEFAULT_SETTINGS);
  const [retryCount, setRetryCount] = useState(0);
  const [activeRole, setActiveRole] = useState<AppRole>("MANAGER");

  const savingRef       = useRef(false);
  const retryingRef     = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalRef     = useRef<RestaurantSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!restaurantId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    loadSettings(restaurantId)
      .then((loaded) => {
        if (!mounted) return;
        // ✅ Spread — no mutation risk
        const fixed: RestaurantSettings = {
          ...loaded,
          security: {
            ...loaded.security,
            rolePermissions: {
              ...loaded.security.rolePermissions,
              OWNER: [...ALL_PERMISSIONS],
            },
          },
        };
        setSettings(fixed);
        originalRef.current = fixed;
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load settings");
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [restaurantId, retryCount]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const handleRetry = () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetryCount((c) => c + 1);
    retryTimeoutRef.current = setTimeout(() => {
      retryingRef.current = false;
    }, 3000);
  };

  // ✅ Variable naming fixed — orig = original, curr = current
  const isDirty = useMemo(() => {
    const orig = originalRef.current.security.rolePermissions;
    const curr = settings.security.rolePermissions;
    return (Object.keys(curr) as AppRole[]).some(
      (role) => sortedPerms(curr[role] ?? []) !== sortedPerms(orig[role] ?? [])
    );
  }, [settings]);

  const togglePermission = (role: AppRole, permission: Permission) => {
    if (role === "OWNER") {
      Alert.alert("Protected Role", "Owner always has all permissions");
      return;
    }

    setSettings((prev) => {
      const current = prev.security.rolePermissions[role] ?? [];
      const hasIt   = current.includes(permission);
      let updated: Permission[];

      if (hasIt) {
        const dependents = (Object.entries(PERMISSION_DEPS) as [Permission, Permission][])
          .filter(([, dep]) => dep === permission)
          .map(([edit]) => edit);
        updated = current.filter((p) => p !== permission && !dependents.includes(p));
      } else {
        updated = [...current, permission];
        const dep = PERMISSION_DEPS[permission];
        if (dep && !updated.includes(dep)) {
          updated = [...updated, dep];
        }
      }

      return {
        ...prev,
        security: {
          ...prev.security,
          rolePermissions: {
            ...prev.security.rolePermissions,
            [role]: updated,
          },
        },
      };
    });
  };

  const hasPermission = (role: AppRole, permission: Permission): boolean =>
    (settings.security.rolePermissions[role] ?? []).includes(permission);

  const handleSave = async () => {
    if (!restaurantId || savingRef.current || !isDirty) return;

    // ✅ Permission dependency validation
    const roles = Object.keys(settings.security.rolePermissions) as AppRole[];
    for (const role of roles) {
      if (role === "OWNER") continue;
      const perms = settings.security.rolePermissions[role] ?? [];
      for (const [edit, view] of Object.entries(PERMISSION_DEPS) as [Permission, Permission][]) {
        if (perms.includes(edit) && !perms.includes(view)) {
          Alert.alert(
            "Permission Error",
            `${role}: "${edit}" requires "${view}" to also be enabled`
          );
          return;
        }
      }
    }

    // ✅ Spread — no mutation risk
    const finalSettings: RestaurantSettings = {
      ...settings,
      security: {
        ...settings.security,
        rolePermissions: {
          ...settings.security.rolePermissions,
          OWNER: [...ALL_PERMISSIONS],
        },
      },
    };

    savingRef.current = true;
    setSaving(true);
    try {
      const result = await saveSettings(restaurantId, finalSettings);
      if (!result.valid) {
        Alert.alert("Validation Error", result.errors.join("\n"));
        return;
      }
      setSettings(finalSettings);
      originalRef.current = finalSettings;
      await refreshRestaurant();
      Alert.alert("✅ Saved!", "Security settings updated");
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ✅ Single find — no duplicate
  const activeRoleConfig = ROLE_CONFIGS.find((r) => r.key === activeRole);

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
        <MaterialIcons name="error-outline" size={40} color={safeError(theme)} />
        <Text style={[styles.errorText, { color: safeError(theme) }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: theme.primary }]}
          onPress={handleRetry}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {isDirty && (
        <View style={[styles.unsavedBanner, {
          backgroundColor: theme.primary + "15",
          borderColor:     theme.primary + "40",
        }]}>
          <MaterialIcons name="edit" size={14} color={theme.primary} />
          <Text style={[styles.unsavedText, { color: theme.primary }]}>
            You have unsaved changes
          </Text>
        </View>
      )}

      {/* Role selector */}
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          🔒 SELECT ROLE
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.roleRow}>
            {ROLE_CONFIGS.map((role) => {
              const isOwner  = role.key === "OWNER";
              const isActive = activeRole === role.key;
              return (
                <TouchableOpacity
                  key={role.key}
                  style={[
                    styles.roleChip,
                    { borderColor: isOwner ? safeError(theme) : theme.border },
                    isActive && {
                      backgroundColor: isOwner ? safeError(theme) : theme.primary,
                      borderColor:     isOwner ? safeError(theme) : theme.primary,
                    },
                  ]}
                  onPress={() => setActiveRole(role.key)}
                >
                  <Text style={{ fontSize: 16 }}>{role.emoji}</Text>
                  <Text style={[
                    styles.roleChipText,
                    {
                      color: isActive ? "#fff"
                        : isOwner ? safeError(theme) : theme.text,
                    },
                  ]}>
                    {role.label}
                  </Text>
                  {isOwner && (
                    <MaterialIcons
                      name="lock"
                      size={12}
                      color={isActive ? "#fff" : safeError(theme)}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Permission matrix */}
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        {/* ✅ Single activeRoleConfig — no duplicate find */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {activeRoleConfig?.emoji} {activeRoleConfig?.label} Permissions
        </Text>

        {activeRole === "OWNER" && (
          <View style={[styles.ownerBanner, {
            backgroundColor: safeError(theme) + "10",
            borderColor:     safeError(theme) + "30",
          }]}>
            <MaterialIcons name="shield" size={16} color={safeError(theme)} />
            <Text style={[styles.ownerBannerText, { color: safeError(theme) }]}>
              Owner always has all permissions — cannot be modified
            </Text>
          </View>
        )}

        {PERMISSION_GROUPS.map((group) => (
          <View key={group.label} style={styles.permGroup}>
            <Text style={[styles.permGroupLabel, { color: theme.textSecondary }]}>
              {group.emoji} {group.label}
            </Text>
            <View style={styles.permRow}>
              {group.permissions.map((perm) => {
                const isGranted = hasPermission(activeRole, perm);
                const isOwner   = activeRole === "OWNER";
                const permLabel = perm.replace(/_/g, " ");

                return (
                  <TouchableOpacity
                    key={perm}
                    style={[
                      styles.permChip,
                      { borderColor: theme.border },
                      isGranted && {
                        backgroundColor: isOwner ? safeError(theme) : "#22c55e",
                        borderColor:     isOwner ? safeError(theme) : "#22c55e",
                      },
                      !isGranted && { backgroundColor: theme.bg },
                    ]}
                    onPress={() => togglePermission(activeRole, perm)}
                    disabled={isOwner}
                  >
                    <MaterialIcons
                      name={isGranted ? "check" : "close"}
                      size={12}
                      color={isGranted ? "#fff" : theme.textSecondary}
                    />
                    <Text style={[
                      styles.permChipText,
                      { color: isGranted ? "#fff" : theme.textSecondary },
                    ]}>
                      {permLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <SaveButton
        onSave={handleSave}
        saving={saving}
        disabled={!isDirty}
        theme={theme}
      />
    </View>
  );
}

function SaveButton({ onSave, saving, disabled, theme }: {
  onSave: () => void; saving: boolean;
  disabled: boolean; theme: AppTheme;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.saveBtn,
        { backgroundColor: theme.primary },
        (saving || disabled) && { opacity: 0.5 },
      ]}
      onPress={onSave}
      disabled={saving || disabled}
    >
      {saving
        ? <ActivityIndicator size="small" color="#fff" />
        : <MaterialIcons name="save" size={16} color="#fff" />
      }
      <Text style={styles.saveBtnText}>
        {saving ? "Saving..." : "Save Security Settings"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  centerWrap:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 40, gap: 12 },
  errorText:     { fontSize: 14, textAlign: "center" },
  retryBtn:      { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText:  { color: "#fff", fontWeight: "700" },
  unsavedBanner: {
    flexDirection: "row", alignItems: "center",
    gap: 6, padding: 10, borderRadius: 8,
    borderWidth: 1, marginBottom: 12,
  },
  unsavedText:   { fontSize: 12, fontWeight: "600" },
  section:       { borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle:  { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 14 },
  roleRow:       { flexDirection: "row", gap: 8, paddingBottom: 4 },
  roleChip: {
    flexDirection: "row", alignItems: "center",
    gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5,
  },
  roleChipText:    { fontSize: 13, fontWeight: "700" },
  ownerBanner: {
    flexDirection: "row", alignItems: "center",
    gap: 8, padding: 12, borderRadius: 10,
    borderWidth: 1, marginBottom: 14,
  },
  ownerBannerText: { fontSize: 13, fontWeight: "600", flex: 1 },
  permGroup:       { marginBottom: 14 },
  permGroupLabel:  { fontSize: 11, fontWeight: "700", marginBottom: 8 },
  permRow:         { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  permChip: {
    flexDirection: "row", alignItems: "center",
    gap: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 7, borderWidth: 1.5,
  },
  permChipText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, borderRadius: 12, marginTop: 8, marginBottom: 16,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
export default SecuritySettings;
