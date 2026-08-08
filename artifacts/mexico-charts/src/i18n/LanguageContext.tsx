import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SiteLanguage = "es" | "en";

type LanguageContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  pick: <T,>(spanish: T, english: T) => T;
};

const STORAGE_KEY = "mexico-charts-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): SiteLanguage {
  if (typeof window === "undefined") return "es";
  const requested = new URL(window.location.href).searchParams.get("lang");
  if (requested === "en" || requested === "es") return requested;
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "es";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>(initialLanguage);

  const setLanguage = useCallback((nextLanguage: SiteLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);

    const url = new URL(window.location.href);
    if (nextLanguage === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "es-MX";
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    pick: <T,>(spanish: T, english: T) => language === "en" ? english : spanish,
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
