// ============================================
// SERVORA ERP — Global App Context
// Theme + Language + Restaurant + Currency
// ============================================

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, ReactNode,
} from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  ThemeName, LanguageCode,
  THEMES, TRANSLATIONS,
} from "../constants/theme";

// ── Types ────────────────────────────────────
export interface RestaurantInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  currencySymbol: string;
  vatNumber: string;
  country: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  restaurantId: string;
  active: boolean;
}

interface AppContextType {
  // Theme
  themeName: ThemeName;
  theme: typeof THEMES.navyDark;
  setTheme: (name: ThemeName) => void;

  // Language
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  t: (key: string) => string;

  // User
  userProfile: UserProfile | null;
  userLoading: boolean;

  // Restaurant
  restaurant: RestaurantInfo | null;
  restaurantId: string;
  currency: string;
  fmt: (amount: number) => string;

  // Refresh
  refreshRestaurant: () => Promise<void>;
}

// ── Default restaurant ───────────────────────
const DEFAULT_RESTAURANT: RestaurantInfo = {
  id: "",
  name: "Servora ERP",
  address: "",
  phone: "",
  email: "",
  currency: "EUR",
  currencySymbol: "€",
  vatNumber: "",
  country: "PT",
};

// ── Context ──────────────────────────────────
const AppContext = createContext<AppContextType>({
  themeName: "navyDark",
  theme: THEMES.navyDark,
  setTheme: () => {},
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  userProfile: null,
  userLoading: true,
  restaurant: null,
  restaurantId: "",
  currency: "€",
  fmt: (v) => `€${v.toFixed(2)}`,
  refreshRestaurant: async () => {},
});

// ── Provider ─────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("navyDark");
  const [lang, setLangState] = useState<LanguageCode>("en");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const theme = THEMES[themeName];

  const t = useCallback(
    (key: string): string =>
      TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS["en"]?.[key] ?? key,
    [lang]
  );

  const setTheme = useCallback((name: ThemeName) => setThemeName(name), []);
  const setLang = useCallback((code: LanguageCode) => setLangState(code), []);

  // ── Load restaurant info ─────────────────
  const loadRestaurant = useCallback(async (restaurantId: string) => {
    if (!restaurantId) return;
    try {
      const snap = await getDoc(doc(db, "restaurants", restaurantId));
      if (snap.exists()) {
        setRestaurant({ id: snap.id, ...snap.data() } as RestaurantInfo);
      } else {
        // Create default restaurant doc
        const defaultData = {
          ...DEFAULT_RESTAURANT,
          id: restaurantId,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "restaurants", restaurantId), defaultData);
        setRestaurant({ ...defaultData, id: restaurantId });
      }
    } catch {
      setRestaurant({ ...DEFAULT_RESTAURANT, id: restaurantId });
    }
  }, []);

  const refreshRestaurant = useCallback(async () => {
    if (userProfile?.restaurantId) {
      await loadRestaurant(userProfile.restaurantId);
    }
  }, [userProfile, loadRestaurant]);

  // ── Auth state listener ──────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUserProfile(null);
        setRestaurant(null);
        setUserLoading(false);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            name: data.name ?? "",
            email: firebaseUser.email ?? "",
            role: data.role ?? "SALESMAN",
            restaurantId: data.restaurantId ?? firebaseUser.uid,
            active: data.active ?? true,
          };
          setUserProfile(profile);
          await loadRestaurant(profile.restaurantId);
        } else {
          // First time login — create user doc
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName ?? "",
            email: firebaseUser.email ?? "",
            role: "OWNER",
            restaurantId: firebaseUser.uid,
            active: true,
          };
          await setDoc(doc(db, "users", firebaseUser.uid), {
            ...profile,
            createdAt: serverTimestamp(),
          });
          setUserProfile(profile);
          await loadRestaurant(firebaseUser.uid);
        }
      } catch {
        setUserProfile(null);
      }

      setUserLoading(false);
    });

    return unsub;
  }, [loadRestaurant]);

  // ── Currency formatter ───────────────────
  const currencySymbol = restaurant?.currencySymbol ?? "€";

  const fmt = useCallback(
    (amount: number): string => {
      const abs = Math.abs(amount);
      const formatted = abs.toLocaleString("en-IE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return amount < 0
        ? `-${currencySymbol}${formatted}`
        : `${currencySymbol}${formatted}`;
    },
    [currencySymbol]
  );

  return (
    <AppContext.Provider value={{
      themeName, theme, setTheme,
      lang, setLang, t,
      userProfile, userLoading,
      restaurant, restaurantId: userProfile?.restaurantId ?? "",
      currency: currencySymbol, fmt,
      refreshRestaurant,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}