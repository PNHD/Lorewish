import { useCallback } from "react";

import { i18n } from "./i18n";
import { useLocale } from "./context";
import { SUPPORTED_LOCALES, type AppLocale } from "./locale";

type TranslateOptions = Record<string, string | number>;

/**
 * Locale-independent string lookup. Keys are dotted paths into
 * src/i18n/locales/{locale}.json — never the display string itself.
 */
export function useTranslation() {
  const { locale, setLocale, isReady } = useLocale();

  // `locale` in the dependency array forces this to recompute (and callers
  // to re-render) on switch, even though `i18n.t` itself reads mutable state.
  const t = useCallback(
    (key: string, options?: TranslateOptions) => i18n.t(key, { locale, ...options }),
    [locale],
  );

  return { t, locale, setLocale, isReady, availableLocales: SUPPORTED_LOCALES satisfies readonly AppLocale[] };
}
