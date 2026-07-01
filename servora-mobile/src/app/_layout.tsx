// ============================================
// SERVORA ERP — Root Layout v7 — FINAL
// ✅ SafeAreaProvider — app root level
// ✅ Single source of truth — dropdown state
// ✅ Navbar — React.memo
// ✅ LANGUAGE_LIST — ordered, single source
// ✅ Root-level backdrop — reliable full coverage
// ✅ Avatar — user initials from AppContext
// ✅ Stack animation — fade + gesture
// ✅ New translation system — 14 languages
// FROZEN
// ============================================

import React, { useState, useCallback } from "react";
import { Stack } from "expo-router";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Modal, ScrollView, Pressable,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { MaterialIcons }                  from "@expo/vector-icons";
import { AppProvider, useApp }            from "../context/AppContext";
import Sidebar                            from "../components/Sidebar";
import { THEMES, ThemeName }              from "../constants/theme";
import { LANGUAGES, LANGUAGE_LIST }       from "../constants/languages";

// ── Navbar Props ──────────────────────────────
interface NavbarProps {
  onMenuPress:   () => void;
  themeMenuOpen: boolean;
  langMenuOpen:  boolean;
  onThemeToggle: () => void;
  onLangToggle:  () => void;
  onCloseAll:    () => void;
}

