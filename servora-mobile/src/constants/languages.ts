// ============================================
// SERVORA ERP — Languages
// ✅ Language metadata
// ✅ LANGUAGE_CODES imported — no duplication
// ✅ Readonly — no mutation
// ✅ RTL_LANGUAGES — explicit type
// ✅ LANGUAGE_LIST — UI helper
// FROZEN
// ============================================

import { LANGUAGE_CODES, LanguageCode } from "./translation-types";

// ── Language metadata ─────────────────────────
export interface LanguageConfig {
  readonly name: string;
  readonly flag: string;
  readonly rtl:  boolean;
}

export const LANGUAGES: Readonly<Record<LanguageCode, LanguageConfig>> = {
  en: { name: "English",   flag: "🇬🇧", rtl: false },
  ne: { name: "नेपाली",     flag: "🇳🇵", rtl: false },
  pt: { name: "Português", flag: "🇵🇹", rtl: false },
  es: { name: "Español",   flag: "🇪🇸", rtl: false },
  fr: { name: "Français",  flag: "🇫🇷", rtl: false },
  ar: { name: "العربية",   flag: "🇸🇦", rtl: true  },
  zh: { name: "中文",       flag: "🇨🇳", rtl: false },
  hi: { name: "हिन्दी",     flag: "🇮🇳", rtl: false },
  de: { name: "Deutsch",   flag: "🇩🇪", rtl: false },
  it: { name: "Italiano",  flag: "🇮🇹", rtl: false },
  no: { name: "Norsk",     flag: "🇳🇴", rtl: false },
  da: { name: "Dansk",     flag: "🇩🇰", rtl: false },
  ja: { name: "日本語",     flag: "🇯🇵", rtl: false },
  ko: { name: "한국어",     flag: "🇰🇷", rtl: false },
} as const;

// ── Default language ──────────────────────────
export const DEFAULT_LANGUAGE: LanguageCode = "en";

// ✅ Fix #1 — explicit type
export const RTL_LANGUAGES: readonly LanguageCode[] =
  LANGUAGE_CODES.filter((code) => LANGUAGES[code].rtl);

// ✅ Fix #2 — UI helper list
export const LANGUAGE_LIST = LANGUAGE_CODES.map((code) => ({
  code,
  ...LANGUAGES[code],
}));