// ============================================
// SERVORA ERP — Role Management
// Assign roles to staff (Manager/Owner only)
// ============================================

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, onSnapshot, doc,
  setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { db, auth } from "../firebase";
import AuthGuard from "./auth-guard";
import { useApp } from "../context/AppContext";

// ── Types ───────────────────────────────────
type UserRole = "MANAGER" | "CHEF" | "STORE" | "SALESMAN" | "OWNER";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: any;
}

const ROLES: { value: UserRole; label: string; icon: string; color: string }[] = [
  { value: "MANAGER", label: "Manager", icon: "manage-accounts", color: "#3b82f6" },
  { value: "CHEF", label: "Chef", icon: "restaurant", color: "#10b981" },
  { value: "STORE", label: "Store", icon: "inventory", color: "#f59e0b" },
  { value: "SALESMAN", label: "Salesman", icon: "point-of-sale", color: "#8b5cf6" },
  { value: "OWNER", label: "Owner", icon: "star", color: "#FFD700" },
];

export default function RolesScreen() {
  const { theme, t } = useApp();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("SALESMAN");
  const [formError, setFormError] = useState("");

  // ── Load staff ────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const data: StaffUser[] = [];
        snap.forEach((d) => {
          data.push({ id: d.id, ...d.data() } as StaffUser);
        });
        setStaff(data.sort((a, b) => a.name?.localeCompare(b.name)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  // ── Create staff account ──────────────────
  const handleCreate = async () => {
    setFormError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setFormError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth, email.trim(), password
      );
      await sendEmailVerification(credential.user);

      await setDoc(doc(db, "users", credential.user.uid), {
        name: name.trim(),
        email: email.trim(),
        role: selectedRole,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid ?? "",
      });

      setName("");
      setEmail("");
      setPassword("");
      setSelectedRole("SALESMAN");
      setShowForm(false);
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  // ── Update role ───────────────────────────
  const updateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch {}
  };

  // ── Toggle active ─────────────────────────
  const toggleActive = async (userId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), { active: !current });
    } catch {}
  };

  const getRoleInfo = (role: string) =>
    ROLES.find((r) => r.value === role) ?? ROLES[3];

  return (
    <AuthGuard allowedRoles={["MANAGER", "OWNER"]}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.bg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={styles.headerTitle}>Role Management</Text>
          <Text style={styles.headerSub}>Staff Permission Control</Text>
        </View>

        <View style={styles.body}>
          {/* Add Staff Button */}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.primary }]}
            onPress={() => setShowForm(!showForm)}
          >
            <MaterialIcons
              name={showForm ? "close" : "person-add"}
              size={20}
              color="#fff"
            />
            <Text style={styles.addBtnText}>
              {showForm ? "Cancel" : "Add Staff Account"}
            </Text>
          </TouchableOpacity>

          {/* Add Form */}
          {showForm && (
            <View style={[styles.form, { backgroundColor: theme.card }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>
                New Staff Account
              </Text>

              {formError !== "" && (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={14} color="#ef4444" />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {[
                { label: "Full Name", value: name, setter: setName, secure: false },
                { label: "Email", value: email, setter: setEmail, secure: false },
                { label: "Password", value: password, setter: setPassword, secure: true },
              ].map(({ label, value, setter, secure }) => (
                <View key={label} style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    {label}
                  </Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }]}
                    placeholder={label}
                    placeholderTextColor={theme.textSecondary}
                    value={value}
                    onChangeText={setter}
                    secureTextEntry={secure}
                    autoCapitalize="none"
                  />
                </View>
              ))}

              {/* Role selector */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Role
              </Text>
              <View style={styles.roleGrid}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.roleChip,
                      { borderColor: r.color },
                      selectedRole === r.value && {
                        backgroundColor: r.color,
                      },
                    ]}
                    onPress={() => setSelectedRole(r.value)}
                  >
                    <MaterialIcons
                      name={r.icon as any}
                      size={16}
                      color={selectedRole === r.value ? "#fff" : r.color}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        { color: selectedRole === r.value ? "#fff" : r.color },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Staff List */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Staff ({staff.length})
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          ) : staff.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
              <MaterialIcons name="people" size={40} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No staff added yet
              </Text>
            </View>
          ) : (
            staff.map((member) => {
              const roleInfo = getRoleInfo(member.role);
              return (
                <View
                  key={member.id}
                  style={[styles.staffCard, { backgroundColor: theme.card }]}
                >
                  {/* Avatar + Info */}
                  <View style={styles.staffLeft}>
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: roleInfo.color + "22" },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: roleInfo.color }]}>
                        {member.name?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                    <View style={styles.staffInfo}>
                      <Text style={[styles.staffName, { color: theme.text }]}>
                        {member.name}
                      </Text>
                      <Text style={[styles.staffEmail, { color: theme.textSecondary }]}>
                        {member.email}
                      </Text>
                      {/* Role badge */}
                      <View
                        style={[
                          styles.roleBadge,
                          { backgroundColor: roleInfo.color + "22" },
                        ]}
                      >
                        <MaterialIcons
                          name={roleInfo.icon as any}
                          size={12}
                          color={roleInfo.color}
                        />
                        <Text
                          style={[styles.roleBadgeText, { color: roleInfo.color }]}
                        >
                          {roleInfo.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.staffActions}>
                    {/* Active toggle */}
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        {
                          backgroundColor: member.active
                            ? "#10b98122"
                            : "#ef444422",
                        },
                      ]}
                      onPress={() => toggleActive(member.id, member.active)}
                    >
                      <Text
                        style={{
                          color: member.active ? "#10b981" : "#ef4444",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {member.active ? "Active" : "Inactive"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFD700",
  },
  headerSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 4,
  },
  body: { padding: 16 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    justifyContent: "center",
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  form: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    flex: 1,
  },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 16,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  saveBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 8,
  },
  emptyBox: {
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  staffCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  staffLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
  },
  staffInfo: { flex: 1 },
  staffName: {
    fontSize: 14,
    fontWeight: "700",
  },
  staffEmail: {
    fontSize: 11,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  staffActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
});