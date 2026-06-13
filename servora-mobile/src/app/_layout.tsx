// ============================================
// SERVORA ERP — Root Layout
// All routes registered + Sidebar + Navbar
// ============================================

import React, { useState } from "react";
import { Stack } from "expo-router";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Modal, ScrollView, Pressable,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AppProvider, useApp } from "../context/AppContext";
import Sidebar from "../components/Sidebar";
import { THEMES, LANGUAGES, ThemeName, LanguageCode } from "../constants/theme";

function InnerLayout() {
  const { theme, themeName, lang, t, setTheme, setLang } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {isWeb ? (
        <View style={styles.webLayout}>
          <View style={[styles.webSidebar, { backgroundColor: theme.sidebar }]}>
            <Sidebar onClose={() => {}} />
          </View>
          <View style={[styles.webMain, { backgroundColor: theme.bg }]}>
            <Navbar
              isWeb={isWeb} theme={theme} themeName={themeName}
              lang={lang} t={t} setTheme={setTheme} setLang={setLang}
              themeMenuOpen={themeMenuOpen} langMenuOpen={langMenuOpen}
              setThemeMenuOpen={setThemeMenuOpen} setLangMenuOpen={setLangMenuOpen}
              onMenuPress={() => setSidebarOpen(true)}
            />
            <View style={styles.pageContent}>
              <Stack screenOptions={{ headerShown: false }} />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.mobileLayout}>
          <Navbar
            isWeb={isWeb} theme={theme} themeName={themeName}
            lang={lang} t={t} setTheme={setTheme} setLang={setLang}
            themeMenuOpen={themeMenuOpen} langMenuOpen={langMenuOpen}
            setThemeMenuOpen={setThemeMenuOpen} setLangMenuOpen={setLangMenuOpen}
            onMenuPress={() => setSidebarOpen(true)}
          />
          <View style={styles.pageContent}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
          <Modal
            visible={sidebarOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setSidebarOpen(false)}
          >
            <View style={styles.drawerOverlay}>
              <Pressable style={styles.drawerBg} onPress={() => setSidebarOpen(false)} />
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

// ── Navbar ──────────────────────────────────
interface NavbarProps {
  isWeb: boolean;
  theme: typeof THEMES.navyDark;
  themeName: ThemeName;
  lang: LanguageCode;
  t: (key: string) => string;
  setTheme: (name: ThemeName) => void;
  setLang: (code: LanguageCode) => void;
  themeMenuOpen: boolean;
  langMenuOpen: boolean;
  setThemeMenuOpen: (v: boolean) => void;
  setLangMenuOpen: (v: boolean) => void;
  onMenuPress: () => void;
}

function Navbar({
  isWeb, theme, themeName, lang, t,
  setTheme, setLang, themeMenuOpen, langMenuOpen,
  setThemeMenuOpen, setLangMenuOpen, onMenuPress,
}: NavbarProps) {
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
        {/* Theme */}
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnRow]}
            onPress={() => { setThemeMenuOpen(!themeMenuOpen); setLangMenuOpen(false); }}
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
                  style={[styles.dropdownItem, themeName === key && { backgroundColor: theme.sidebarActive }]}
                  onPress={() => { setTheme(key); setThemeMenuOpen(false); }}
                >
                  <View style={[styles.themeColorDot, { backgroundColor: THEMES[key].primary }]} />
                  <Text style={[styles.dropdownText, { color: theme.text }]}>{THEMES[key].name}</Text>
                  {themeName === key && <MaterialIcons name="check" size={14} color={theme.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Language */}
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnRow]}
            onPress={() => { setLangMenuOpen(!langMenuOpen); setThemeMenuOpen(false); }}
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
              {(Object.keys(LANGUAGES) as LanguageCode[]).map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.dropdownItem, lang === code && { backgroundColor: theme.sidebarActive }]}
                  onPress={() => { setLang(code); setLangMenuOpen(false); }}
                >
                  <Text style={styles.flagText}>{LANGUAGES[code].flag}</Text>
                  <Text style={[styles.dropdownText, { color: theme.text }]}>{LANGUAGES[code].name}</Text>
                  {lang === code && <MaterialIcons name="check" size={14} color={theme.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Avatar */}
        <TouchableOpacity style={styles.navBtn}>
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>A</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function Layout() {
  return (
    <AppProvider>
      <InnerLayout />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webLayout: { flex: 1, flexDirection: "row" },
  webSidebar: { width: 240 },
  webMain: { flex: 1, flexDirection: "column" },
  mobileLayout: { flex: 1 },
  drawerOverlay: { flex: 1, flexDirection: "row" },
  drawerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  drawer: { width: 260, position: "absolute", left: 0, top: 0, bottom: 0 },
  navbar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 100,
  },
  navTitle: { flex: 1, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  navRight: { flexDirection: "row", alignItems: "center", marginLeft: "auto", gap: 4 },
  navBtn: { padding: 7, borderRadius: 8 },
  navBtnRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtnText: { fontSize: 12, fontWeight: "600" },
  flagText: { fontSize: 17 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "800" },
  dropdownWrapper: { position: "relative" },
  dropdown: {
    position: "absolute", top: 42, right: 0,
    minWidth: 150, borderRadius: 12,
    elevation: 10, shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8,
    zIndex: 999, overflow: "hidden",
  },
  langDropdown: { maxHeight: 300 },
  dropdownItem: {
    flexDirection: "row", alignItems: "center",
    gap: 8, paddingVertical: 9, paddingHorizontal: 12,
  },
  dropdownText: { fontSize: 12, fontWeight: "500", flex: 1 },
  themeColorDot: { width: 12, height: 12, borderRadius: 6 },
  pageContent: { flex: 1 },
});