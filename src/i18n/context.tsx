import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import { i18n } from "./i18n";
import { type AppLocale, DEFAULT_LOCALE, normalizeLocale } from "./locale";

const STORAGE_KEY = "lorewish.locale";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  /** True until the persisted/device locale has been resolved on first mount. */
  isReady: boolean;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function deviceLocale(): AppLocale {
  const [first] = Localization.getLocales();
  return normalizeLocale(first?.languageTag ?? first?.languageCode ?? null);
}

function applyWebDocumentLang(locale: AppLocale) {
  // Gives text components correct `lang` semantics on web (screen readers,
  // spellcheck, font-shaping) without needing a per-node prop everywhere.
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolved: AppLocale;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        resolved = stored ? normalizeLocale(stored) : deviceLocale();
      } catch {
        resolved = deviceLocale();
      }
      if (!cancelled) {
        i18n.locale = resolved;
        applyWebDocumentLang(resolved);
        setLocaleState(resolved);
        setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    i18n.locale = next;
    applyWebDocumentLang(next);
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Best-effort persistence; an unpersisted switch still applies for
      // the current session even if storage is unavailable.
    });
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, isReady }),
    [locale, setLocale, isReady],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}
