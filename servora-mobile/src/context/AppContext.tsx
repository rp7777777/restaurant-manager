// ============================================
// SERVORA ERP — Global App Context
// ✅ Leave pay rates added
// ✅ Break policy complete
// ✅ Worldwide ready
// ============================================

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, ReactNode,
} from "react";
import {
  doc, getDoc, setDoc,
  onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  ThemeName, LanguageCode,
  THEMES, TRANSLATIONS,
} from "../constants/theme";

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
  timezone: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY";
  defaultTaxRate: number;
  defaultSSRate: number;
  payrollMonthDays: number;
  language: string;
  settingsVersion: number;
  normalDailyHours: number;
  normalWeeklyHours: number;
  paymentType: "MONTHLY" | "HOURLY" | "WEEKLY";
  defaultHourlyRate?: number;
  defaultBreakMinutes: number;
  autoDeductBreak: boolean;
  autoDeductBreakAfterHours: number;
  // ✅ Leave pay rates
  sickLeavePayRate: number;
  vacationPayRate: number;
  trainingPayRate: number;
  publicHolidayPayRate: number;
  dayOffDoPayRate: number;
  dayOffDcPayRate: number;
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
  themeName: ThemeName;
  theme: typeof THEMES.navyDark;
  setTheme: (name: ThemeName) => void;
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  t: (key: string) => string;
  userProfile: UserProfile | null;
  userLoading: boolean;
  restaurant: RestaurantInfo | null;
  restaurantId: string;
  currencyCode: string;
  currencySymbol: string;
  currency: string;
  fmt: (amount: number) => string;
  formatNumber: (value: number) => string;
  settings: RestaurantInfo | null;
  defaultTaxRate: number;
  defaultSSRate: number;
  timezone: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY";
  payrollMonthDays: number;
  normalDailyHours: number;
  normalWeeklyHours: number;
  paymentType: "MONTHLY" | "HOURLY" | "WEEKLY";
  defaultBreakMinutes: number;
  autoDeductBreak: boolean;
  autoDeductBreakAfterHours: number;
  // ✅ Leave pay rates
  sickLeavePayRate: number;
  vacationPayRate: number;
  trainingPayRate: number;
  publicHolidayPayRate: number;
  dayOffDoPayRate: number;
  dayOffDcPayRate: number;
  refreshRestaurant: () => Promise<void>;
}

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
  timezone: "Europe/Lisbon",
  dateFormat: "DD/MM/YYYY",
  defaultTaxRate: 11,
  defaultSSRate: 11,
  payrollMonthDays: 30,
  language: "en",
  settingsVersion: 1,
  normalDailyHours: 8,
  normalWeeklyHours: 40,
  paymentType: "MONTHLY",
  defaultHourlyRate: 0,
  defaultBreakMinutes: 30,
  autoDeductBreak: true,
  autoDeductBreakAfterHours: 6,
  // ✅ Leave defaults
  sickLeavePayRate:     50,
  vacationPayRate:      100,
  trainingPayRate:      100,
  publicHolidayPayRate: 200,
  dayOffDoPayRate:      100,
  dayOffDcPayRate:      0,
};

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
  currencyCode: "EUR",
  currencySymbol: "€",
  currency: "€",
  fmt: (v) => "€" + v.toFixed(2),
  formatNumber: (v) => v.toLocaleString("en-US"),
  settings: null,
  defaultTaxRate: 11,
  defaultSSRate: 11,
  timezone: "Europe/Lisbon",
  dateFormat: "DD/MM/YYYY",
  payrollMonthDays: 30,
  normalDailyHours: 8,
  normalWeeklyHours: 40,
  paymentType: "MONTHLY",
  defaultBreakMinutes: 30,
  autoDeductBreak: true,
  autoDeductBreakAfterHours: 6,
  sickLeavePayRate:     50,
  vacationPayRate:      100,
  trainingPayRate:      100,
  publicHolidayPayRate: 200,
  dayOffDoPayRate:      100,
  dayOffDcPayRate:      0,
  refreshRestaurant: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName]       = useState<ThemeName>("navyDark");
  const [lang, setLangState]            = useState<LanguageCode>("en");
  const [userProfile, setUserProfile]   = useState<UserProfile | null>(null);
  const [restaurant, setRestaurant]     = useState<RestaurantInfo | null>(null);
  const [userLoading, setUserLoading]   = useState(true);
  const [restaurantId, setRestaurantId] = useState<string>("");

  const theme = THEMES[themeName];

  const t = useCallback(
    (key: string): string =>
      TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS["en"]?.[key] ?? key,
    [lang]
  );

  const setTheme = useCallback((name: ThemeName) => setThemeName(name), []);
  const setLang  = useCallback((code: LanguageCode) => setLangState(code), []);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = onSnapshot(
      doc(db, "restaurants", restaurantId),
      (snap) => {
        if (snap.exists()) {
          setRestaurant({ id: snap.id, ...snap.data() } as RestaurantInfo);
        }
      },
      (error) => console.error("Restaurant listener error:", error)
    );
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUserProfile(null);
        setRestaurant(null);
        setRestaurantId("");
        setUserLoading(false);
        return;
      }
      try {
        const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const profile: UserProfile = {
            uid:          firebaseUser.uid,
            name:         data.name         ?? "",
            email:        firebaseUser.email ?? "",
            role:         data.role         ?? "SALESMAN",
            restaurantId: data.restaurantId ?? firebaseUser.uid,
            active:       data.active       ?? true,
          };
          setUserProfile(profile);
          setRestaurantId(profile.restaurantId);
        } else {
          const profile: UserProfile = {
            uid:          firebaseUser.uid,
            name:         firebaseUser.displayName ?? "",
            email:        firebaseUser.email       ?? "",
            role:         "OWNER",
            restaurantId: firebaseUser.uid,
            active:       true,
          };
          await setDoc(doc(db, "users", firebaseUser.uid), {
            ...profile,
            createdAt: serverTimestamp(),
          });
          await setDoc(doc(db, "restaurants", firebaseUser.uid), {
            ...DEFAULT_RESTAURANT,
            id: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
          setUserProfile(profile);
          setRestaurantId(profile.restaurantId);
        }
      } catch {
        setUserProfile(null);
      }
      setUserLoading(false);
    });
    return unsub;
  }, []);

  const refreshRestaurant = useCallback(async () => {
    if (!restaurantId) return;
    const snap = await getDoc(doc(db, "restaurants", restaurantId));
    if (snap.exists()) {
      setRestaurant({ id: snap.id, ...snap.data() } as RestaurantInfo);
    }
  }, [restaurantId]);

  const currencyCode   = restaurant?.currency       ?? "EUR";
  const currencySymbol = restaurant?.currencySymbol ?? "€";
  const locale         = restaurant?.language && restaurant?.country
    ? restaurant.language + "-" + restaurant.country
    : "en-IE";

  const fmt = useCallback(
    (amount: number): string => {
      const abs       = Math.abs(amount);
      const formatted = abs.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return amount < 0
        ? "-" + currencySymbol + formatted
        : currencySymbol + formatted;
    },
    [currencySymbol, locale]
  );

  const formatNumber = useCallback(
    (value: number): string => value.toLocaleString(locale),
    [locale]
  );

  return (
    <AppContext.Provider value={{
      themeName, theme, setTheme,
      lang, setLang, t,
      userProfile, userLoading,
      restaurant,
      restaurantId,
      currencyCode,
      currencySymbol,
      currency:                  currencySymbol,
      fmt,
      formatNumber,
      settings:                  restaurant,
      defaultTaxRate:             restaurant?.defaultTaxRate             ?? 11,
      defaultSSRate:              restaurant?.defaultSSRate              ?? 11,
      timezone:                   restaurant?.timezone                   ?? "Europe/Lisbon",
      dateFormat:                 restaurant?.dateFormat                 ?? "DD/MM/YYYY",
      payrollMonthDays:           restaurant?.payrollMonthDays           ?? 30,
      normalDailyHours:           restaurant?.normalDailyHours           ?? 8,
      normalWeeklyHours:          restaurant?.normalWeeklyHours          ?? 40,
      paymentType:                restaurant?.paymentType                ?? "MONTHLY",
      defaultBreakMinutes:        restaurant?.defaultBreakMinutes        ?? 30,
      autoDeductBreak:            restaurant?.autoDeductBreak            ?? true,
      autoDeductBreakAfterHours:  restaurant?.autoDeductBreakAfterHours  ?? 6,
      // ✅ Leave pay rates
      sickLeavePayRate:     restaurant?.sickLeavePayRate     ?? 50,
      vacationPayRate:      restaurant?.vacationPayRate      ?? 100,
      trainingPayRate:      restaurant?.trainingPayRate      ?? 100,
      publicHolidayPayRate: restaurant?.publicHolidayPayRate ?? 200,
      dayOffDoPayRate:      restaurant?.dayOffDoPayRate      ?? 100,
      dayOffDcPayRate:      restaurant?.dayOffDcPayRate      ?? 0,
      refreshRestaurant,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}