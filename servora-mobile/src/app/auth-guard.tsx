// ============================================
// SERVORA ERP — Auth Guard
// Role-based route protection
// ============================================

import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// ── Public routes — no auth needed ─────────
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/email-verification",
];

// ── Role-based allowed routes ───────────────
const ROLE_ROUTES: Record<string, string[]> = {
  MANAGER: [
    "/dashboard",
    "/analytics",
    "/profit-loss",
    "/monthly-report",
    "/employees",
    "/workerschedule",
    "/payroll",
    "/payroll-history",
    "/salary-slip",
    "/attendance-pro",
    "/expenses",
    "/purchase-orders",
    "/suppliers",
    "/branches",
    "/restaurants",
    "/users",
    "/roles",
    "/audit-log",
    "/settings",
    "/backup",
    "/notifications",
    "/stock-alert",
    "/billing",
    "/workers",
    "/excel-table",
    "/haccp",
    "/dev-recompute-stats",
  ],
  CHEF: [
    "/kitchen",
    "/ingredient-order",
    "/notifications",
    "/dev-recompute-stats",
  ],
  STORE: [
    "/store-requests",
    "/inventory",
    "/stock-alert",
    "/purchase-orders",
    "/notifications",
    "/dev-recompute-stats",
  ],
  SALESMAN: [
    "/add-sale",
    "/sales",
    "/notifications",
    "/dev-recompute-stats",
  ],
  OWNER: [], // Owner gets all routes
};
// ── Default home per role ───────────────────
export const ROLE_HOME: Record<string, string> = {
  MANAGER: "/dashboard",
  CHEF: "/kitchen",
  STORE: "/store-requests",
  SALESMAN: "/add-sale",
  OWNER: "/dashboard",
};

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function AuthGuard({ children, allowedRoles }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // Not logged in
      if (!user) {
        if (!PUBLIC_ROUTES.includes(pathname)) {
          router.replace("/login" as any);
        }
        setLoading(false);
        setAuthorized(true);
        return;
      }

      // Email not verified
      if (!user.emailVerified) {
        router.replace("/email-verification" as any);
        setLoading(false);
        return;
      }

      // Get user role from Firestore
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userRole: string = userDoc.exists()
          ? (userDoc.data().role ?? "SALESMAN")
          : "SALESMAN";

        //Role loaded successfully

        // If specific roles required for this screen
        if (allowedRoles && allowedRoles.length > 0) {
          if (
            !allowedRoles.includes(userRole) &&
            userRole !== "OWNER"
          ) {
            // Redirect to their home
            router.replace(
              (ROLE_HOME[userRole] ?? "/dashboard") as any
            );
            setLoading(false);
            return;
          }
        }

        // Check route permission
        if (!PUBLIC_ROUTES.includes(pathname)) {
          const allowed =
            userRole === "OWNER" ||
            (ROLE_ROUTES[userRole] ?? []).includes(pathname);

          if (!allowed) {
            router.replace(
              (ROLE_HOME[userRole] ?? "/dashboard") as any
            );
            setLoading(false);
            return;
          }
        }

        setAuthorized(true);
      } catch {
        setAuthorized(true);
      }

      setLoading(false);
    });

    return unsub;
  }, [pathname]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00154f" />
      </View>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef2f7",
  },
});