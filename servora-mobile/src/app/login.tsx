// ============================================
// SERVORA ERP — Login Screen
// Role-based redirect after login
// ============================================

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useApp } from "../context/AppContext";
import { ROLE_HOME } from "./auth-guard";

const isWeb = Platform.OS === "web";

export default function LoginScreen() {
  const { theme, t } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const shakeCard = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const validate = (): boolean => {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setError("");

    if (!email.trim()) {
      setEmailError("Email is required");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      valid = false;
    }

    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) {
      shakeCard();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = credential.user;

      // Email verification check
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        setError("Email not verified. A verification link has been sent.");
        setLoading(false);
        shakeCard();
        return;
      }

      // Get role from Firestore
      let role = "SALESMAN";
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          role = userDoc.data().role ?? "SALESMAN";
          // Check if account is active
          if (userDoc.data().active === false) {
            setError("Your account has been deactivated. Contact your manager.");
            setLoading(false);
            shakeCard();
            await auth.signOut();
            return;
          }
        }
      } catch {
        role = "SALESMAN";
      }

      // Redirect based on role
      const home = ROLE_HOME[role] ?? "/dashboard";
      router.replace(home as any);

    } catch (err: any) {
      const code = err?.code ?? "";
      if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Check your connection.");
      } else {
        setError(err?.message ?? "Login failed.");
      }
      shakeCard();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Left panel — web only */}
        {isWeb && (
          <LinearGradient
            colors={["#00154f", "#0039cb", "#1565c0"]}
            style={styles.leftPanel}
          >
            <View style={styles.leftContent}>
              <View style={styles.leftBadge}>
                <MaterialIcons name="verified" size={16} color="#FFD700" />
                <Text style={styles.leftBadgeText}>Enterprise ERP</Text>
              </View>
              <Text style={styles.leftTitle}>SERVORA ERP</Text>
              <Text style={styles.leftSub}>{t("appSubtitle")}</Text>
              <Text style={styles.leftDesc}>
                Manage your restaurant with real-time data, role-based
                access, multi-branch support and enterprise-grade security.
              </Text>

              {/* Role info */}
              <Text style={styles.rolesTitle}>Login Roles:</Text>
              {[
                { icon: "manage-accounts", color: "#3b82f6", role: "Manager", desc: "Full access" },
                { icon: "restaurant", color: "#10b981", role: "Chef", desc: "Kitchen requests" },
                { icon: "inventory", color: "#f59e0b", role: "Store", desc: "Stock management" },
                { icon: "point-of-sale", color: "#8b5cf6", role: "Salesman", desc: "Sales entry" },
              ].map((r) => (
                <View key={r.role} style={styles.roleRow}>
                  <View style={[styles.roleIcon, { backgroundColor: r.color + "22" }]}>
                    <MaterialIcons name={r.icon as any} size={16} color={r.color} />
                  </View>
                  <View>
                    <Text style={styles.roleName}>{r.role}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>
        )}

        {/* Login card */}
        <View style={[styles.rightPanel, { backgroundColor: theme.bg }]}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.surface },
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { translateX: shakeAnim },
                ],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={[styles.logoIcon, { backgroundColor: theme.primary + "18" }]}>
                <MaterialIcons name="restaurant" size={28} color={theme.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {t("welcomeBack")}
              </Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                {t("loginToContinue")}
              </Text>
            </View>

            {/* Error banner */}
            {error !== "" && (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={16} color="#ef4444" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {t("email")}
              </Text>
              <View style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.bg,
                  borderColor: emailError ? "#ef4444" : theme.border,
                },
              ]}>
                <MaterialIcons
                  name="email"
                  size={18}
                  color={emailError ? "#ef4444" : theme.textSecondary}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t("email")}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (emailError) setEmailError("");
                  }}
                  onSubmitEditing={handleLogin}
                />
                {email.length > 0 && (
                  <TouchableOpacity onPress={() => setEmail("")}>
                    <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {emailError !== "" && (
                <Text style={styles.fieldError}>{emailError}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {t("password")}
              </Text>
              <View style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.bg,
                  borderColor: passwordError ? "#ef4444" : theme.border,
                },
              ]}>
                <MaterialIcons
                  name="lock"
                  size={18}
                  color={passwordError ? "#ef4444" : theme.textSecondary}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t("password")}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (passwordError) setPasswordError("");
                  }}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {passwordError !== "" && (
                <Text style={styles.fieldError}>{passwordError}</Text>
              )}
            </View>

            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push("/forgot-password" as any)}
            >
              <Text style={[styles.forgotText, { color: theme.primary }]}>
                {t("forgotPassword")}
              </Text>
            </TouchableOpacity>

            {/* Login button */}
            <TouchableOpacity
              style={[
                styles.loginBtn,
                { backgroundColor: theme.primary },
                loading && styles.loginBtnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="login" size={18} color="#fff" />
                  <Text style={styles.loginBtnText}>{t("login")}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Register */}
            <TouchableOpacity
              style={[styles.registerBtn, { borderColor: theme.border }]}
              onPress={() => router.push("/register" as any)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="person-add" size={18} color={theme.primary} />
              <Text style={[styles.registerBtnText, { color: theme.primary }]}>
                {t("createAccount")}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.cardFooter, { color: theme.textSecondary }]}>
              © 2026 Servora ERP. All rights reserved.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    flexDirection: isWeb ? "row" : "column",
    minHeight: "100%",
  },
  leftPanel: {
    width: isWeb ? "45%" : "100%",
    padding: 48,
    justifyContent: "center",
  },
  leftContent: { maxWidth: 400 },
  leftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,215,0,0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 24,
  },
  leftBadgeText: { color: "#FFD700", fontSize: 12, fontWeight: "600" },
  leftTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: "#FFD700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  leftSub: {
    fontSize: 18,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    marginBottom: 16,
  },
  leftDesc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 24,
    marginBottom: 28,
  },
  rolesTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  roleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  roleName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  roleDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  rightPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: isWeb ? 48 : 20,
    paddingTop: isWeb ? 48 : 60,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  cardSub: { fontSize: 14 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorBannerText: { color: "#ef4444", fontSize: 13, flex: 1, lineHeight: 18 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  fieldError: { color: "#ef4444", fontSize: 12, marginTop: 4 },
  forgotRow: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, fontWeight: "600" },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "600" },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  registerBtnText: { fontSize: 14, fontWeight: "700" },
  cardFooter: { textAlign: "center", fontSize: 11 },
});