"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { translations, type Language, type TranslationKey } from "@/lib/i18n/translations";
const storageKey = "research-room:language";
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void } | null>(null);
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("es");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored === "es" || stored === "en" || stored === "pt") setLanguage(stored);
    } catch {
      // sessionStorage is an optional convenience and must never block the app.
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { window.sessionStorage.setItem(storageKey, language); } catch { /* same as above */ }
  }, [language, hydrated]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
export function useTranslations() {
  const { language } = useLanguage();
  return (key: TranslationKey, vars?: Record<string, string | number>) => {
    let text: string = translations[key][language];
    if (vars) for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value));
    return text;
  };
}
