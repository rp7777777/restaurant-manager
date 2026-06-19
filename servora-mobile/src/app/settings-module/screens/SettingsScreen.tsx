import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Platform,
} from "react-native";
import { LinearGradient }    from "expo-linear-gradient";
import { useApp }            from "../../../context/AppContext";
import {
  SettingsTabKey,
  getAccessibleTabs,
} from "../constants/settings-tabs";
import { getRolePermissions, AppRole } from "../constants/permissions";
import { GeneralSettings }    from "../components/GeneralSettings";
import { FinanceSettings }    from "../components/FinanceSettings";
import { AttendanceSettings } from "../components/AttendanceSettings";
import { PayrollSettings }    from "../components/PayrollSettings";
import { LeaveSettings }      from "../components/LeaveSettings";
import { EmployeeDefaults }   from "../components/EmployeeDefaults";
import { SecuritySettings }   from "../components/SecuritySettings";

const TAB_COMPONENTS: Record<SettingsTabKey, React.ComponentType> = {
  general:    GeneralSettings,
  finance:    FinanceSettings,
  attendance: AttendanceSettings,
  payroll:    PayrollSettings,
  leave:      LeaveSettings,
  employees:  EmployeeDefaults,
  security:   SecuritySettings,
};

export default function SettingsScreen() {
  const { theme, userProfile } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("general");

  const userPermissions = useMemo(() => {
    const role = userProfile?.role as AppRole | undefined;
    if (!role) return [];
    return getRolePermissions(role);
  }, [userProfile?.role]);

  const visibleTabs = useMemo(
    () => getAccessibleTabs(userPermissions),
    [userPermissions]
  );

  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? "general");
    }
  }, [visibleTabs, activeTab]);

  if (visibleTabs.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
          <Text style={styles.title}>SETTINGS</Text>
          <Text style={styles.subtitle}>Restaurant Configuration</Text>
        </LinearGradient>
        <View style={styles.noAccess}>
          <Text style={[styles.noAccessText, { color: theme.textSecondary }]}>
            🔒 No settings access
          </Text>
          <Text style={[styles.noAccessSub, { color: theme.textSecondary }]}>
            Contact your manager for access
          </Text>
        </View>
      </View>
    );
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={["#00154f", "#0039cb"]} style={styles.header}>
        <Text style={styles.title}>SETTINGS</Text>
        <Text style={styles.subtitle}>Restaurant Configuration</Text>
      </LinearGradient>

      <View style={[styles.tabBar, {
        backgroundColor:   theme.card,
        borderBottomColor: theme.border,
      }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  isActive && {
                    borderBottomColor: theme.primary,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={styles.tabEmoji}>{tab.emoji}</Text>
                <Text style={[
                  styles.tabLabel,
                  { color: isActive ? theme.primary : theme.textSecondary },
                  isActive && { fontWeight: "800" },
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ActiveComponent />
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    paddingTop:        Platform.OS === "web" ? 24 : 48,
    paddingBottom:     16,
    paddingHorizontal: 16,
  },
  title:    { color: "#FFD700", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 },
  tabBar:   { borderBottomWidth: 1 },
  tab: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  tabEmoji:     { fontSize: 16 },
  tabLabel:     { fontSize: 12 },
  content:      { flex: 1, padding: 12 },
  noAccess: {
    flex:           1,
    justifyContent: "center",
    alignItems:     "center",
    gap:            8,
  },
  noAccessText: { fontSize: 18, fontWeight: "800" },
  noAccessSub:  { fontSize: 13 },
});