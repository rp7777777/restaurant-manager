// ============================================
// SERVORA ERP — Homepage / Landing Page
// Beautiful hero + features + CTA
// ============================================

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

// ── Feature cards data ─────────────────────
const FEATURES = [
  { icon: "point-of-sale", labelKey: "salesEntry", color: "#10b981" },
  { icon: "inventory", labelKey: "inventory", color: "#3b82f6" },
  { icon: "receipt", labelKey: "expenses", color: "#ef4444" },
  { icon: "bar-chart", labelKey: "reports", color: "#f59e0b" },
  { icon: "people", labelKey: "payroll", color: "#8b5cf6" },
  { icon: "restaurant", labelKey: "kitchen", color: "#ec4899" },
  { icon: "local-shipping", labelKey: "delivery", color: "#06b6d4" },
  { icon: "storefront", labelKey: "pos", color: "#84cc16" },
];

// ── Stat items ─────────────────────────────
const STATS = [
  { value: "10M+", label: "Users" },
  { value: "50K+", label: "Restaurants" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" },
];

export default function HomePage() {
  const { theme, t } = useApp();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Section ── */}
      <LinearGradient
        colors={["#00154f", "#0039cb", "#1565c0"]}
        style={styles.hero}
      >
        {/* Decorative circles */}
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />

        <Animated.View
          style={[
            styles.heroContent,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Badge */}
          <View style={styles.badge}>
            <MaterialIcons name="verified" size={14} color="#FFD700" />
            <Text style={styles.badgeText}>
              Enterprise Restaurant ERP
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.heroTitle}>SERVORA ERP</Text>
          <Text style={styles.heroSubtitle}>
            {t("appSubtitle")}
          </Text>
          <Text style={styles.heroDesc}>
            The complete restaurant management platform — sales, inventory,
            payroll, kitchen, delivery and more. Built for scale.
          </Text>

          {/* CTA Buttons */}
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.ctaPrimary}
              onPress={() => router.push("/login" as any)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="login" size={18} color="#00154f" />
              <Text style={styles.ctaPrimaryText}>{t("login")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => router.push("/dashboard" as any)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="dashboard" size={18} color="#fff" />
              <Text style={styles.ctaSecondaryText}>{t("dashboard")}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* ── Stats Bar ── */}
      <View style={[styles.statsBar, { backgroundColor: theme.surface }]}>
        {STATS.map((stat, i) => (
          <View
            key={stat.label}
            style={[
              styles.statItem,
              i < STATS.length - 1 && {
                borderRightWidth: 1,
                borderRightColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Features Section ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Everything You Need
        </Text>
        <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
          Powerful modules to run every aspect of your restaurant
        </Text>

        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <TouchableOpacity
              key={f.labelKey}
              style={[styles.featureCard, { backgroundColor: theme.card }]}
              onPress={() => router.push("/dashboard" as any)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: f.color + "18" },
                ]}
              >
                <MaterialIcons
                  name={f.icon as any}
                  size={28}
                  color={f.color}
                />
              </View>
              <Text
                style={[styles.featureLabel, { color: theme.text }]}
                numberOfLines={1}
              >
                {t(f.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Why Servora Section ── */}
      <View
        style={[styles.whySection, { backgroundColor: theme.surface }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Why Servora ERP?
        </Text>

        {[
          {
            icon: "bolt",
            color: "#f59e0b",
            title: "Real-time Data",
            desc: "All data syncs instantly via Firebase across all devices.",
          },
          {
            icon: "language",
            color: "#3b82f6",
            title: "10 Languages",
            desc: "Full support for EN, NP, PT, ES, FR, AR, ZH, HI, DE, IT.",
          },
          {
            icon: "palette",
            color: "#8b5cf6",
            title: "3 Themes",
            desc: "Navy Dark, Purple Dark, and Light — switch anytime.",
          },
          {
            icon: "devices",
            color: "#10b981",
            title: "Web & Mobile",
            desc: "Works perfectly on browser, Android and iOS.",
          },
          {
            icon: "security",
            color: "#ef4444",
            title: "Enterprise Security",
            desc: "Role-based access, audit logs, and Firebase Auth.",
          },
          {
            icon: "cloud-done",
            color: "#06b6d4",
            title: "Cloud Backup",
            desc: "Automatic Firestore backup — never lose your data.",
          },
        ].map((item) => (
          <View
            key={item.title}
            style={[styles.whyItem, { borderBottomColor: theme.border }]}
          >
            <View
              style={[
                styles.whyIcon,
                { backgroundColor: item.color + "18" },
              ]}
            >
              <MaterialIcons
                name={item.icon as any}
                size={22}
                color={item.color}
              />
            </View>
            <View style={styles.whyText}>
              <Text style={[styles.whyTitle, { color: theme.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.whyDesc, { color: theme.textSecondary }]}>
                {item.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Bottom CTA ── */}
      <LinearGradient
        colors={["#00154f", "#0039cb"]}
        style={styles.bottomCta}
      >
        <Text style={styles.bottomCtaTitle}>
          Ready to get started?
        </Text>
        <Text style={styles.bottomCtaSub}>
          Join thousands of restaurants worldwide
        </Text>
        <TouchableOpacity
          style={styles.bottomCtaBtn}
          onPress={() => router.push("/login" as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.bottomCtaBtnText}>
            {t("login")} →
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.bg }]}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          © 2026 Servora ERP. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Hero
  hero: {
    paddingTop: isWeb ? 80 : 60,
    paddingBottom: 60,
    paddingHorizontal: 24,
    overflow: "hidden",
    position: "relative",
  },
  circle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -80,
    right: -80,
  },
  circle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -60,
    left: -60,
  },
  circle3: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,215,0,0.06)",
    top: 40,
    left: "40%",
  },
  heroContent: {
    maxWidth: 700,
    alignSelf: isWeb ? "center" : "flex-start",
    width: "100%",
    alignItems: isWeb ? "center" : "flex-start",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,215,0,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "600",
  },
  heroTitle: {
    fontSize: isWeb ? 56 : 38,
    fontWeight: "900",
    color: "#FFD700",
    letterSpacing: 2,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: isWeb ? 22 : 16,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    marginBottom: 16,
  },
  heroDesc: {
    fontSize: isWeb ? 16 : 14,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 500,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  ctaPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFD700",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaPrimaryText: {
    color: "#00154f",
    fontSize: 15,
    fontWeight: "800",
  },
  ctaSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  ctaSecondaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Stats
  statsBar: {
    flexDirection: "row",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  statValue: {
    fontSize: isWeb ? 24 : 20,
    fontWeight: "900",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  // Features
  section: {
    padding: 24,
    paddingTop: 40,
  },
  sectionTitle: {
    fontSize: isWeb ? 28 : 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: isWeb ? "center" : "left",
  },
  sectionSub: {
    fontSize: 14,
    marginBottom: 28,
    textAlign: isWeb ? "center" : "left",
    lineHeight: 22,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureCard: {
    width: isWeb ? "22%" : "47%",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  // Why section
  whySection: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    overflow: "hidden",
  },
  whyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  whyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  whyText: {
    flex: 1,
  },
  whyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  whyDesc: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Bottom CTA
  bottomCta: {
    margin: 16,
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
  },
  bottomCtaTitle: {
    fontSize: isWeb ? 28 : 22,
    fontWeight: "900",
    color: "#FFD700",
    marginBottom: 8,
    textAlign: "center",
  },
  bottomCtaSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 24,
    textAlign: "center",
  },
  bottomCtaBtn: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bottomCtaBtnText: {
    color: "#00154f",
    fontSize: 16,
    fontWeight: "800",
  },

  // Footer
  footer: {
    padding: 24,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
  },
});