// ✅ React.memo — no unnecessary re-render
const Navbar = React.memo(function Navbar({
  onMenuPress,
  themeMenuOpen,
  langMenuOpen,
  onThemeToggle,
  onLangToggle,
  onCloseAll,
}: NavbarProps) {
 const {
  theme, themeName, lang,
  setTheme, setLang, userProfile,
 } = useApp();
  const isWeb = Platform.OS === "web";

  // ✅ name — correct field
  const initials = userProfile
    ? (userProfile.name?.[0] ?? userProfile.email?.[0] ?? "A").toUpperCase()
    : "A";

  return (
    <View style={[styles.navbar, { backgroundColor: theme.navBg }]}>
      {!isWeb && (
        <TouchableOpacity style={styles.navBtn} onPress={onMenuPress}>
          <MaterialIcons name="menu" size={24} color={theme.navText} />
        </TouchableOpacity>
      )}
      {!isWeb && (
        <Text style={[styles.navTitle, { color: theme.accent }]}>
          SERVORA ERP
        </Text>
      )}

      <View style={styles.navRight}>

        {/* ── Theme ── */}
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnRow]}
            onPress={onThemeToggle}
          >
            <MaterialIcons name="palette" size={18} color={theme.navText} />
            {isWeb && (
              <Text style={[styles.navBtnText, { color: theme.navText }]}>
                {THEMES[themeName].name}
              </Text>
            )}
            <MaterialIcons name="arrow-drop-down" size={18} color={theme.navText} />
          </TouchableOpacity>
          {themeMenuOpen && (
            <View style={[styles.dropdown, { backgroundColor: theme.surface }]}>
              {(Object.keys(THEMES) as ThemeName[]).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dropdownItem,
                    themeName === key && { backgroundColor: theme.sidebarActive },
                  ]}
                  onPress={() => { setTheme(key); onCloseAll(); }}
                >
                  <View style={[styles.themeColorDot, { backgroundColor: THEMES[key].primary }]} />
                  <Text style={[styles.dropdownText, { color: theme.text }]}>
                    {THEMES[key].name}
                  </Text>
                  {themeName === key && (
                    <MaterialIcons name="check" size={14} color={theme.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Language ── */}
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnRow]}
            onPress={onLangToggle}
          >
            <Text style={styles.flagText}>{LANGUAGES[lang].flag}</Text>
            {isWeb && (
              <Text style={[styles.navBtnText, { color: theme.navText }]}>
                {LANGUAGES[lang].name}
              </Text>
            )}
            <MaterialIcons name="arrow-drop-down" size={18} color={theme.navText} />
          </TouchableOpacity>
          {langMenuOpen && (
            <ScrollView
              style={[styles.dropdown, styles.langDropdown, { backgroundColor: theme.surface }]}
              showsVerticalScrollIndicator={false}
            >
              {/* ✅ LANGUAGE_LIST — ordered, single source */}
              {LANGUAGE_LIST.map(({ code, name, flag }) => (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.dropdownItem,
                    lang === code && { backgroundColor: theme.sidebarActive },
                  ]}
                  onPress={() => { setLang(code); onCloseAll(); }}
                >
                  <Text style={styles.flagText}>{flag}</Text>
                  <Text style={[styles.dropdownText, { color: theme.text }]}>
                    {name}
                  </Text>
                  {lang === code && (
                    <MaterialIcons name="check" size={14} color={theme.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Avatar ── */}
        <TouchableOpacity style={styles.navBtn}>
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {initials}
            </Text>
          </View>
        </TouchableOpacity>

      </View>
    </View>
  );
});

// ── Main Layout ───────────────────────────────
function InnerLayout() {
  const { theme } = useApp();
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [langMenuOpen,  setLangMenuOpen]  = useState(false);

  const isWeb   = Platform.OS === "web";
  const anyOpen = themeMenuOpen || langMenuOpen;

  const handleThemeToggle = useCallback(() => {
    setThemeMenuOpen((v) => !v);
    setLangMenuOpen(false);
  }, []);

  const handleLangToggle = useCallback(() => {
    setLangMenuOpen((v) => !v);
    setThemeMenuOpen(false);
  }, []);

  const handleCloseAll = useCallback(() => {
    setThemeMenuOpen(false);
    setLangMenuOpen(false);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {anyOpen && (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={handleCloseAll}
        />
      )}

      {isWeb ? (
        <View style={styles.webLayout}>
          <View style={[styles.webSidebar, { backgroundColor: theme.sidebar }]}>
            <Sidebar onClose={() => {}} />
          </View>
          <View style={[styles.webMain, { backgroundColor: theme.bg }]}>
            <Navbar
              onMenuPress={() => setSidebarOpen(true)}
              themeMenuOpen={themeMenuOpen}
              langMenuOpen={langMenuOpen}
              onThemeToggle={handleThemeToggle}
              onLangToggle={handleLangToggle}
              onCloseAll={handleCloseAll}
            />
            <View style={styles.pageContent}>
              <Stack screenOptions={{
                headerShown:    false,
                animation:      "fade",
                gestureEnabled: true,
              }} />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.mobileLayout}>
          <Navbar
            onMenuPress={() => setSidebarOpen(true)}
            themeMenuOpen={themeMenuOpen}
            langMenuOpen={langMenuOpen}
            onThemeToggle={handleThemeToggle}
            onLangToggle={handleLangToggle}
            onCloseAll={handleCloseAll}
          />
          <View style={styles.pageContent}>
            <Stack screenOptions={{
              headerShown:    false,
              animation:      "fade",
              gestureEnabled: true,
            }} />
          </View>
          <Modal
            visible={sidebarOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setSidebarOpen(false)}
          >
            <View style={styles.drawerOverlay}>
              <Pressable
                style={styles.drawerBg}
                onPress={() => setSidebarOpen(false)}
              />
              <View style={[styles.drawer, { backgroundColor: theme.sidebar }]}>
                <Sidebar onClose={() => setSidebarOpen(false)} />
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <AppProvider>
          <InnerLayout />
        </AppProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1 },
  root:          { flex: 1 },
  webLayout:     { flex: 1, flexDirection: "row" },
  webSidebar:    { width: 240 },
  webMain:       { flex: 1, flexDirection: "column" },
  mobileLayout:  { flex: 1 },
  drawerOverlay: { flex: 1, flexDirection: "row" },
  drawerBg:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  drawer:        { width: 260, position: "absolute", left: 0, top: 0, bottom: 0 },
  navbar: {
    minHeight:         56,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 12,
    elevation:         4,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.15,
    shadowRadius:      4,
    zIndex:            100,
  },
  navTitle:   { flex: 1, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  navRight:   { flexDirection: "row", alignItems: "center", marginLeft: "auto", gap: 4 },
  navBtn:     { padding: 7, borderRadius: 8 },
  navBtnRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtnText: { fontSize: 12, fontWeight: "600" },
  flagText:   { fontSize: 17 },
  avatar: {
    width:          30,
    height:         30,
    borderRadius:   15,
    alignItems:     "center",
    justifyContent: "center",
  },
  avatarText:      { fontSize: 13, fontWeight: "800" },
  dropdownWrapper: { position: "relative" },
  dropdown: {
    position:      "absolute",
    top:           42,
    right:         0,
    minWidth:      150,
    borderRadius:  12,
    elevation:     10,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius:  8,
    zIndex:        200,
    overflow:      "hidden",
  },
  langDropdown:  { maxHeight: 300 },
  dropdownItem: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingVertical:   9,
    paddingHorizontal: 12,
  },
  dropdownText:   { fontSize: 12, fontWeight: "500", flex: 1 },
  themeColorDot:  { width: 12, height: 12, borderRadius: 6 },
  pageContent:    { flex: 1 },
});