import React from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView, Platform,
} from "react-native";
import { router, usePathname } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";

type Props = { onClose: () => void };
type MenuItem = {
  labelKey: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: string;
};

const MENU_SECTIONS: { titleKey: string; items: MenuItem[] }[] = [
  {
    titleKey: "main",
    items: [
      { labelKey: "dashboard", icon: "dashboard", route: "/dashboard" },
    ],
  },
  {
    titleKey: "operations",
    items: [
      { labelKey: "salesEntry",  icon: "point-of-sale",  route: "/add-sale"          },
      { labelKey: "salesList",   icon: "list-alt",       route: "/sales-list"        },
      { labelKey: "expenses",    icon: "receipt",        route: "/expenses"          },
      { labelKey: "inventory",   icon: "inventory",      route: "/inventory-module"  },
      { labelKey: "kitchen",     icon: "restaurant",     route: "/kitchen-module"    },
      { labelKey: "store",       icon: "store",          route: "/store-module"      },
      { labelKey: "employees",   icon: "badge",          route: "/employees-module"  },
      { labelKey: "attendance",  icon: "fact-check",     route: "/attendance-module" },
    ],
  },
  {
    titleKey: "finance",
    items: [
      { labelKey: "payroll",    icon: "payments",       route: "/payroll-module"      },
      { labelKey: "schedule",   icon: "calendar-month", route: "/schedule-module"     },
      // ✅ Labour Cost added
      { labelKey: "labourCost", icon: "trending-up",    route: "/labour-cost-module"  },
      { labelKey: "reports",    icon: "bar-chart",      route: "/analytics"           },
    ],
  },
  {
    titleKey: "system",
    items: [
      { labelKey: "settings", icon: "settings", route: "/settings-module" },
    ],
  },
];

export default function Sidebar({ onClose }: Props) {
  const { theme, t } = useApp();
  const pathname = usePathname();

  const navigate = (route: string) => {
    router.push(route as any);
    if (Platform.OS !== "web") onClose();
  };

  const handleLogout = async () => {
    try {
      const { auth }     = await import("../firebase");
      const { signOut }  = await import("firebase/auth");
      await signOut(auth);
    } catch (_) {}
    router.replace("/login" as any);
    if (Platform.OS !== "web") onClose();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.sidebar }]}>
      {/* Logo */}
      <View style={[styles.logoContainer, { borderBottomColor: theme.border }]}>
        <View style={[styles.logoIcon, { backgroundColor: theme.accent + "22" }]}>
          <MaterialIcons name="restaurant" size={22} color={theme.accent} />
        </View>
        <View style={styles.logoTextWrap}>
          <Text style={[styles.logoText, { color: theme.accent }]}>
            SERVORA ERP
          </Text>
          <Text style={[styles.logoSub, { color: theme.sidebarSection }]}>
            {t("appSubtitle")}
          </Text>
        </View>
      </View>

      {/* Menu */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {MENU_SECTIONS.map((section) => (
          <View key={section.titleKey} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.sidebarSection }]}>
              {t(section.titleKey)}
            </Text>
            {section.items.map((item) => {
              const isActive =
                pathname === item.route ||
                pathname.startsWith(item.route + "/") ||
                (item.route === "/dashboard" && pathname === "/");
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[
                    styles.menuItem,
                    isActive && { backgroundColor: theme.sidebarActive },
                  ]}
                  onPress={() => navigate(item.route)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={19}
                    color={isActive
                      ? theme.sidebarActiveText
                      : theme.sidebarText}
                  />
                  <Text
                    style={[
                      styles.menuText,
                      {
                        color: isActive
                          ? theme.sidebarActiveText
                          : theme.sidebarText,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {t(item.labelKey)}
                  </Text>
                  {isActive && (
                    <View style={[
                      styles.activeBar,
                      { backgroundColor: theme.sidebarActiveText },
                    ]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <MaterialIcons name="logout" size={18} color="#ff6b6b" />
        <Text style={styles.logoutText}>{t("logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:       1,
    paddingTop: Platform.OS === "web" ? 0 : 44,
  },
  logoContainer: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   18,
    borderBottomWidth: 1,
  },
  logoIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  logoTextWrap: { flex: 1 },
  logoText: {
    fontSize:      14,
    fontWeight:    "800",
    letterSpacing: 0.8,
  },
  logoSub: {
    fontSize:  9,
    marginTop: 1,
  },
  scroll: { flex: 1 },
  section: {
    paddingTop:        16,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize:      9,
    fontWeight:    "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom:  4,
    paddingLeft:   10,
  },
  menuItem: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    paddingVertical:   9,
    paddingHorizontal: 10,
    borderRadius:      9,
    marginBottom:      1,
    position:          "relative",
  },
  menuText: {
    fontSize: 13,
    flex:     1,
  },
  activeBar: {
    position:     "absolute",
    right:        0,
    top:          "20%",
    width:        3,
    height:       "60%",
    borderRadius: 2,
  },
  logoutBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    margin:          12,
    padding:         12,
    backgroundColor: "rgba(255,107,107,0.1)",
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     "rgba(255,107,107,0.25)",
  },
  logoutText: {
    color:      "#ff6b6b",
    fontSize:   13,
    fontWeight: "700",
  },
});