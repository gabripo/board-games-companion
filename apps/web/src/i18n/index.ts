import type { Locale, LocalizedString } from "@bgc/schema";
import i18next from "i18next";
import { useCallback } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import { detectLanguage, settingsStore, useSettings } from "../settings/settings";
import en from "./locales/en.json";
import it from "./locales/it.json";

export const resources = { en: { translation: en }, it: { translation: it } } as const;

export function initI18n(): typeof i18next {
  const lng = settingsStore.get().language ?? detectLanguage();
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18next;
}

/** The effective UI/content language: the user's choice, else the browser's. */
export function useLocale(): Locale {
  const { language } = useSettings();
  return language ?? detectLanguage();
}

/** Picks the current language from a `{en, it}` content string (falls back to English). */
export function useL(): (s: LocalizedString | undefined) => string {
  const lang = useLocale();
  return useCallback((s) => (s ? s[lang] || s.en : ""), [lang]);
}

export { useTranslation };

/** 95 → "1:35" */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
