// ============================================
// SERVORA ERP — Translations Index
// ✅ All 14 languages combined
// ✅ Type-safe — TranslationKeys interface
// ✅ LANGUAGE_CODES synchronized
// ✅ getTranslation() — no unnecessary fallback
// ✅ translate() — future interpolation ready
// FROZEN
// ============================================

import {
  LanguageCode,
  Translation,
  TranslationKeys,
} from "../translation-types";

import en from "./en";
import ne from "./ne";
import pt from "./pt";
import es from "./es";
import fr from "./fr";
import ar from "./ar";
import zh from "./zh";
import hi from "./hi";
import de from "./de";
import it from "./it";
import no from "./no";
import da from "./da";
import ja from "./ja";
import ko from "./ko";

// ── All translations ──────────────────────────
export const TRANSLATIONS: Readonly<Record<LanguageCode, Translation>> = {
  en, ne, pt, es,
  fr, ar, zh, hi,
  de, it, no, da,
  ja, ko,
} as const;

// ── Helper — get translation ──────────────────
// ✅ Fix #2 — no unnecessary fallback
// Record<LanguageCode, Translation> guarantees lang exists
export function getTranslation(lang: LanguageCode): Translation {
  return TRANSLATIONS[lang];
}

// ── Helper — translate key ────────────────────
// ✅ Fix #1 — keyof TranslationKeys — intent clear
// ✅ Fix #3 — future interpolation ready
export function translate(
  lang:      LanguageCode,
  key:       keyof TranslationKeys,
  fallback?: string,
): string {
  return TRANSLATIONS[lang]?.[key]
    ?? TRANSLATIONS["en"][key]
    ?? fallback
    ?? key;
}

export type { LanguageCode, Translation, TranslationKeys };